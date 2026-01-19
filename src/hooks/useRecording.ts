import { useState, useRef, useCallback } from 'react';
import { receberAudioMobile, reportarStatusGravacao } from '@/lib/api';
import { addPendingUpload } from '@/lib/appState';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  segmentsSent: number;
  segmentsPending: number;
}

const SEGMENT_DURATION_MS = 10000; // 10 seconds per segment
const SILENCE_TIMEOUT_MS = 600000; // 10 minutes of silence

export function useRecording() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    segmentsSent: 0,
    segmentsPending: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const segmentIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Report recording started
      await reportarStatusGravacao('iniciada');

      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      segmentIndexRef.current = 0;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          
          // Send segment
          const segmentBlob = new Blob(chunksRef.current, { type: mimeType });
          chunksRef.current = [];
          
          setState((prev) => ({ ...prev, segmentsPending: prev.segmentsPending + 1 }));

          const result = await receberAudioMobile(segmentBlob, segmentIndexRef.current);

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
                fileName: `segment_${segmentIndexRef.current}.webm`,
                fileSize: segmentBlob.size,
                type: 'audio',
                data: reader.result as string,
              });
            };
            reader.readAsDataURL(segmentBlob);
            
            setState((prev) => ({ ...prev, segmentsPending: prev.segmentsPending - 1 }));
            console.error('Failed to upload segment:', result.error);
          }

          segmentIndexRef.current++;
        }
      };

      mediaRecorder.start(SEGMENT_DURATION_MS);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
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
        duration: 0,
        segmentsSent: 0,
        segmentsPending: 0,
      });

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Report recording ended
    await reportarStatusGravacao('finalizada');

    mediaRecorderRef.current = null;

    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      segmentsSent: 0,
      segmentsPending: 0,
    });
  }, []);

  const pauseRecording = useCallback(async () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      await reportarStatusGravacao('pausada');
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resumeRecording = useCallback(async () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      await reportarStatusGravacao('retomada');
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
