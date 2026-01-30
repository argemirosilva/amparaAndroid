/**
 * Hybrid Audio Trigger Service - v2 Robust State Machine
 * 
 * Manages audio trigger mode switching between:
 * - JS/WebAudio (foreground)
 * - Native AudioTriggerService (background/lock)
 * 
 * Features:
 * - Permission flow gates (blocks start during onboarding)
 * - Callback registration validation
 * - Idempotent operations
 * - Debounced transitions
 * - Clear state reporting for UI
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import AudioPermission from '@/plugins/audioPermission';
import { AudioTriggerNative } from '@/plugins/audioTriggerNative';
import type { AudioTriggerEvent } from '@/plugins/audioTriggerNative';
import { PermissionFlowState } from './permissionFlowState';

// State machine modes
type TriggerMode = 
  | 'STOPPED'                  // Not started
  | 'WAITING_PERMISSION'       // Waiting for RECORD_AUDIO
  | 'WAITING_JS_CALLBACKS'     // Waiting for JS callbacks registration
  | 'JS'                       // JS/WebAudio active
  | 'NATIVE';                  // Native service active

// JS Callbacks interface
interface JsCallbacks {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  onFirstFrame?: (data: any) => void;
  onDebug?: (data: any) => void;
}

// State machine class
class HybridAudioTriggerService {
  // State
  private mode: TriggerMode = 'STOPPED';
  private pendingStart = false;
  private transitionLock = false;
  private lastTransitionAt = 0;
  private readonly debounceMs = 1500;

  // Callbacks
  private jsCallbacks: JsCallbacks | null = null;
  private hasJsStartCallback = false;
  private hasJsStopCallback = false;

  // Native listener
  private nativeListenerRegistered = false;

  // App state listener
  private appStateListenerRegistered = false;

  // Permission flow listener
  private permissionFlowUnsubscribe: (() => void) | null = null;

  // Initialization flag
  private initialized = false;

  // Event listeners
  private eventListeners: Array<(event: AudioTriggerEvent) => void> = [];

  // Native config
  private nativeConfig: any = null;

  /**
   * Phase 0: Initialize (no audio start)
   */
  init() {
    if (this.initialized) {
      console.log('[HybridAudioTrigger] Already initialized, skipping');
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      console.log('[HybridAudioTrigger] Not on native platform, skipping');
      return;
    }

    console.log('[HybridAudioTrigger] 🔧 Initializing...');
    
    // Register app state listener (once)
    this.registerAppStateListener();
    
    // Register native listener (once)
    this.registerNativeListenerOnce();
    
    // Subscribe to permission flow changes
    this.permissionFlowUnsubscribe = PermissionFlowState.subscribe(() => {
      this.onPermissionFlowChanged();
    });

    this.initialized = true;
    console.log('[HybridAudioTrigger] ✅ Initialized');
  }

  /**
   * Phase 3: Register JS callbacks (idempotent)
   */
  registerJavaScriptCallbacks(callbacks: JsCallbacks, force = false) {
    // Check if already registered
    if (this.hasJsStartCallback && this.hasJsStopCallback && !force) {
      console.log('[HybridAudioTrigger] ✅ JS_CALLBACKS_ALREADY_REGISTERED - skipping');
      return;
    }

    // Validate callbacks
    if (!callbacks.start || !callbacks.stop) {
      console.error('[HybridAudioTrigger] ❌ Invalid callbacks: start and stop are required');
      return;
    }

    // Register
    this.jsCallbacks = callbacks;
    this.hasJsStartCallback = true;
    this.hasJsStopCallback = true;

    console.log('[HybridAudioTrigger] ✅ JavaScript callbacks registered');

    // If we were waiting for callbacks, try to start now
    if (this.mode === 'WAITING_JS_CALLBACKS' && this.pendingStart) {
      console.log('[HybridAudioTrigger] 🔄 Callbacks ready, retrying start...');
      this.start();
    }
  }

  /**
   * Phase 4: Start audio trigger (with gates)
   */
  async start(config?: any) {
    console.log('[HybridAudioTrigger] 🚀 start() called');

    // Store config if provided
    if (config) {
      this.nativeConfig = config;
    }

    // Gate 1: Permission flow
    if (PermissionFlowState.isInFlow()) {
      console.log('[HybridAudioTrigger] 🚫 BLOCKED_BY_PERMISSION_FLOW');
      this.pendingStart = true;
      this.mode = 'STOPPED';
      return;
    }

    // Gate 2: RECORD_AUDIO permission
    const permissionStatus = await AudioPermission.checkPermission();
    if (!permissionStatus.granted) {
      console.log('[HybridAudioTrigger] ⏳ WAITING_PERMISSION: RECORD_AUDIO');
      this.pendingStart = true;
      this.mode = 'WAITING_PERMISSION';
      return;
    }

    // Gate 3: Debounce/lock
    if (this.transitionLock) {
      console.log('[HybridAudioTrigger] 🔒 Transition already in progress, ignoring');
      return;
    }

    const now = Date.now();
    if (now - this.lastTransitionAt < this.debounceMs) {
      console.log('[HybridAudioTrigger] ⏱️ Debounce active, ignoring');
      return;
    }

    // Clear pending flag
    this.pendingStart = false;

    // Determine target mode based on app state
    const appState = await App.getState();
    const targetMode: TriggerMode = appState.isActive ? 'JS' : 'NATIVE';

    // Transition to target mode
    await this.ensureMode(targetMode);
  }

  /**
   * Stop audio trigger
   */
  async stop() {
    console.log('[HybridAudioTrigger] 🛑 stop() called');

    if (this.mode === 'STOPPED') {
      console.log('[HybridAudioTrigger] Already stopped');
      return;
    }

    await this.ensureMode('STOPPED');
  }

  /**
   * Ensure specific mode (with gates)
   */
  private async ensureMode(targetMode: TriggerMode) {
    // Skip if already in target mode
    if (this.mode === targetMode) {
      console.log(`[HybridAudioTrigger] Already in ${targetMode} mode`);
      return;
    }

    // Gate: Permission flow (except for STOPPED)
    if (targetMode !== 'STOPPED' && PermissionFlowState.isInFlow()) {
      console.log('[HybridAudioTrigger] 🚫 BLOCKED_BY_PERMISSION_FLOW');
      this.pendingStart = true;
      this.mode = 'STOPPED';
      return;
    }

    // Gate: JS callbacks (for JS mode)
    if (targetMode === 'JS' && (!this.hasJsStartCallback || !this.hasJsStopCallback)) {
      console.log('[HybridAudioTrigger] ⏳ WAITING_JS_CALLBACKS');
      this.pendingStart = true;
      this.mode = 'WAITING_JS_CALLBACKS';
      return;
    }

    // Lock transition
    this.transitionLock = true;
    this.lastTransitionAt = Date.now();

    const prevMode = this.mode;
    console.log(`[HybridAudioTrigger] 🔄 MODE_SWITCH: ${prevMode} → ${targetMode}`);

    try {
      // Stop current mode
      await this.stopCurrentMode();

      // Start target mode
      await this.startTargetMode(targetMode);

      // Update mode
      this.mode = targetMode;
      console.log(`[HybridAudioTrigger] ✅ MODE_SWITCH complete: now in ${targetMode}`);

    } catch (error) {
      console.error(`[HybridAudioTrigger] ❌ MODE_SWITCH failed:`, error);
      this.mode = 'STOPPED';
    } finally {
      // Unlock after debounce period
      setTimeout(() => {
        this.transitionLock = false;
      }, this.debounceMs);
    }
  }

  /**
   * Stop current mode
   */
  private async stopCurrentMode() {
    switch (this.mode) {
      case 'JS':
        console.log('[HybridAudioTrigger] 🔴 JS_STOPPING');
        if (this.jsCallbacks?.stop) {
          await this.jsCallbacks.stop();
        }
        console.log('[HybridAudioTrigger] ✅ JS_STOPPED');
        break;

      case 'NATIVE':
        console.log('[HybridAudioTrigger] 🔴 NATIVE_STOPPING');
        await AudioTriggerNative.stop();
        console.log('[HybridAudioTrigger] ✅ NATIVE_STOPPED');
        break;

      case 'STOPPED':
      case 'WAITING_PERMISSION':
      case 'WAITING_JS_CALLBACKS':
        // Nothing to stop
        break;
    }
  }

  /**
   * Start target mode
   */
  private async startTargetMode(targetMode: TriggerMode) {
    switch (targetMode) {
      case 'JS':
        console.log('[HybridAudioTrigger] 🟢 JS_STARTING');
        if (this.jsCallbacks?.start) {
          await this.jsCallbacks.start();
        }
        console.log('[HybridAudioTrigger] ✅ JS_STARTED');
        break;

      case 'NATIVE':
        console.log('[HybridAudioTrigger] 🟢 NATIVE_STARTING');
        const options = this.nativeConfig ? { config: this.nativeConfig } : {};
        await AudioTriggerNative.start(options);
        console.log('[HybridAudioTrigger] ✅ NATIVE_STARTED');
        break;

      case 'STOPPED':
      case 'WAITING_PERMISSION':
      case 'WAITING_JS_CALLBACKS':
        // Nothing to start
        break;
    }
  }

  /**
   * Register app state listener (once)
   */
  private registerAppStateListener() {
    if (this.appStateListenerRegistered) {
      console.log('[HybridAudioTrigger] App state listener already registered');
      return;
    }

    App.addListener('appStateChange', async ({ isActive }) => {
      console.log(`[HybridAudioTrigger] 🔄 App state changed: ${isActive ? 'FOREGROUND' : 'BACKGROUND'}`);

      if (!isActive) {
        // App going to background
        console.log('[HybridAudioTrigger] 🌙 BACKGROUND detected');

        // Check if in permission flow
        if (PermissionFlowState.isInFlow()) {
          console.log('[HybridAudioTrigger] 🚫 BACKGROUND_IGNORED_DUE_PERMISSION_FLOW');
          this.pendingStart = true;
          this.mode = 'STOPPED';
          return;
        }

        // Switch to NATIVE mode
        await this.ensureMode('NATIVE');

      } else {
        // App going to foreground
        console.log('[HybridAudioTrigger] 📱 FOREGROUND detected');

        // If pending start, retry
        if (this.pendingStart) {
          console.log('[HybridAudioTrigger] 🔄 Pending start detected, retrying...');
          await this.start();
        } else {
          // Switch to JS mode
          await this.ensureMode('JS');
        }
      }
    });

    this.appStateListenerRegistered = true;
    console.log('[HybridAudioTrigger] ✅ App state listener registered');
  }

  /**
   * Register native listener (once)
   */
  private registerNativeListenerOnce() {
    if (this.nativeListenerRegistered) {
      console.log('[HybridAudioTrigger] Native listener already registered');
      return;
    }

    AudioTriggerNative.addListener('audioTriggerEvent', (event) => {
      console.log('[HybridAudioTrigger] 📡 Native event:', event);
      
      // Forward to event listeners
      this.notifyListeners(event);
      
      // Forward to JS callback if registered
      if (this.jsCallbacks?.onDebug) {
        this.jsCallbacks.onDebug(event);
      }
    });

    this.nativeListenerRegistered = true;
    console.log('[HybridAudioTrigger] ✅ Native listener registered');
  }

  /**
   * Handle permission flow state changes
   */
  private onPermissionFlowChanged() {
    const inFlow = PermissionFlowState.isInFlow();
    console.log(`[HybridAudioTrigger] 🔄 Permission flow changed: ${inFlow}`);

    if (!inFlow && this.pendingStart) {
      console.log('[HybridAudioTrigger] 🔄 Permission flow ended, retrying start...');
      this.start();
    }
  }

  /**
   * Add listener for audio trigger events
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
   * Set configuration for native audio trigger
   * Hot reload: updates config without restart if native is running
   */
  async setNativeConfig(config: any) {
    this.nativeConfig = config;
    console.log('[HybridAudioTrigger] 🔧 Native config set:', config);
    
    // Hot reload: update config if native is already running
    if (this.mode === 'NATIVE' && Capacitor.isNativePlatform()) {
      try {
        await AudioTriggerNative.updateConfig({ config });
        console.log('[HybridAudioTrigger] ✅ Native config hot-reloaded');
      } catch (error) {
        console.error('[HybridAudioTrigger] ❌ Native config hot-reload failed:', error);
      }
    }
  }

  /**
   * Get current mode (for UI)
   */
  getMode(): TriggerMode {
    return this.mode;
  }

  /**
   * Check if pending start
   */
  isPendingStart(): boolean {
    return this.pendingStart;
  }

  /**
   * Get status (for debugging)
   */
  getStatus() {
    return {
      mode: this.mode,
      pendingStart: this.pendingStart,
      transitionLock: this.transitionLock,
      lastTransitionAt: this.lastTransitionAt,
      hasJsCallbacks: this.hasJsStartCallback && this.hasJsStopCallback,
      nativeListenerRegistered: this.nativeListenerRegistered,
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    console.log('[HybridAudioTrigger] 🧹 Destroying...');
    
    if (this.permissionFlowUnsubscribe) {
      this.permissionFlowUnsubscribe();
    }

    this.stop();
    this.initialized = false;
  }
}

// Export singleton instance
export const hybridAudioTrigger = new HybridAudioTriggerService();
