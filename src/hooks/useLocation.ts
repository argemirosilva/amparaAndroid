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
const DEFAULT_INTERVAL_PANIC = 30 * 1000;      // 30 seconds

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
  const isPanicModeRef = useRef(false);

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
  const getCurrentPosition = useCallback(async (): Promise<{ latitude: number; longitude: number; accuracy: number } | null> => {
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
  const sendLocation = useCallback(async (): Promise<boolean> => {
    const position = await getCurrentPosition();
    
    if (!position) return false;

    const { latitude, longitude, accuracy } = position;

    setState(prev => ({
      ...prev,
      latitude,
      longitude,
      accuracy,
      lastUpdate: new Date().toISOString(),
      error: null,
    }));

    const result = await enviarLocalizacaoGPS(latitude, longitude);
    
    if (result.error) {
      console.error('Failed to send location:', result.error);
      return false;
    }

    return true;
  }, [getCurrentPosition]);

  // Start periodic location tracking
  const startTracking = useCallback((panicMode: boolean = false) => {
    isPanicModeRef.current = panicMode;
    
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Send immediately
    sendLocation();

    // Set interval based on mode
    const interval = panicMode ? intervalPanic : intervalNormal;
    intervalRef.current = setInterval(sendLocation, interval);

    setState(prev => ({ ...prev, isTracking: true }));
  }, [sendLocation, intervalNormal, intervalPanic]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    isPanicModeRef.current = false;
    setState(prev => ({ ...prev, isTracking: false }));
  }, []);

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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

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
