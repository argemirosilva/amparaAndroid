import { useState, useEffect, useCallback } from 'react';
import {
  AppState,
  AppStatus,
  loadState,
  saveState,
  getPendingUploads,
} from '@/lib/appState';

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState);

  // Sync pending uploads count
  useEffect(() => {
    const updateCount = async () => {
      const localCount = getPendingUploads().length;
      let nativeCount = 0;

      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { AudioTriggerNative } = await import('@/plugins/audioTriggerNative');
        try {
          const result = await AudioTriggerNative.getPendingRecordings();
          if (result.success) {
            nativeCount = result.recordings.length;
          }
        } catch (e) {
          console.error('Failed to fetch native count:', e);
        }
      }

      const total = localCount + nativeCount;
      if (total !== state.pendingUploads) {
        setState((prev) => ({ ...prev, pendingUploads: total }));
      }
    };

    updateCount();

    // Also set up an interval to refresh count every 30s as background tasks might finish
    const interval = setInterval(updateCount, 30000);
    return () => clearInterval(interval);
  }, [state.pendingUploads]);

  const setStatus = useCallback((status: AppStatus) => {
    setState((prev) => {
      const newState = {
        ...prev,
        status,
        recordingStartTime: status === 'recording' ? Date.now() : null,
        panicStartTime: status === 'panic' ? Date.now() : null,
      };
      saveState(newState);
      return newState;
    });
  }, []);

  const setAuthenticated = useCallback((isAuthenticated: boolean) => {
    setState((prev) => {
      const newState = { ...prev, isAuthenticated };
      saveState(newState);
      return newState;
    });
  }, []);

  const setLocation = useCallback((location: { lat: number; lng: number } | null) => {
    setState((prev) => {
      const newState = { ...prev, lastLocation: location };
      saveState(newState);
      return newState;
    });
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const localCount = getPendingUploads().length;
    let nativeCount = 0;

    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { AudioTriggerNative } = await import('@/plugins/audioTriggerNative');
      try {
        const result = await AudioTriggerNative.getPendingRecordings();
        if (result.success) {
          nativeCount = result.recordings.length;
        }
      } catch (e) { }
    }

    setState((prev) => ({ ...prev, pendingUploads: localCount + nativeCount }));
  }, []);

  return {
    ...state,
    setStatus,
    setAuthenticated,
    setLocation,
    refreshPendingCount,
  };
}
