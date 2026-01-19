import { useState, useRef, useCallback, useEffect } from 'react';
import { PANIC_ENDPOINTS, LOCATION_ENDPOINTS, apiRequest } from '@/lib/api';
import { useRecording } from './useRecording';

interface PanicState {
  isPanicActive: boolean;
  panicDuration: number;
  isActivating: boolean;
  location: { lat: number; lng: number } | null;
}

const PANIC_TIMEOUT_MS = 1800000; // 30 minutes auto-timeout
const HOLD_DURATION_MS = 2000; // 2 seconds hold to activate
const CANCEL_DEBOUNCE_MS = 5000; // 5 seconds before cancel is allowed

export function usePanic() {
  const [state, setState] = useState<PanicState>({
    isPanicActive: false,
    panicDuration: 0,
    isActivating: false,
    location: null,
  });

  const { startRecording, stopRecording, isRecording } = useRecording();
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canCancelRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);

  // Get current location
  const getLocation = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  }, []);

  // Start panic activation (on hold start)
  const startHold = useCallback(() => {
    setState((prev) => ({ ...prev, isActivating: true }));
    
    // Vibrate on hold start
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    holdTimerRef.current = setTimeout(() => {
      activatePanic();
    }, HOLD_DURATION_MS);
  }, []);

  // Cancel activation (on hold release before complete)
  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setState((prev) => ({ ...prev, isActivating: false }));
  }, []);

  // Full panic activation
  const activatePanic = useCallback(async () => {
    setState((prev) => ({ ...prev, isActivating: false }));
    
    // Vibrate on activation
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    // Get location
    const location = await getLocation();
    
    // Start recording
    await startRecording();

    // Notify server
    await apiRequest(PANIC_ENDPOINTS.activate, {
      method: 'POST',
      body: { location },
    });

    // Send location update
    if (location) {
      await apiRequest(LOCATION_ENDPOINTS.update, {
        method: 'POST',
        body: location,
      });
    }

    startTimeRef.current = Date.now();
    canCancelRef.current = false;

    // Enable cancel button after debounce
    setTimeout(() => {
      canCancelRef.current = true;
    }, CANCEL_DEBOUNCE_MS);

    // Start duration counter
    timerRef.current = setInterval(() => {
      setState((prev) => ({ ...prev, panicDuration: prev.panicDuration + 1 }));
    }, 1000);

    // Auto-timeout after 30 minutes
    timeoutRef.current = setTimeout(() => {
      deactivatePanic();
    }, PANIC_TIMEOUT_MS);

    setState({
      isPanicActive: true,
      panicDuration: 0,
      isActivating: false,
      location,
    });
  }, [getLocation, startRecording]);

  // Deactivate panic (requires password validation in UI)
  const deactivatePanic = useCallback(async () => {
    // Stop timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Stop recording
    await stopRecording();

    // Notify server
    await apiRequest(PANIC_ENDPOINTS.deactivate, {
      method: 'POST',
    });

    startTimeRef.current = null;
    canCancelRef.current = false;

    setState({
      isPanicActive: false,
      panicDuration: 0,
      isActivating: false,
      location: null,
    });
  }, [stopRecording]);

  // Check if cancel is allowed
  const canCancel = useCallback(() => {
    return canCancelRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  return {
    ...state,
    isRecording,
    startHold,
    cancelHold,
    activatePanic,
    deactivatePanic,
    canCancel,
  };
}
