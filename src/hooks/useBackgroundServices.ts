/**
 * useBackgroundServices Hook
 * Manages connectivity and config services lifecycle
 * Integrates with Foreground Service for background operation
 */

import { useEffect, useState } from 'react';
import { 
  startPingService, 
  stopPingService, 
  getConnectivityState, 
  subscribeToConnectivity,
  type ConnectivityState 
} from '@/services/connectivityService';
import { 
  initializeConfigService, 
  startConfigSync, 
  stopConfigSync, 
  getConfigState, 
  subscribeToConfig,
  reloadConfigFromCache,
  type ConfigState 
} from '@/services/configService';
import { 
  startLocationTracking, 
  stopLocationTracking 
} from '@/services/locationService';
import { backgroundService, BACKGROUND_SERVICE_VERSION } from '@/services/backgroundService';

export interface BackgroundServicesState {
  connectivity: ConnectivityState;
  config: ConfigState;
  isInitialized: boolean;
}

export function useBackgroundServices() {
  const [state, setState] = useState<BackgroundServicesState>({
    connectivity: getConnectivityState(),
    config: getConfigState(),
    isInitialized: false
  });

  // Initialize services on mount
  useEffect(() => {
    console.log('[useBackgroundServices] Initializing services...');

    let mounted = true;

    const init = async () => {
      try {
        // Start foreground service FIRST (critical for background survival)
        console.log('[useBackgroundServices] Starting foreground service v' + BACKGROUND_SERVICE_VERSION + '...');
        const startResult = await backgroundService.start();
        console.log('[useBackgroundServices] Foreground service start result:', startResult);
        console.log('[useBackgroundServices] Service running state:', backgroundService.isServiceRunning());

        if (!mounted) return;

        // Initialize config service (loads from cache immediately)
        await initializeConfigService();

        if (!mounted) return;

        // Start connectivity monitoring
        startPingService();

        // Start periodic config sync (every 1 hour)
        startConfigSync(3600000);

        // Start passive location tracking (justifies foreground service)
        startLocationTracking();

        setState(prev => ({ ...prev, isInitialized: true }));
        console.log('[useBackgroundServices] Services initialized');

      } catch (error) {
        console.error('[useBackgroundServices] Initialization error:', error);
      }
    };

    init();

    // Subscribe to connectivity changes
    const unsubConnectivity = subscribeToConnectivity((connState) => {
      if (mounted) {
        setState(prev => ({ ...prev, connectivity: connState }));
      }
    });

    // Subscribe to config changes
    const unsubConfig = subscribeToConfig((configState) => {
      if (mounted) {
        setState(prev => ({ ...prev, config: configState }));
      }
    });

    // Cleanup on unmount
    return () => {
      mounted = false;
      console.log('[useBackgroundServices] Cleaning up services...');
      stopPingService();
      stopConfigSync();
      stopLocationTracking();
      backgroundService.stop();
      unsubConnectivity();
      unsubConfig();
    };
  }, []);

  // Handle app visibility changes (Android lifecycle)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[useBackgroundServices] App became visible, reloading config from cache...');
        await reloadConfigFromCache();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return state;
}
