import { useEffect, useRef, useCallback } from 'react';
import { backgroundService } from '@/services/backgroundService';
import { Capacitor } from '@capacitor/core';

interface UseStealthNotificationOptions {
  /** Se true, exibe a notificação automaticamente */
  autoShow?: boolean;
}

/**
 * Hook para gerenciar a notificação persistente disfarçada
 * Usa ForegroundService para manter o app ativo em background no Android
 */
export function useStealthNotification(
  isMonitoring: boolean,
  options: UseStealthNotificationOptions = {}
) {
  const { autoShow = true } = options;
  const wasMonitoringRef = useRef(false);

  const show = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await backgroundService.start();
  }, []);

  const hide = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await backgroundService.stop();
  }, []);

  const updateText = useCallback(async (title?: string, body?: string) => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await backgroundService.updateText(title, body);
  }, []);

  // Auto-manage notification based on monitoring status
  useEffect(() => {
    if (!autoShow) return;

    const handleMonitoringChange = async () => {
      if (isMonitoring && !wasMonitoringRef.current) {
        // Monitoring started
        console.log('[useStealthNotification] Monitoring started, starting foreground service');
        await show();
      } else if (!isMonitoring && wasMonitoringRef.current) {
        // Monitoring stopped
        console.log('[useStealthNotification] Monitoring stopped, stopping foreground service');
        await hide();
      }
      wasMonitoringRef.current = isMonitoring;
    };

    handleMonitoringChange();
  }, [isMonitoring, autoShow, show, hide]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wasMonitoringRef.current) {
        console.log('[useStealthNotification] Cleanup: stopping foreground service');
        backgroundService.stop();
      }
    };
  }, []);

  return {
    show,
    hide,
    updateText,
    isShowing: backgroundService.isServiceRunning(),
  };
}
