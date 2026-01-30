/**
 * Hybrid Audio Trigger Service
 * Manages both JavaScript (foreground) and Native (background) audio triggers
 * 
 * State Machine Implementation:
 * - STOPPED: No audio monitoring active
 * - JS: JavaScript/WebAudio monitoring (foreground only)
 * - NATIVE: Native Android service monitoring (background/lock)
 * 
 * Transition Rules:
 * - Foreground → JS mode
 * - Background → NATIVE mode
 * - Debounce: 2s between transitions
 * - No JS start in background (hard block)
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AudioTriggerNative } from '@/plugins/audioTriggerNative';
import type { AudioTriggerEvent } from '@/plugins/audioTriggerNative';

enum Mode {
  STOPPED = 'STOPPED',
  JS = 'JS',
  NATIVE = 'NATIVE'
}

class HybridAudioTriggerService {
  // State machine
  private currentMode: Mode = Mode.STOPPED;
  private transitionInProgress = false;
  private lastTransitionAt = 0;
  private readonly TRANSITION_DEBOUNCE_MS = 2000;
  
  // App state
  private appIsActive = true;
  
  // Event handling
  private eventListeners: Array<(event: AudioTriggerEvent) => void> = [];
  private nativeListenerRegistered = false;
  
  // JavaScript callbacks
  private jsStartCallback: (() => Promise<void>) | null = null;
  private jsStopCallback: (() => Promise<void>) | null = null;
  
  // Native config
  private nativeConfig: any = null;
  
  constructor() {
    this.init();
  }
  
  private async init() {
    if (!Capacitor.isNativePlatform()) {
      console.log('[HybridAudioTrigger] Not on native platform, skipping');
      return;
    }
    
    // Listen to app state changes (SINGLE listener)
    App.addListener('appStateChange', ({ isActive }) => {
      console.log(`[HybridAudioTrigger] 🔄 App state changed: ${isActive ? 'FOREGROUND' : 'BACKGROUND'}`);
      this.appIsActive = isActive;
      this.onAppStateChange(isActive);
    });
    
    console.log('[HybridAudioTrigger] ✅ Initialized');
  }
  
  /**
   * App state change handler - triggers mode transitions
   */
  private async onAppStateChange(isActive: boolean) {
    if (isActive) {
      // Foreground → JS mode
      console.log('[HybridAudioTrigger] 📱 FOREGROUND detected');
      await this.ensureMode(Mode.JS);
    } else {
      // Background → NATIVE mode
      console.log('[HybridAudioTrigger] 🌙 BACKGROUND detected');
      await this.ensureMode(Mode.NATIVE);
    }
  }
  
  /**
   * Ensure the system is in the target mode
   * Handles all transitions with debounce and locks
   */
  private async ensureMode(targetMode: Mode) {
    // Check if already in target mode
    if (this.currentMode === targetMode) {
      console.log(`[HybridAudioTrigger] Already in ${targetMode} mode, skipping`);
      return;
    }
    
    // Check if transition is in progress
    if (this.transitionInProgress) {
      console.warn(`[HybridAudioTrigger] ⚠️ Transition already in progress, ignoring request for ${targetMode}`);
      return;
    }
    
    // Debounce: ignore rapid transitions
    const now = Date.now();
    const timeSinceLastTransition = now - this.lastTransitionAt;
    if (timeSinceLastTransition < this.TRANSITION_DEBOUNCE_MS) {
      console.warn(`[HybridAudioTrigger] ⚠️ Debounce active (${timeSinceLastTransition}ms < ${this.TRANSITION_DEBOUNCE_MS}ms), ignoring transition to ${targetMode}`);
      return;
    }
    
    // Lock transition
    this.transitionInProgress = true;
    this.lastTransitionAt = now;
    
    console.log(`[HybridAudioTrigger] 🔄 MODE_SWITCH: ${this.currentMode} → ${targetMode}`);
    
    try {
      // Stop current mode
      if (this.currentMode === Mode.JS) {
        await this.stopJS();
      } else if (this.currentMode === Mode.NATIVE) {
        await this.stopNative();
      }
      
      // Start target mode
      if (targetMode === Mode.JS) {
        await this.startJS();
      } else if (targetMode === Mode.NATIVE) {
        await this.startNative();
      }
      
      this.currentMode = targetMode;
      console.log(`[HybridAudioTrigger] ✅ MODE_SWITCH complete: now in ${targetMode}`);
    } catch (error) {
      console.error(`[HybridAudioTrigger] ❌ MODE_SWITCH failed:`, error);
    } finally {
      // Unlock transition
      this.transitionInProgress = false;
    }
  }
  
  /**
   * Start audio monitoring
   * Automatically determines mode based on app state
   */
  async start() {
    console.log('[HybridAudioTrigger] 🚀 start() called');
    
    if (this.appIsActive) {
      await this.ensureMode(Mode.JS);
    } else {
      await this.ensureMode(Mode.NATIVE);
    }
  }
  
  /**
   * Stop audio monitoring
   */
  async stop() {
    console.log('[HybridAudioTrigger] 🛑 stop() called');
    await this.ensureMode(Mode.STOPPED);
  }
  
  /**
   * Start JavaScript audio trigger (FOREGROUND ONLY)
   */
  private async startJS() {
    // HARD BLOCK: Never start JS in background
    if (!this.appIsActive) {
      console.error('[HybridAudioTrigger] ❌ BLOCKED: Cannot start JS in background!');
      return;
    }
    
    console.log('[HybridAudioTrigger] 🟢 JS_STARTING');
    
    // Call JavaScript start callback if registered
    if (this.jsStartCallback) {
      try {
        await this.jsStartCallback();
        console.log('[HybridAudioTrigger] ✅ JS_STARTED');
      } catch (error) {
        console.error('[HybridAudioTrigger] ❌ JS_START_FAILED:', error);
        throw error;
      }
    } else {
      console.warn('[HybridAudioTrigger] ⚠️ No JS start callback registered');
    }
  }
  
  /**
   * Stop JavaScript audio trigger
   */
  private async stopJS() {
    console.log('[HybridAudioTrigger] 🔴 JS_STOPPING');
    
    // Call JavaScript stop callback if registered
    if (this.jsStopCallback) {
      try {
        await this.jsStopCallback();
        console.log('[HybridAudioTrigger] ✅ JS_STOPPED');
      } catch (error) {
        console.error('[HybridAudioTrigger] ❌ JS_STOP_FAILED:', error);
      }
    }
  }
  
  /**
   * Start Native audio trigger (BACKGROUND/LOCK)
   */
  private async startNative() {
    if (!Capacitor.isNativePlatform()) {
      console.log('[HybridAudioTrigger] Cannot start native on web platform');
      return;
    }
    
    try {
      // Check RECORD_AUDIO permission before starting
      const AudioPermission = (await import('@/plugins/audioPermission')).default;
      const permissionResult = await AudioPermission.checkPermission();
      
      if (!permissionResult.granted) {
        console.error('[HybridAudioTrigger] ❌ RECORD_AUDIO permission not granted');
        throw new Error('RECORD_AUDIO permission required');
      }
      
      console.log('[HybridAudioTrigger] 🟢 NATIVE_STARTING');
      
      // Register native event listener (ONCE)
      if (!this.nativeListenerRegistered) {
        AudioTriggerNative.addListener('audioTriggerEvent', (event) => {
          console.log('[HybridAudioTrigger] 📡 Native event received:', event);
          this.notifyListeners(event);
        });
        this.nativeListenerRegistered = true;
        console.log('[HybridAudioTrigger] 📡 Native listener registered (once)');
      }
      
      // Pass configuration if available
      const options = this.nativeConfig ? { config: this.nativeConfig } : {};
      const result = await AudioTriggerNative.start(options);
      
      if (result.success) {
        console.log('[HybridAudioTrigger] ✅ NATIVE_STARTED');
      } else {
        console.error('[HybridAudioTrigger] ❌ NATIVE_START_FAILED');
        throw new Error('Native start failed');
      }
    } catch (error) {
      console.error('[HybridAudioTrigger] ❌ NATIVE_START_ERROR:', error);
      throw error;
    }
  }
  
  /**
   * Stop Native audio trigger
   */
  private async stopNative() {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      console.log('[HybridAudioTrigger] 🔴 NATIVE_STOPPING');
      await AudioTriggerNative.stop();
      console.log('[HybridAudioTrigger] ✅ NATIVE_STOPPED');
    } catch (error) {
      console.error('[HybridAudioTrigger] ❌ NATIVE_STOP_ERROR:', error);
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
   * MUST be called once during app initialization
   */
  registerJavaScriptCallbacks(start: () => Promise<void>, stop: () => Promise<void>) {
    if (this.jsStartCallback || this.jsStopCallback) {
      console.warn('[HybridAudioTrigger] ⚠️ JS callbacks already registered, overwriting');
    }
    this.jsStartCallback = start;
    this.jsStopCallback = stop;
    console.log('[HybridAudioTrigger] ✅ JavaScript callbacks registered');
  }
  
  /**
   * Set configuration for native audio trigger
   * Hot reload: updates config without restart if native is running
   */
  async setNativeConfig(config: any) {
    this.nativeConfig = config;
    console.log('[HybridAudioTrigger] 🔧 Native config set:', config);
    
    // Hot reload: update config if native is already running
    if (this.currentMode === Mode.NATIVE && Capacitor.isNativePlatform()) {
      try {
        await AudioTriggerNative.updateConfig({ config });
        console.log('[HybridAudioTrigger] ✅ Native config hot-reloaded');
      } catch (error) {
        console.error('[HybridAudioTrigger] ❌ Native config hot-reload failed:', error);
      }
    }
  }
  
  getStatus() {
    return {
      currentMode: this.currentMode,
      transitionInProgress: this.transitionInProgress,
      appIsActive: this.appIsActive,
      lastTransitionAt: this.lastTransitionAt
    };
  }
}

// Export singleton instance
export const hybridAudioTrigger = new HybridAudioTriggerService();
