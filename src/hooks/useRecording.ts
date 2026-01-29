import { useState, useCallback, useEffect, useRef } from 'react';
import { reportarStatusGravacao } from '@/lib/api';
import { OrigemGravacao } from '@/lib/types';
import { AudioTriggerNative } from '@/plugins/audioTriggerNative';
import { getSessionToken, getUserEmail } from '@/lib/api';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  isStopping: boolean;
  duration: number;
  segmentsSent: number;
  segmentsPending: number;
  origemGravacao: OrigemGravacao | null;
}

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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const origemGravacaoRef = useRef<OrigemGravacao>('botao_manual');
  const currentSessionIdRef = useRef<string | null>(null);

  // Listen to native recording events
  useEffect(() => {
    const listener = AudioTriggerNative.addListener('audioTriggerEvent', (event) => {
      console.log('[useRecording] Native event:', event);

      switch (event.event) {
        case 'nativeRecordingStarted':
          currentSessionIdRef.current = event.sessionId || null;
          setState((prev) => ({
            ...prev,
            isRecording: true,
            isStopping: false,
            duration: 0,
            segmentsSent: 0,
            segmentsPending: 0,
          }));
          break;

        case 'nativeRecordingProgress':
          // Update segments sent count
          if (event.segmentIndex !== undefined) {
            setState((prev) => ({
              ...prev,
              segmentsSent: event.segmentIndex + 1,
            }));
          }
          break;

        case 'nativeUploadProgress':
          // Update upload progress
          if (event.success !== undefined) {
            setState((prev) => ({
              ...prev,
              segmentsSent: event.success,
              segmentsPending: event.pending || 0,
            }));
          }
          break;

        case 'nativeRecordingStopped':
          setState((prev) => ({
            ...prev,
            isRecording: false,
            isStopping: false,
          }));
          currentSessionIdRef.current = null;
          break;
      }
    });

    return () => {
      listener.remove();
    };
  }, []);

  // Duration timer
  useEffect(() => {
    if (state.isRecording && !state.isPaused) {
      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state.isRecording, state.isPaused]);

  const startRecording = useCallback(async (origem: OrigemGravacao = 'botao_manual'): Promise<boolean> => {
    try {
      console.log('[useRecording] Starting native recording, origem:', origem);

      origemGravacaoRef.current = origem;

      // Get credentials
      const sessionToken = getSessionToken();
      const emailUsuario = getUserEmail();

      if (!sessionToken || !emailUsuario) {
        console.error('[useRecording] Missing credentials');
        return false;
      }

      // Start native recording
      await AudioTriggerNative.startRecording({
        sessionToken,
        emailUsuario,
        origemGravacao: origem,
      });

      isRecordingRef.current = true;

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        isStopping: false,
        origemGravacao: origem,
      }));

      console.log('[useRecording] Native recording started');
      return true;

    } catch (error) {
      console.error('[useRecording] Error starting native recording:', error);
      return false;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      console.log('[useRecording] Stopping native recording');

      setState((prev) => ({ ...prev, isStopping: true }));

      // Stop native recording
      await AudioTriggerNative.stopRecording();

      isRecordingRef.current = false;

      // Report final status
      if (currentSessionIdRef.current) {
        await reportarStatusGravacao(
          currentSessionIdRef.current,
          'finalizada',
          state.segmentsSent
        );
      }

      setState((prev) => ({
        ...prev,
        isRecording: false,
        isStopping: false,
        duration: 0,
      }));

      console.log('[useRecording] Native recording stopped');

    } catch (error) {
      console.error('[useRecording] Error stopping native recording:', error);
      setState((prev) => ({ ...prev, isStopping: false }));
    }
  }, [state.segmentsSent]);

  const pauseRecording = useCallback(() => {
    // Native recording doesn't support pause
    console.warn('[useRecording] Pause not supported in native recording');
  }, []);

  const resumeRecording = useCallback(() => {
    // Native recording doesn't support resume
    console.warn('[useRecording] Resume not supported in native recording');
  }, []);

  return {
    isRecording: state.isRecording,
    isPaused: state.isPaused,
    isStopping: state.isStopping,
    duration: state.duration,
    segmentsSent: state.segmentsSent,
    segmentsPending: state.segmentsPending,
    origemGravacao: state.origemGravacao,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
