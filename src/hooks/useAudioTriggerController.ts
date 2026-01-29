/**
 * Audio Trigger Controller Hook
 * Central hook for managing audio trigger detection
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  AudioTriggerConfig,
  AudioTriggerEvent,
  AudioTriggerMetrics,
  TriggerState,
  GenderClass,
  FrameMetrics,
} from '@/types/audioTrigger';
import type { ServerAudioTriggerConfig } from '@/lib/types';
import { DEFAULT_CONFIG } from '@/types/audioTrigger';
import { processFrame, updateNoiseFloor } from '@/services/dspService';
import { estimateF0, getF0Median2s, resetPitchEstimator } from '@/services/pitchService';
import { classifyGender } from '@/services/genderClassifierService';
import { discussionDetector } from '@/services/newDiscussionDetectorService';
import { triggerStateMachine } from '@/services/triggerStateMachine';
import { RingBuffer, calculateMedian } from '@/utils/ringBuffer';
import { getFullConfig, saveConfig, saveServerConfig } from '@/utils/configStorage';
import { serverToClientConfig } from '@/utils/configConverter';
import { backgroundService } from '@/services/backgroundService';
import { AdaptiveNoiseFloor } from '@/lib/AdaptiveNoiseFloor';

// Buffer sizes
const MAX_EVENTS = 100;
const FRAMES_PER_AGGREGATION = 25; // 500ms at 20ms frames

export interface AudioTriggerControllerReturn {
  // State
  isCapturing: boolean;
  hasPermission: boolean | null;
  error: string | null;
  
  // Streams
  events: AudioTriggerEvent[];
  metrics: AudioTriggerMetrics | null;
  
  // Derived state
  state: TriggerState;
  config: AudioTriggerConfig;
  isRecording: boolean;
  discussionOn: boolean;
  isCalibrated: boolean;
  
  // Actions
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  setProcessingMode: (mode: 'FULL' | 'LIGHT') => void;
  updateConfig: (config: Partial<AudioTriggerConfig>) => void;
  clearEvents: () => void;
  copyEvents: () => void;
}

export function useAudioTriggerController(
  initialConfig?: Partial<AudioTriggerConfig>,
  serverConfig?: ServerAudioTriggerConfig | null
): AudioTriggerControllerReturn {
  // Config state - prioritize server config
  const [config, setConfig] = useState<AudioTriggerConfig>(() => {
    // 1. If server config is provided, use it
    if (serverConfig) {
      const converted = serverToClientConfig(serverConfig);
      saveServerConfig(serverConfig); // Cache locally
      return { ...converted, ...initialConfig };
    }
    
    // 2. Fallback to cached config
    const stored = getFullConfig();
    return { ...stored, ...initialConfig };
  });

  // Capture state
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Event and metrics state
  const [events, setEvents] = useState<AudioTriggerEvent[]>([]);
  const [metrics, setMetrics] = useState<AudioTriggerMetrics | null>(null);

  // State machine state
  const [triggerState, setTriggerState] = useState<TriggerState>('IDLE');

  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Processing state refs
  const noiseFloorRef = useRef<number>(-50);
  const frameBufferRef = useRef<RingBuffer<FrameMetrics>>(new RingBuffer(FRAMES_PER_AGGREGATION));
  const lastAggregationTimeRef = useRef<number>(0);
  const speechOnRef = useRef<boolean>(false);
  const loudOnRef = useRef<boolean>(false);
  const currentGenderRef = useRef<GenderClass>('UNKNOWN');
  const discussionOnRef = useRef<boolean>(false);
  const configRef = useRef(config);
  
  // Adaptive noise floor
  const adaptiveNoiseFloorRef = useRef<AdaptiveNoiseFloor | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);

  // Keep config ref updated
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Update config when serverConfig changes
  useEffect(() => {
    if (serverConfig) {
      const converted = serverToClientConfig(serverConfig);
      setConfig(prev => ({ ...prev, ...converted }));
      saveServerConfig(serverConfig);
    }
  }, [serverConfig]);

  // Add event helper
  const addEvent = useCallback((event: AudioTriggerEvent) => {
    setEvents(prev => {
      const newEvents = [event, ...prev];
      return newEvents.slice(0, MAX_EVENTS);
    });
  }, []);

  // Set up event callback for state machine
  useEffect(() => {
    triggerStateMachine.setEventCallback(addEvent);
  }, [addEvent]);

  // Debug frame counter
  const frameCountRef = useRef<number>(0);

  // Process audio frame
  const processAudioFrame = useCallback((samples: Float32Array, sampleRate: number) => {
    const cfg = configRef.current;
    const now = Date.now();
    const mode = cfg.processingMode || 'FULL';

    frameCountRef.current++;
    
    // Log every 50 frames (~1 second at 50fps) for better diagnostics
    if (frameCountRef.current % 50 === 0) {
      const maxSample = Math.max(...Array.from(samples).map(Math.abs));
      console.log('[AudioTrigger] Frame #', frameCountRef.current, '| Max sample:', maxSample.toFixed(4));
    }

    // Process frame for DSP metrics
    const frameResult = processFrame(samples, noiseFloorRef.current, cfg);

    // Update noise floor
    noiseFloorRef.current = updateNoiseFloor(
      noiseFloorRef.current,
      frameResult.dbfs,
      frameResult.isSpeech,
      cfg
    );

    // Detect speech state changes
    if (frameResult.isSpeech !== speechOnRef.current) {
      speechOnRef.current = frameResult.isSpeech;
      addEvent({
        type: frameResult.isSpeech ? 'speechOn' : 'speechOff',
        timestamp: now,
        message: frameResult.isSpeech ? 'Fala detectada' : 'Silêncio',
        payload: { dbfs: frameResult.dbfs },
      });
    }

    // Detect loud state changes
    if (frameResult.isLoud !== loudOnRef.current) {
      loudOnRef.current = frameResult.isLoud;
      addEvent({
        type: frameResult.isLoud ? 'loudOn' : 'loudOff',
        timestamp: now,
        message: frameResult.isLoud ? 'Volume alto' : 'Volume normal',
        payload: { dbfs: frameResult.dbfs },
      });
    }

    // Estimate pitch (only when speech detected AND in FULL mode)
    let f0Current: number | null = null;
    let voicingConfidence = 0;
    if (mode === 'FULL' && frameResult.isSpeech) {
      const pitchResult = estimateF0(samples, sampleRate);
      f0Current = pitchResult.f0;
      voicingConfidence = pitchResult.confidence;
    }

    // Add frame to buffer
    frameBufferRef.current.push({
      timestamp: now,
      rms: frameResult.rms,
      dbfs: frameResult.dbfs,
      zcr: frameResult.zcr,
      isSpeech: frameResult.isSpeech,
      isLoud: frameResult.isLoud,
    });

    // In LIGHT mode, aggregate every 5000ms instead of 1000ms (80% less processing)
    const aggregationInterval = mode === 'LIGHT' ? 5000 : cfg.aggregationMs;
    
    // Check if it's time for aggregation
    if (now - lastAggregationTimeRef.current >= aggregationInterval) {
      lastAggregationTimeRef.current = now;

      const frames = frameBufferRef.current.toArray();
      if (frames.length > 0) {
        // Calculate aggregated metrics
        const speechCount = frames.filter(f => f.isSpeech).length;
        const loudCount = frames.filter(f => f.isLoud).length;
        const dbfsValues = frames.map(f => f.dbfs);

        const speechRatio = speechCount / frames.length;
        const loudRatio = loudCount / frames.length;
        const dbfsMedian = calculateMedian(dbfsValues);

        // Get F0 median
        const f0Median2s = getF0Median2s();

        // Classify gender
        const newGender = classifyGender(f0Median2s, voicingConfidence, speechOnRef.current, cfg);
        
        // Detect gender change
        if (newGender !== currentGenderRef.current && newGender !== 'UNKNOWN') {
          currentGenderRef.current = newGender;
          addEvent({
            type: 'genderChanged',
            timestamp: now,
            message: `Gênero: ${newGender}`,
            payload: { gender: newGender, f0: f0Median2s },
          });
        }

        // Update adaptive noise floor (only when NOT in discussion)
        if (adaptiveNoiseFloorRef.current && !discussionOnRef.current) {
          adaptiveNoiseFloorRef.current.addSample(dbfsMedian);
          // Update noise floor reference with adaptive value
          noiseFloorRef.current = adaptiveNoiseFloorRef.current.getNoiseFloor();
        }

        // Process discussion detection
        const discussionState = discussionDetector.processAggregation(
          { timestamp: now, dbfsMedian, speechRatio, loudRatio },
          currentGenderRef.current,
          cfg
        );

        // Detect discussion state changes
        if (discussionState.discussionOn !== discussionOnRef.current) {
          discussionOnRef.current = discussionState.discussionOn;
          addEvent({
            type: discussionState.discussionOn ? 'discussionStarted' : 'discussionEnded',
            timestamp: now,
            message: discussionState.discussionOn ? 'Discussão detectada!' : 'Discussão encerrada',
            payload: { score: discussionState.score },
          });
        }

        // Process state machine
        triggerStateMachine.process(speechRatio, discussionState.discussionOn, cfg);
        const newState = triggerStateMachine.state;
        setTriggerState(newState);

        // Get window metrics
        const windowMetrics = discussionDetector.getWindowMetrics();

        // Update metrics
        const newMetrics: AudioTriggerMetrics = {
          timestamp: now,
          dbfsCurrent: frameResult.dbfs,
          noiseFloorDb: noiseFloorRef.current,
          speechRatio,
          loudRatio,
          speechDensity: windowMetrics.speechDensity,
          loudDensity: windowMetrics.loudDensity,
          turnTaking: windowMetrics.turnTaking,
          score: discussionState.score,
          f0Current,
          f0Median2s,
          voicingConfidence,
          gender: currentGenderRef.current,
          speechOn: speechOnRef.current,
          loudOn: loudOnRef.current,
          discussionOn: discussionState.discussionOn,
          recordingOn: triggerStateMachine.isRecording(),
          recordingDuration: triggerStateMachine.getRecordingDuration(),
          state: newState,
        };

        setMetrics(newMetrics);

        // Clear frame buffer for next aggregation
        frameBufferRef.current.clear();
      }
    }
  }, [addEvent]);

  // Start audio capture
  const start = useCallback(async () => {
    console.log('[AudioTrigger] start() called');
    try {
      setError(null);

      console.log('[AudioTrigger] Requesting microphone permission...');
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      console.log('[AudioTrigger] Microphone permission granted');
      setHasPermission(true);
      mediaStreamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioContext;
      console.log('[AudioTrigger] AudioContext created, sampleRate:', audioContext.sampleRate);

      // Force resume for Android 15 compatibility
      if (audioContext.state === 'suspended') {
        console.log('[AudioTrigger] AudioContext is suspended, resuming...');
        await audioContext.resume();
        console.log('[AudioTrigger] AudioContext resumed, state:', audioContext.state);
      }

      // Create analyser node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.1;
      analyserRef.current = analyser;

      // Connect stream to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Calculate frame size
      const frameSize = Math.floor((config.frameMs / 1000) * audioContext.sampleRate);
      const dataArray = new Float32Array(frameSize);
      console.log('[AudioTrigger] Frame size:', frameSize, 'samples');

      // Start processing loop
      let frameCount = 0;
      const processLoop = () => {
        if (!analyserRef.current || !audioContextRef.current) {
          console.warn('[AudioTrigger] Loop stopped: refs are null', {
            analyser: !!analyserRef.current,
            audioContext: !!audioContextRef.current
          });
          return;
        }

        analyserRef.current.getFloatTimeDomainData(dataArray);
        processAudioFrame(dataArray, audioContextRef.current.sampleRate);
        
        frameCount++;
        if (frameCount === 1) {
          console.log('[AudioTrigger] First frame processed');
        }
        if (frameCount % 250 === 0) {
          console.log('[AudioTrigger] Processed', frameCount, 'frames');
        }

        animationFrameRef.current = requestAnimationFrame(processLoop);
      };

      // Initialize adaptive noise floor (only if not already initialized)
      if (!adaptiveNoiseFloorRef.current) {
        const initialNoiseFloor = config.noiseFloorDb || -50;
        const learningRate = 0.1; // Same as native
        adaptiveNoiseFloorRef.current = new AdaptiveNoiseFloor(initialNoiseFloor, learningRate);
        adaptiveNoiseFloorRef.current.setCalibrationCallback((calibrated) => {
          console.log('[AudioTrigger] Calibration status changed:', calibrated);
          setIsCalibrated(calibrated);
        });
        console.log('[AudioTrigger] Adaptive noise floor initialized');
      } else {
        console.log('[AudioTrigger] Reusing existing adaptive noise floor (calibration preserved)');
        // Update isCalibrated state from existing instance
        setIsCalibrated(adaptiveNoiseFloorRef.current.isCalibrated());
      }
      
      console.log('[AudioTrigger] Starting process loop');
      animationFrameRef.current = requestAnimationFrame(processLoop);
      setIsCapturing(true);
      console.log('[AudioTrigger] Audio capture started successfully');

      // Background service is now managed by useBackgroundServices
      // No need to start/stop here

      addEvent({
        type: 'micStarted',
        timestamp: Date.now(),
        message: 'Microfone iniciado',
      });

    } catch (err: unknown) {
      const error = err as Error & { name?: string };
      console.error('[AudioTrigger] Error starting capture:', err);
      setHasPermission(false);
      
      // Background service is managed independently, no need to stop here
      
      let errorMessage = 'Erro ao acessar microfone';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permissão negada para acessar o microfone';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Nenhum microfone encontrado';
      }
      
      setError(errorMessage);
      addEvent({
        type: 'error',
        timestamp: Date.now(),
        message: errorMessage,
        payload: { errorType: error.name },
      });
    }
  }, [config.frameMs, addEvent, processAudioFrame]);

  // Stop audio capture
  const stop = useCallback(async () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsCapturing(false);

    // Background service is managed independently, no need to stop here

    addEvent({
      type: 'micStopped',
      timestamp: Date.now(),
      message: 'Microfone parado',
    });
  }, [addEvent]);

  // Reset all state
  const reset = useCallback(() => {
    stop();
    
    // Reset processing state
    noiseFloorRef.current = -50;
    frameBufferRef.current.clear();
    lastAggregationTimeRef.current = 0;
    speechOnRef.current = false;
    loudOnRef.current = false;
    currentGenderRef.current = 'UNKNOWN';

    // Reset services
    resetPitchEstimator();
    discussionDetector.reset();
    triggerStateMachine.reset();

    // Reset state
    setMetrics(null);
    setTriggerState('IDLE');
    setError(null);
  }, [stop]);

  // Update config
  const updateConfigFn = useCallback((newConfig: Partial<AudioTriggerConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      saveConfig(updated);
      return updated;
    });
  }, []);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Copy events to clipboard
  const copyEvents = useCallback(() => {
    const text = events
      .map(e => `[${new Date(e.timestamp).toISOString()}] ${e.type}: ${e.message || ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  }, [events]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Set processing mode (FULL or LIGHT)
  const setProcessingMode = useCallback((mode: 'FULL' | 'LIGHT') => {
    console.log('[AudioTrigger] Setting processing mode:', mode);
    setConfig(prev => ({ ...prev, processingMode: mode }));
  }, []);

  return {
    isCapturing,
    hasPermission,
    error,
    events,
    metrics,
    state: triggerState,
    config,
    isRecording: triggerState === 'RECORDING',
    discussionOn: metrics?.discussionOn ?? false,
    isCalibrated,
    start,
    stop,
    reset,
    setProcessingMode,
    updateConfig: updateConfigFn,
    clearEvents,
    copyEvents,
  };
}
