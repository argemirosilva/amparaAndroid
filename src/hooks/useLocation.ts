import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { enviarLocalizacaoGPS, getLastKnownLocation } from '@/lib/api';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  lastUpdate: string | null;
  isTracking: boolean;
  error: string | null;
  permissionStatus: 'granted' | 'denied' | 'prompt' | null;
}

interface UseLocationOptions {
  intervalNormal?: number;  // Normal interval in ms (default: 5 min)
  intervalPanic?: number;   // Panic interval in ms (default: 30 sec)
  enableHighAccuracy?: boolean;
}

const DEFAULT_INTERVAL_NORMAL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_INTERVAL_PANIC = 1 * 1000;      // 1 second


export function useLocation(options: UseLocationOptions = {}) {
  const {
    intervalNormal = DEFAULT_INTERVAL_NORMAL,
    intervalPanic = DEFAULT_INTERVAL_PANIC,
    enableHighAccuracy = true,
  } = options;

  const isNative = Capacitor.isNativePlatform();

  const [state, setState] = useState<LocationState>(() => {
    const cached = getLastKnownLocation();
    return {
      latitude: cached?.latitude ?? null,
      longitude: cached?.longitude ?? null,
      accuracy: null,
      lastUpdate: cached?.timestamp ?? null,
      isTracking: false,
      error: null,
      permissionStatus: null,
    };
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<string | null>(null);
  const isPanicModeRef = useRef(false);
  const lastLocationRef = useRef<{ latitude: number; longitude: number; accuracy: number; speed: number | null; heading: number | null; nativeTimestamp: number } | null>(null);
  const lastSentNativeTimestampRef = useRef<number | null>(null);
  const isSendingRef = useRef(false);

  // Check location permission
  const checkPermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    try {
      if (isNative) {
        const status = await Geolocation.checkPermissions();
        const permStatus = status.location === 'granted' ? 'granted'
          : status.location === 'denied' ? 'denied' : 'prompt';
        setState(prev => ({ ...prev, permissionStatus: permStatus }));
        return permStatus;
      }

      // Web fallback
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        const permStatus = result.state as 'granted' | 'denied' | 'prompt';
        setState(prev => ({ ...prev, permissionStatus: permStatus }));
        return permStatus;
      }

      return 'prompt';
    } catch (error) {
      console.warn('Error checking location permission:', error);
      return 'prompt';
    }
  }, [isNative]);

  // Request location permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (isNative) {
        const status = await Geolocation.requestPermissions();
        const granted = status.location === 'granted';
        setState(prev => ({ ...prev, permissionStatus: granted ? 'granted' : 'denied' }));
        return granted;
      }

      // Web fallback - request by trying to get position
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            setState(prev => ({ ...prev, permissionStatus: 'granted' }));
            resolve(true);
          },
          () => {
            setState(prev => ({ ...prev, permissionStatus: 'denied' }));
            resolve(false);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    } catch (error) {
      console.error('Location permission request failed:', error);
      return false;
    }
  }, [isNative]);

  // Get current position using Capacitor or Web API
  const getCurrentPosition = useCallback(async (): Promise<{ latitude: number; longitude: number; accuracy: number; speed: number | null; heading: number | null; nativeTimestamp: number } | null> => {
    try {
      if (isNative) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy,
          timeout: 10000,
          maximumAge: isPanicModeRef.current ? 0 : 60000,
        });

        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed ?? null,
          heading: position.coords.heading ?? null,
          nativeTimestamp: position.timestamp,
        };
      }

      // Web fallback
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          setState(prev => ({ ...prev, error: 'Geolocalização não suportada' }));
          resolve(null);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              speed: position.coords.speed ?? null,
              heading: position.coords.heading ?? null,
              nativeTimestamp: position.timestamp,
            });
          },
          (error) => {
            console.error('Geolocation error:', error);
            setState(prev => ({
              ...prev,
              error: error.message || 'Erro ao obter localização'
            }));
            resolve(null);
          },
          {
            enableHighAccuracy,
            timeout: 10000,
            maximumAge: isPanicModeRef.current ? 0 : 60000,
          }
        );
      });
    } catch (error) {
      console.error('Error getting position:', error);
      setState(prev => ({ ...prev, error: 'Erro ao obter localização' }));
      return null;
    }
  }, [enableHighAccuracy, isNative]);

  // Send location to server
  const sendLocation = useCallback(async (forcedPosition?: { latitude: number; longitude: number; accuracy: number; speed: number | null; heading: number | null; nativeTimestamp: number }): Promise<boolean> => {
    if (isSendingRef.current) return false;

    try {
      isSendingRef.current = true;
      const startTime = performance.now();

      const position = forcedPosition || await getCurrentPosition();
      if (!position) {
        isSendingRef.current = false;
        return false;
      }

      const { latitude, longitude, accuracy, speed, heading, nativeTimestamp } = position;

      // Deduplication: do not resend the EXACT same GPS reading if the sensor hasn't updated
      if (lastSentNativeTimestampRef.current === nativeTimestamp) {
        // console.log('[useLocation] Skipping duplicate GPS send (same native timestamp: ' + nativeTimestamp + ')');
        isSendingRef.current = false;
        return false;
      }

      lastLocationRef.current = position;

      setState(prev => ({
        ...prev,
        latitude,
        longitude,
        accuracy,
        lastUpdate: new Date().toISOString(),
        error: null,
      }));

      // Obter nível de bateria se disponível
      let bateria: number | null = null;
      try {
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          bateria = Math.round(battery.level * 100);
        }
      } catch { /* ignorar */ }

      console.log(`[useLocation] 📡 Sending GPS update (lat: ${latitude.toFixed(6)}, lng: ${longitude.toFixed(6)}, speed: ${speed}, heading: ${heading}) - Panic: ${isPanicModeRef.current}`);

      const result = await enviarLocalizacaoGPS(latitude, longitude, {
        speed: speed,
        heading: heading,
        precisao_metros: accuracy,
        bateria_percentual: bateria,
      });

      const endTime = performance.now();
      console.log(`[useLocation] ✅ GPS update sent in ${(endTime - startTime).toFixed(0)}ms`);

      if (result.error) {
        console.error('[useLocation] Failed to send location:', result.error);
        isSendingRef.current = false;
        return false;
      }

      lastSentNativeTimestampRef.current = nativeTimestamp;
      isSendingRef.current = false;
      return true;
    } catch (error) {
      console.error('[useLocation] Error in sendLocation:', error);
      isSendingRef.current = false;
      return false;
    }
  }, [getCurrentPosition]);

  // Start periodic location tracking
  const startTracking = useCallback(async (panicMode: boolean = false) => {
    isPanicModeRef.current = panicMode;
    console.log(`[useLocation] Starting tracking - Mode: ${panicMode ? 'PANIC' : 'NORMAL'}`);

    // Clear existing
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (watchRef.current) {
      if (isNative) {
        await Geolocation.clearWatch({ id: watchRef.current });
      }
      watchRef.current = null;
    }

    if (panicMode) {
      // PANIC MODE: "Hot GPS" Pattern
      // 1. Keep GPS active and update lastLocationRef as fast as possible
      if (isNative) {
        watchRef.current = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          },
          (position) => {
            if (position) {
              lastLocationRef.current = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                speed: position.coords.speed ?? null,
                heading: position.coords.heading ?? null,
                nativeTimestamp: position.timestamp,
              };
            }
          }
        );
      }

      // 2. Set 1s heartbeat to send whatever location we have
      intervalRef.current = setInterval(() => {
        if (lastLocationRef.current) {
          sendLocation(lastLocationRef.current);
        } else {
          sendLocation(); // Fallback to get it now
        }
      }, intervalPanic);
    } else {
      // NORMAL MODE: Standard interval
      intervalRef.current = setInterval(sendLocation, intervalNormal);
      sendLocation(); // Initial send
    }

    setState(prev => ({ ...prev, isTracking: true }));
  }, [sendLocation, intervalNormal, intervalPanic, isNative]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    console.log('[useLocation] Stopping tracking');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (watchRef.current) {
      if (isNative) {
        await Geolocation.clearWatch({ id: watchRef.current });
      }
      watchRef.current = null;
    }

    isPanicModeRef.current = false;
    setState(prev => ({ ...prev, isTracking: false }));
  }, [isNative]);

  // Switch to panic mode (faster updates)
  const enablePanicMode = useCallback(() => {
    if (state.isTracking) {
      startTracking(true);
    }
  }, [state.isTracking, startTracking]);

  // Switch back to normal mode
  const disablePanicMode = useCallback(() => {
    if (state.isTracking) {
      startTracking(false);
    }
  }, [state.isTracking, startTracking]);

  // Get formatted location string
  const getLocationString = useCallback((): string => {
    if (state.latitude === null || state.longitude === null) {
      return 'Localização indisponível';
    }
    return `${state.latitude.toFixed(6)}, ${state.longitude.toFixed(6)}`;
  }, [state.latitude, state.longitude]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (watchRef.current && isNative) {
        Geolocation.clearWatch({ id: watchRef.current });
      }
    };
  }, [isNative]);

  return {
    ...state,
    checkPermission,
    requestPermission,
    getCurrentPosition,
    sendLocation,
    startTracking,
    stopTracking,
    enablePanicMode,
    disablePanicMode,
    getLocationString,
  };
}
