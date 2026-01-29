import { useState, useRef, useCallback, useEffect } from 'react';
import { receberAudioMobile, reportarStatusGravacao } from '@/lib/api';
import { addPendingUpload } from '@/lib/appState';
import { encodeWAV, mergeBuffers } from '@/lib/wavEncoder';
import { OrigemGravacao } from '@/lib/types';
import { permissionsService } from '@/services/permissionsService';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  isStopping: boolean;
  duration: number;
  segmentsSent: number;
  segmentsPending: number;
  origemGravacao: OrigemGravacao | null;
}

const SEGMENT_DURATION_MS = 30000; // 30 seconds per segment
const SILENCE_TIMEOUT_MS = 600000; // 10 minutes of silence
const SAMPLE_RATE = 16000;

export function useRecording() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    isStopping: false,
    duration: 0,
    segmentsSent: 0,
    segmentsPending: 0,
    origemGravacao: null,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const segmentIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(false);
  const isRecordingRef = useRef(false);
  const origemGravacaoRef = useRef<OrigemGravacao>('botao_manual');

  // Send segment function
  const sendSegment = useCallback(async () => {
    if (audioBufferRef.current.length === 0) return;

    const samples = mergeBuffers(audioBufferRef.current);
    audioBufferRef.current = [];

    if (samples.length === 0) return;

    // Calculate duration in seconds from sample count
    const durationSeconds = Math.round(samples.length / SAMPLE_RATE);

    const wavBuffer = encodeWAV(samples, SAMPLE_RATE);
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

    const currentSegmentIndex = segmentIndexRef.current;
    segmentIndexRef.current++;

    setState((prev) => ({ ...prev, segmentsPending: prev.segmentsPending + 1 }));

    const result = await receberAudioMobile(
      wavBlob, 
      currentSegmentIndex, 
      durationSeconds,
      origemGravacaoRef.current
    );

    if (!result.error) {
      setState((prev) => ({
        ...prev,
        segmentsSent: prev.segmentsSent + 1,
        segmentsPending: prev.segmentsPending - 1,
      }));
    } else {
      // Add to pending queue for later retry
      const reader = new FileReader();
      reader.onloadend = () => {
        addPendingUpload({
          fileName: `segment_${currentSegmentIndex}.wav`,
          fileSize: wavBlob.size,
          type: 'audio',
          data: reader.result as string,
          durationSeconds,
          origemGravacao: origemGravacaoRef.current,
        });
      };
      reader.readAsDataURL(wavBlob);

      setState((prev) => ({ ...prev, segmentsPending: prev.segmentsPending - 1 }));
      console.error('Failed to upload segment:', result.error);
    }
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Disconnect audio nodes
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Release microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (segmentTimerRef.current) {
      clearInterval(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Clear buffer
    audioBufferRef.current = [];
    isRecordingRef.current = false;
    isPausedRef.current = false;
  }, []);

  // Cleanup effect - stops recording when component unmounts
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startRecording = useCallback(async (
    origemGravacao: OrigemGravacao = 'botao_manual'
  ): Promise<boolean> => {
    // Prevent starting if already recording
    if (isRecordingRef.current) {
      console.warn('Recording already in progress');
      return false;
    }

    // Store the origin for segment uploads
    origemGravacaoRef.current = origemGravacao;

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: SAMPLE_RATE,
        },
      });

      streamRef.current = stream;
      isRecordingRef.current = true;
      permissionsService.updateMicrophonePermission('granted');

      // Report recording started
      await reportarStatusGravacao('iniciada', origemGravacao);

      // Setup AudioContext for WAV capture
      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Use ScriptProcessorNode to capture raw audio samples
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isPausedRef.current || !isRecordingRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        audioBufferRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      segmentIndexRef.current = 0;
      audioBufferRef.current = [];

      // Send segment every 60 seconds
      segmentTimerRef.current = setInterval(() => {
        if (!isPausedRef.current && isRecordingRef.current) {
          sendSegment();
        }
      }, SEGMENT_DURATION_MS);

      // Start duration timer
      timerRef.current = setInterval(() => {
        if (!isPausedRef.current) {
          setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
        }
      }, 1000);

      // Reset silence timer on audio activity
      const resetSilenceTimer = () => {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          console.log('Silence timeout reached, stopping recording');
          stopRecording();
        }, SILENCE_TIMEOUT_MS);
      };

      resetSilenceTimer();

      setState({
        isRecording: true,
        isPaused: false,
        isStopping: false,
        duration: 0,
        segmentsSent: 0,
        segmentsPending: 0,
        origemGravacao: origemGravacao,
      });

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      permissionsService.updateMicrophonePermission('denied');
      cleanup();
      return false;
    }
  }, [cleanup, sendSegment]);

  const stopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;

    // Indicate that stopping is in progress
    setState((prev) => ({ ...prev, isStopping: true }));

    // Send remaining audio buffer before stopping
    if (audioBufferRef.current.length > 0) {
      await sendSegment();
    }

    cleanup();

    // Report recording ended
    await reportarStatusGravacao('finalizada', origemGravacaoRef.current);

    setState({
      isRecording: false,
      isPaused: false,
      isStopping: false,
      duration: 0,
      segmentsSent: 0,
      segmentsPending: 0,
      origemGravacao: null,
    });
  }, [cleanup, sendSegment]);

  const pauseRecording = useCallback(async () => {
    if (isRecordingRef.current && !isPausedRef.current) {
      isPausedRef.current = true;
      await reportarStatusGravacao('pausada', origemGravacaoRef.current);
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resumeRecording = useCallback(async () => {
    if (isRecordingRef.current && isPausedRef.current) {
      isPausedRef.current = false;
      await reportarStatusGravacao('retomada', origemGravacaoRef.current);
      setState((prev) => ({ ...prev, isPaused: false }));
    }
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
