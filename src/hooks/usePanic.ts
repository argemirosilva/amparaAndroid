import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  acionarPanicoMobile, 
  cancelarPanicoMobile,
} from '@/lib/api';
import { useRecording } from './useRecording';
import { useLocation } from './useLocation';
import { PanicActivationType, PanicCancelType } from '@/lib/types';

interface PanicState {
  isPanicActive: boolean;
  panicDuration: number;
  isActivating: boolean;
  isSendingToServer: boolean;
  location: { lat: number; lng: number } | null;
  protocolNumber: string | null;
  guardiansNotified: number;
}

const PANIC_TIMEOUT_MS = 1800000; // 30 minutes auto-timeout
const HOLD_DURATION_MS = 2000; // 2 seconds hold to activate
const CANCEL_DEBOUNCE_MS = 5000; // 5 seconds before cancel is allowed

export function usePanic() {
  const [state, setState] = useState<PanicState>({
    isPanicActive: false,
    panicDuration: 0,
    isActivating: false,
    isSendingToServer: false,
    location: null,
    protocolNumber: null,
    guardiansNotified: 0,
  });

  const { startRecording, stopRecording, isRecording } = useRecording();
  const location = useLocation();
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canCancelRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);

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
  const activatePanic = useCallback(async (
    tipo: PanicActivationType = 'manual'
  ) => {
    setState((prev) => ({ ...prev, isActivating: false, isSendingToServer: true }));
    
    // Vibrate on activation
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    // Get current location
    const position = await location.getCurrentPosition();
    const lat = position?.latitude ?? 0;
    const lng = position?.longitude ?? 0;
    
    // Start recording with panic origin
    await startRecording('botao_panico');

    // Enable panic mode location tracking (30s intervals)
    location.startTracking(true);

    // Notify server
    const result = await acionarPanicoMobile(lat, lng, tipo);

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
      deactivatePanic('timeout');
    }, PANIC_TIMEOUT_MS);

    setState({
      isPanicActive: true,
      panicDuration: 0,
      isActivating: false,
      isSendingToServer: false,
      location: { lat, lng },
      protocolNumber: result.data?.numero_protocolo || null,
      guardiansNotified: result.data?.guardioes_notificados || 0,
    });
  }, [location, startRecording]);

  // Deactivate panic (requires password validation in UI)
  const deactivatePanic = useCallback(async (
    tipo: PanicCancelType = 'manual'
  ) => {
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

    // Stop panic mode location tracking
    location.disablePanicMode();

    // Notify server
    await cancelarPanicoMobile(tipo);

    startTimeRef.current = null;
    canCancelRef.current = false;

    setState({
      isPanicActive: false,
      panicDuration: 0,
      isActivating: false,
      isSendingToServer: false,
      location: null,
      protocolNumber: null,
      guardiansNotified: 0,
    });
  }, [stopRecording, location]);

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
