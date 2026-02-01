import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { 
  acionarPanicoMobile, 
  cancelarPanicoMobile,
} from '@/lib/api';
import { useRecording } from '@/hooks/useRecording';
import { useLocation } from '@/hooks/useLocation';
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

interface PanicContextValue extends PanicState {
  isRecording: boolean;
  startHold: () => void;
  cancelHold: () => void;
  activatePanic: (tipo?: PanicActivationType) => Promise<void>;
  deactivatePanic: (tipo?: PanicCancelType) => Promise<void>;
  canCancel: () => boolean;
}

// Persistência no localStorage
const PANIC_STORAGE_KEY = 'ampara_panic_state';

interface PersistedPanicState {
  isPanicActive: boolean;
  panicStartTime: number;
  protocolNumber: string | null;
  location: { lat: number; lng: number } | null;
  guardiansNotified: number;
}

function savePanicState(state: PersistedPanicState): void {
  localStorage.setItem(PANIC_STORAGE_KEY, JSON.stringify(state));
}

function loadPanicState(): PersistedPanicState | null {
  try {
    const saved = localStorage.getItem(PANIC_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Erro ao carregar estado do pânico:', e);
  }
  return null;
}

function clearPanicState(): void {
  localStorage.removeItem(PANIC_STORAGE_KEY);
}

const PANIC_TIMEOUT_MS = 1800000; // 30 minutes auto-timeout
const HOLD_DURATION_MS = 1000; // 1 second hold to activate
const CANCEL_DEBOUNCE_MS = 5000; // 5 seconds before cancel is allowed

const PanicContext = createContext<PanicContextValue | null>(null);

export function PanicProvider({ children }: { children: React.ReactNode }) {
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
  const restoredRef = useRef(false);

  // Restaurar estado do localStorage no mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const saved = loadPanicState();
    if (saved?.isPanicActive) {
      const elapsedMs = Date.now() - saved.panicStartTime;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      
      // Verificar se não passou do timeout de 30 minutos
      if (elapsedMs < PANIC_TIMEOUT_MS) {
        console.log('Restaurando estado do pânico:', elapsedSeconds, 'segundos decorridos');
        
        startTimeRef.current = saved.panicStartTime;
        canCancelRef.current = true; // Já passou tempo suficiente
        
        // Restaurar estado
        setState({
          isPanicActive: true,
          panicDuration: elapsedSeconds,
          isActivating: false,
          isSendingToServer: false,
          location: saved.location,
          protocolNumber: saved.protocolNumber,
          guardiansNotified: saved.guardiansNotified,
        });
        
        // Reiniciar recording e location tracking
        startRecording('botao_panico');
        location.startTracking(true);
        
        // Reiniciar timer de duração
        timerRef.current = setInterval(() => {
          setState(prev => ({ ...prev, panicDuration: prev.panicDuration + 1 }));
        }, 1000);
        
        // Reiniciar timeout (tempo restante)
        const remainingTime = PANIC_TIMEOUT_MS - elapsedMs;
        timeoutRef.current = setTimeout(() => {
          deactivatePanicInternal('timeout');
        }, remainingTime);
      } else {
        // Timeout já passou, limpar estado
        console.log('Pânico expirado, limpando estado');
        clearPanicState();
      }
    }
  }, []);

  // Função interna para deactivate (evita dependência circular)
  const deactivatePanicInternal = useCallback(async (
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

    // Limpar localStorage
    clearPanicState();

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

    const panicStartTime = Date.now();
    startTimeRef.current = panicStartTime;
    canCancelRef.current = false;

    // Salvar no localStorage
    savePanicState({
      isPanicActive: true,
      panicStartTime,
      protocolNumber: result.data?.numero_protocolo || null,
      location: { lat, lng },
      guardiansNotified: result.data?.guardioes_notificados || 0,
    });

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
      deactivatePanicInternal('timeout');
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
  }, [location, startRecording, deactivatePanicInternal]);

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

  const value: PanicContextValue = {
    ...state,
    isRecording,
    startHold,
    cancelHold,
    activatePanic,
    deactivatePanic: deactivatePanicInternal,
    canCancel,
  };

  return (
    <PanicContext.Provider value={value}>
      {children}
    </PanicContext.Provider>
  );
}

export function usePanicContext() {
  const context = useContext(PanicContext);
  if (!context) {
    throw new Error('usePanicContext must be used within a PanicProvider');
  }
  return context;
}
