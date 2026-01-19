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
    const pending = getPendingUploads();
    if (pending.length !== state.pendingUploads) {
      setState((prev) => ({ ...prev, pendingUploads: pending.length }));
    }
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

  const refreshPendingCount = useCallback(() => {
    const pending = getPendingUploads();
    setState((prev) => ({ ...prev, pendingUploads: pending.length }));
  }, []);

  return {
    ...state,
    setStatus,
    setAuthenticated,
    setLocation,
    refreshPendingCount,
  };
}
