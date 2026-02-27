import { useState, useCallback, useEffect, useRef } from 'react';
import { reportarStatusGravacao } from '@/lib/api';
import { OrigemGravacao } from '@/lib/types';
import { AudioTriggerNative } from '@/plugins/audioTriggerNative';
import { getSessionToken, getUserEmail } from '@/lib/api';
import { saveState, loadState } from '@/lib/appState';

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
  const stopResolverRef = useRef<(() => void) | null>(null);

  // Listen to native recording events
  useEffect(() => {
    const listenerPromise = AudioTriggerNative.addListener('audioTriggerEvent', (event) => {
      console.log('[useRecording] Native event:', event);

      switch (event.event) {
        case 'nativeRecordingStarted':
          currentSessionIdRef.current = event.sessionId || null;
          // Capture startedAt timestamp from native and save to app state
          const startTimestamp = event.startedAt || Date.now();
          console.log('[useRecording] Recording started at:', new Date(startTimestamp).toISOString());
          saveState({ recordingStartTime: startTimestamp, status: 'recording' });

          // Update origem if provided by native (automatic detection)
          if (event.origemGravacao) {
            origemGravacaoRef.current = event.origemGravacao as OrigemGravacao;
            console.log('[useRecording] Origem from native:', event.origemGravacao);
          }
          setState((prev) => ({
            ...prev,
            isRecording: true,
            isStopping: false,
            duration: 0,
            segmentsSent: 0,
            segmentsPending: 0,
            origemGravacao: event.origemGravacao as OrigemGravacao || prev.origemGravacao,
          }));
          break;

        case 'nativeRecordingProgress':
          // Update segments sent count
          if (event.segmentIndex !== undefined) {
            setState((prev) => ({
              ...prev,
              segmentsSent: event.segmentIndex,
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
          saveState({ recordingStartTime: null, status: 'normal' });

          // Resolve pending stopRecording promise
          if (stopResolverRef.current) {
            console.log('[useRecording] Stop confirmed by native event');
            stopResolverRef.current();
            stopResolverRef.current = null;
          }
          break;

        case 'recordingState':
          // Sync recording state from native (e.g., after app restart)
          console.log('[useRecording] Syncing recording state from native:', event);
          if (event.isRecording !== undefined) {
            currentSessionIdRef.current = event.sessionId || null;

            const currentState = loadState();

            if (event.isRecording) {
              let syncedStart = event.startedAt || currentState.recordingStartTime || Date.now();
              saveState({ recordingStartTime: syncedStart, status: 'recording' });
            } else {
              saveState({ recordingStartTime: null, status: 'normal' });
            }

            setState((prev) => ({
              ...prev,
              isRecording: event.isRecording,
              isStopping: false,
            }));
          }
          break;
      }
    });

    return () => {
      listenerPromise.then(l => l.remove());
    };
  }, []);

  // Request native status on mount to sync UI if already recording in background
  useEffect(() => {
    AudioTriggerNative.getStatus().catch(err => {
      console.warn('[useRecording] Failed to request initial status from native:', err);
    });
  }, []);

  // Duration timer
  useEffect(() => {
    if (state.isRecording && !state.isPaused) {
      timerRef.current = setInterval(() => {
        // Calculate duration from global recordingStartTime (persistent across remounts)
        const globalStart = loadState().recordingStartTime;
        if (globalStart) {
          const elapsed = Math.floor((Date.now() - globalStart) / 1000);
          setState((prev) => ({ ...prev, duration: elapsed }));
        } else {
          setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
        }
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
      saveState({ recordingStartTime: Date.now(), status: 'recording' });

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        isStopping: false,
        origemGravacao: origem,
        duration: 0,
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

      // Create a promise that resolves when native event is received
      const stopPromise = new Promise<void>((resolve) => {
        stopResolverRef.current = resolve;

        // Security timeout (3s) to prevent blocking if native fails
        setTimeout(() => {
          if (stopResolverRef.current === resolve) {
            console.warn('[useRecording] Stop timeout reached, forced resolve');
            resolve();
            stopResolverRef.current = null;
          }
        }, 3000);
      });

      // Stop native recording
      await AudioTriggerNative.stopRecording();

      // Wait for confirmation
      await stopPromise;

      isRecordingRef.current = false;

      // Report final status
      if (currentSessionIdRef.current) {
        await reportarStatusGravacao(
          currentSessionIdRef.current,
          'finalizada' as any,
          state.segmentsSent
        );
      }

      setState((prev) => ({
        ...prev,
        isRecording: false,
        isStopping: false,
        duration: 0,
      }));

      console.log('[useRecording] Native recording stopped (Sequenced)');

    } catch (error) {
      console.error('[useRecording] Error stopping native recording:', error);
      setState((prev) => ({ ...prev, isStopping: false }));
      if (stopResolverRef.current) {
        stopResolverRef.current();
        stopResolverRef.current = null;
      }
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
