import { useEffect, useRef, useCallback } from 'react';
import { stealthNotificationService } from '@/services/stealthNotificationService';

interface UseStealthNotificationOptions {
  /** Se true, exibe a notificação automaticamente */
  autoShow?: boolean;
}

/**
 * Hook para gerenciar a notificação persistente disfarçada
 * 
 * A notificação aparece como "Bem-estar Ativo - Monitorando sua saúde"
 * para disfarçar o verdadeiro propósito do app.
 */
export function useStealthNotification(
  isMonitoring: boolean,
  options: UseStealthNotificationOptions = {}
) {
  const { autoShow = true } = options;
  const wasMonitoringRef = useRef(false);

  const show = useCallback(async () => {
    await stealthNotificationService.showMonitoringNotification();
  }, []);

  const hide = useCallback(async () => {
    await stealthNotificationService.hideMonitoringNotification();
  }, []);

  const updateText = useCallback(async (title?: string, body?: string) => {
    await stealthNotificationService.updateNotificationText(title, body);
  }, []);

  // Auto-gerencia a notificação baseado no status de monitoramento
  useEffect(() => {
    if (!autoShow) return;

    const handleMonitoringChange = async () => {
      if (isMonitoring && !wasMonitoringRef.current) {
        // Monitoramento iniciou
        console.log('[useStealthNotification] Monitoring started, showing notification');
        await show();
      } else if (!isMonitoring && wasMonitoringRef.current) {
        // Monitoramento parou
        console.log('[useStealthNotification] Monitoring stopped, hiding notification');
        await hide();
      }
      wasMonitoringRef.current = isMonitoring;
    };

    handleMonitoringChange();
  }, [isMonitoring, autoShow, show, hide]);

  // Limpa a notificação quando o componente desmonta
  useEffect(() => {
    return () => {
      if (wasMonitoringRef.current) {
        console.log('[useStealthNotification] Cleanup: hiding notification');
        stealthNotificationService.hideMonitoringNotification();
      }
    };
  }, []);

  return {
    show,
    hide,
    updateText,
    isShowing: stealthNotificationService.isNotificationShowing(),
  };
}
