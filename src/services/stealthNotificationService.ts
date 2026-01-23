/**
 * Stealth Notification Service
 * Manages the persistent disguised notification for monitoring
 * Now uses ForegroundService for true background operation on Android
 */

import { Capacitor } from '@capacitor/core';
import { backgroundService } from './backgroundService';

class StealthNotificationService {
  private isShowing = false;

  /**
   * Request permission for notifications
   * For ForegroundService, Android handles this automatically
   */
  async requestPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[StealthNotification] Skipping - not native platform');
      return false;
    }
    // ForegroundService doesn't require explicit notification permission request
    // The FOREGROUND_SERVICE permission in AndroidManifest.xml handles this
    return true;
  }

  /**
   * Check if permission is granted
   */
  async checkPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    return true;
  }

  /**
   * Show the monitoring notification (starts foreground service)
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

    try {
      const started = await backgroundService.start();
      if (started) {
        this.isShowing = true;
        console.log('[StealthNotification] Foreground service started');
      }
    } catch (error) {
      console.error('[StealthNotification] Error showing notification:', error);
    }
  }

  /**
   * Hide the monitoring notification (stops foreground service)
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
      await backgroundService.stop();
      this.isShowing = false;
      console.log('[StealthNotification] Foreground service stopped');
    } catch (error) {
      console.error('[StealthNotification] Error hiding notification:', error);
    }
  }

  /**
   * Update notification text
   */
  async updateNotificationText(title?: string, body?: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || !this.isShowing) {
      return;
    }

    try {
      await backgroundService.updateText(title, body);
      console.log('[StealthNotification] Notification updated');
    } catch (error) {
      console.error('[StealthNotification] Error updating notification:', error);
    }
  }

  /**
   * Check if notification is showing
   */
  isNotificationShowing(): boolean {
    return this.isShowing;
  }
}

// Export singleton instance
export const stealthNotificationService = new StealthNotificationService();
