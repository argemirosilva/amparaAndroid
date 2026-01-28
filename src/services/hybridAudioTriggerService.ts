/**
 * Hybrid Audio Trigger Service
 * Manages both JavaScript (foreground) and Native (background) audio triggers
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import AudioTriggerNative from '@/plugins/audioTriggerNative';
import type { AudioTriggerEvent } from '@/plugins/audioTriggerNative';

class HybridAudioTriggerService {
  private isNativeRunning = false;
  private isJavaScriptRunning = false;
  private appIsActive = true;
  
  private eventListeners: Array<(event: AudioTriggerEvent) => void> = [];
  private jsStartCallback: (() => Promise<void>) | null = null;
  private jsStopCallback: (() => Promise<void>) | null = null;
  private nativeConfig: any = null;
  
  constructor() {
    this.init();
  }
  
  private async init() {
    if (!Capacitor.isNativePlatform()) {
      console.log('[HybridAudioTrigger] Not on native platform, skipping');
      return;
    }
    
    // Listen to app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('[HybridAudioTrigger] App state changed:', isActive ? 'active' : 'background');
      this.appIsActive = isActive;
      this.handleStateChange();
    });
    
    // Listen to native audio trigger events
    AudioTriggerNative.addListener('audioTriggerEvent', (event) => {
      console.log('[HybridAudioTrigger] Native event received:', event);
      this.notifyListeners(event);
    });
    
    console.log('[HybridAudioTrigger] Initialized');
  }
  
  /**
   * Start audio monitoring
   * Automatically switches between JavaScript and Native based on app state
   */
  async start() {
    console.log('[HybridAudioTrigger] Starting audio monitoring');
    
    if (this.appIsActive) {
      // App is in foreground - use JavaScript (more sophisticated)
      await this.startJavaScript();
    } else {
      // App is in background - use Native (works in Doze Mode)
      await this.startNative();
    }
  }
  
  /**
   * Stop audio monitoring
   */
  async stop() {
    console.log('[HybridAudioTrigger] Stopping audio monitoring');
    await this.stopJavaScript();
    await this.stopNative();
  }
  
  private async startJavaScript() {
    if (this.isJavaScriptRunning) {
      console.log('[HybridAudioTrigger] JavaScript already running');
      return;
    }
    
    console.log('[HybridAudioTrigger] Starting JavaScript audio trigger');
    
    // Stop native if running
    if (this.isNativeRunning) {
      await this.stopNative();
    }
    
    // Call JavaScript start callback if registered
    if (this.jsStartCallback) {
      try {
        await this.jsStartCallback();
        this.isJavaScriptRunning = true;
        console.log('[HybridAudioTrigger] JavaScript audio trigger started via callback');
      } catch (error) {
        console.error('[HybridAudioTrigger] Error starting JavaScript audio trigger:', error);
      }
    } else {
      console.warn('[HybridAudioTrigger] No JavaScript start callback registered');
      this.isJavaScriptRunning = true;
    }
  }
  
  private async stopJavaScript() {
    if (!this.isJavaScriptRunning) return;
    
    console.log('[HybridAudioTrigger] Stopping JavaScript audio trigger');
    
    // Call JavaScript stop callback if registered
    if (this.jsStopCallback) {
      try {
        await this.jsStopCallback();
        console.log('[HybridAudioTrigger] JavaScript audio trigger stopped via callback');
      } catch (error) {
        console.error('[HybridAudioTrigger] Error stopping JavaScript audio trigger:', error);
      }
    }
    
    this.isJavaScriptRunning = false;
  }
  
  private async startNative() {
    if (this.isNativeRunning) {
      console.log('[HybridAudioTrigger] Native already running');
      return;
    }
    
    if (!Capacitor.isNativePlatform()) {
      console.log('[HybridAudioTrigger] Cannot start native on web platform');
      return;
    }
    
    try {
      console.log('[HybridAudioTrigger] Starting native audio trigger');
      
      // Pass configuration if available
      const options = this.nativeConfig ? { config: this.nativeConfig } : {};
      const result = await AudioTriggerNative.start(options);
      
      if (result.success) {
        this.isNativeRunning = true;
        console.log('[HybridAudioTrigger] Native audio trigger started successfully');
      } else {
        console.error('[HybridAudioTrigger] Failed to start native audio trigger');
      }
    } catch (error) {
      console.error('[HybridAudioTrigger] Error starting native audio trigger:', error);
    }
  }
  
  private async stopNative() {
    if (!this.isNativeRunning) return;
    
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      console.log('[HybridAudioTrigger] Stopping native audio trigger');
      await AudioTriggerNative.stop();
      this.isNativeRunning = false;
      console.log('[HybridAudioTrigger] Native audio trigger stopped');
    } catch (error) {
      console.error('[HybridAudioTrigger] Error stopping native audio trigger:', error);
    }
  }
  
  private async handleStateChange() {
    // When app goes to background, switch to native
    if (!this.appIsActive && this.isJavaScriptRunning) {
      console.log('[HybridAudioTrigger] Switching to native (background)');
      await this.stopJavaScript();
      await this.startNative();
    }
    
    // When app comes to foreground, switch to JavaScript
    if (this.appIsActive && this.isNativeRunning) {
      console.log('[HybridAudioTrigger] Switching to JavaScript (foreground)');
      await this.stopNative();
      await this.startJavaScript();
    }
  }
  
  /**
   * Add listener for audio trigger events (from both JS and Native)
   */
  addListener(callback: (event: AudioTriggerEvent) => void) {
    this.eventListeners.push(callback);
  }
  
  /**
   * Remove listener
   */
  removeListener(callback: (event: AudioTriggerEvent) => void) {
    const index = this.eventListeners.indexOf(callback);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }
  
  private notifyListeners(event: AudioTriggerEvent) {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[HybridAudioTrigger] Error in event listener:', error);
      }
    });
  }
  
  /**
   * Register callbacks to control JavaScript audio trigger
   */
  registerJavaScriptCallbacks(start: () => Promise<void>, stop: () => Promise<void>) {
    this.jsStartCallback = start;
    this.jsStopCallback = stop;
    console.log('[HybridAudioTrigger] JavaScript callbacks registered');
  }
  
  /**
   * Set configuration for native audio trigger
   */
  setNativeConfig(config: any) {
    this.nativeConfig = config;
    console.log('[HybridAudioTrigger] Native config set:', config);
  }
  
  getStatus() {
    return {
      isNativeRunning: this.isNativeRunning,
      isJavaScriptRunning: this.isJavaScriptRunning,
      appIsActive: this.appIsActive
    };
  }
}

// Export singleton instance
export const hybridAudioTrigger = new HybridAudioTriggerService();
