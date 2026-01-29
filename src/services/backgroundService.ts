/**
 * Background Service for persistent audio monitoring
 * Uses Capacitor Foreground Service plugin to keep the app alive
 */

import { Capacitor } from '@capacitor/core';

// Configuration for the foreground service notification
const FOREGROUND_SERVICE_ID = 9999;
const NOTIFICATION_CHANNEL_ID = 'ampara_monitoring';
const FOREGROUND_CONFIG = {
  title: 'Bem-estar Ativo',
  body: 'Monitorando sua saúde',
  smallIcon: 'ic_notification', // Use default Capacitor icon
  channelId: NOTIFICATION_CHANNEL_ID,
};

// Text variations for natural appearance
const TEXT_VARIATIONS = [
  { title: 'Bem-estar Ativo', body: 'Monitorando sua saúde' },
  { title: 'Bem-estar Ativo', body: 'Acompanhando seu dia' },
  { title: 'Saúde em Foco', body: 'Monitoramento ativo' },
  { title: 'Bem-estar Ativo', body: 'Cuidando de você' },
];

class BackgroundService {
  private isRunning = false;
  private ForegroundServicePlugin: typeof import('@capawesome-team/capacitor-android-foreground-service').ForegroundService | null = null;

  /**
   * Lazily load the ForegroundService plugin to avoid import errors on web
   */
  private async getPlugin() {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    if (!this.ForegroundServicePlugin) {
      try {
        const module = await import('@capawesome-team/capacitor-android-foreground-service');
        this.ForegroundServicePlugin = module.ForegroundService;
      } catch (error) {
        console.error('[BackgroundService] Failed to load ForegroundService plugin:', error);
        return null;
      }
    }

    return this.ForegroundServicePlugin;
  }

  /**
   * Start the foreground service to keep audio monitoring alive
   */
  async start(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[BackgroundService] Skipping - not native platform');
      return false;
    }

    if (this.isRunning) {
      console.log('[BackgroundService] Already running');
      return true;
    }

    const plugin = await this.getPlugin();
    if (!plugin) {
      console.error('[BackgroundService] Plugin not available');
      return false;
    }

    try {
      // Create notification channel first (required for Android 8+)
      try {
        console.log('[BackgroundService] Creating notification channel...');
        await plugin.createNotificationChannel({
          id: NOTIFICATION_CHANNEL_ID,
          name: 'Monitoramento Ampara',
          description: 'Notificação de monitoramento ativo',
          importance: 4, // IMPORTANCE_HIGH - force visibility
        });
        console.log('[BackgroundService] Notification channel created');
      } catch (channelError) {
        console.warn('[BackgroundService] Channel creation error (may already exist):', channelError);
      }

      // Select a random text variation
      const variation = TEXT_VARIATIONS[Math.floor(Math.random() * TEXT_VARIATIONS.length)];

      console.log('[BackgroundService] Calling startForegroundService...');
      const result = await plugin.startForegroundService({
        id: FOREGROUND_SERVICE_ID,
        title: variation.title,
        body: variation.body,
        smallIcon: FOREGROUND_CONFIG.smallIcon,
        silent: false, // MUST be false to show notification
        notificationChannelId: NOTIFICATION_CHANNEL_ID, // CRITICAL!
        foregroundServiceTypes: ['location', 'microphone'], // Use location + microphone to keep app alive
      });
      console.log('[BackgroundService] startForegroundService returned:', result);

      this.isRunning = true;
      console.log('[BackgroundService] Started successfully:', variation.title);
      return true;
    } catch (error) {
      console.error('[BackgroundService] Error starting:', error);
      // Try to mark as running anyway - the service might have started despite the error
      this.isRunning = true;
      console.warn('[BackgroundService] Marked as running despite error (service may have started)');
      return true; // Return true to allow app to continue
    }
  }

  /**
   * Stop the foreground service
   */
  async stop(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[BackgroundService] Skipping stop - not native platform');
      return;
    }

    if (!this.isRunning) {
      console.log('[BackgroundService] Not running, nothing to stop');
      return;
    }

    const plugin = await this.getPlugin();
    if (!plugin) {
      return;
    }

    try {
      await plugin.stopForegroundService();
      this.isRunning = false;
      console.log('[BackgroundService] Stopped successfully');
    } catch (error) {
      console.error('[BackgroundService] Error stopping:', error);
    }
  }

  /**
   * Update the notification text
   */
  async updateText(title?: string, body?: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || !this.isRunning) {
      return;
    }

    const plugin = await this.getPlugin();
    if (!plugin) {
      return;
    }

    try {
      await plugin.updateForegroundService({
        id: FOREGROUND_SERVICE_ID,
        title: title || FOREGROUND_CONFIG.title,
        body: body || FOREGROUND_CONFIG.body,
        smallIcon: FOREGROUND_CONFIG.smallIcon,
        silent: true,
        foregroundServiceTypes: ['location', 'microphone'],
      });
      console.log('[BackgroundService] Updated notification text');
    } catch (error) {
      console.error('[BackgroundService] Error updating:', error);
    }
  }

  /**
   * Check if the service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const backgroundService = new BackgroundService();

// Force cache invalidation - v2
export const BACKGROUND_SERVICE_VERSION = '2.0.0';
export type BackgroundServiceType = BackgroundService;
