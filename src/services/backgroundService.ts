/**
 * Background Service for persistent audio monitoring
 * Uses Capacitor Foreground Service plugin to keep the app alive
 */

import { Capacitor } from '@capacitor/core';

// Configuration for the foreground service notification
const FOREGROUND_SERVICE_ID = 9999;
const FOREGROUND_CONFIG = {
  title: 'Bem-estar Ativo',
  body: 'Monitorando sua saúde',
  smallIcon: 'ic_stat_hearing',
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
      // Select a random text variation
      const variation = TEXT_VARIATIONS[Math.floor(Math.random() * TEXT_VARIATIONS.length)];

      await plugin.startForegroundService({
        id: FOREGROUND_SERVICE_ID,
        title: variation.title,
        body: variation.body,
        smallIcon: FOREGROUND_CONFIG.smallIcon,
        silent: true,
      });

      this.isRunning = true;
      console.log('[BackgroundService] Started successfully:', variation.title);
      return true;
    } catch (error) {
      console.error('[BackgroundService] Error starting:', error);
      return false;
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
