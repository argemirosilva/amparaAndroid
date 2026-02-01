/**
 * Background State Manager
 * Ensures critical data is available when app is in background
 * Prevents data loss due to Android memory management
 * Uses WakeLock to keep JavaScript executing in background
 */

import { reloadSession } from './sessionService';
import { reloadConfigFromCache } from './configService';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// ============================================
// State Tracking
// ============================================

let isInBackground = false;
let lastReloadTime = 0;
const RELOAD_INTERVAL_MS = 60000; // Reload every 60 seconds when in background

// ============================================
// Visibility Detection
// ============================================

/**
 * Initialize background state detection
 */
export function initializeBackgroundStateManager(): void {
  console.log('[BackgroundStateManager] Initializing...');
  
  // Track app visibility via DOM (fallback)
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Track app state via Capacitor (native)
  if (Capacitor.isNativePlatform()) {
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('[BackgroundStateManager] Native state changed: isActive =', isActive);
      handleStateChange(!isActive);
    });
  }
  
  // Initial state
  isInBackground = document.visibilityState === 'hidden';
  console.log('[BackgroundStateManager] Initial state:', isInBackground ? 'background' : 'foreground');
}

/**
 * Handle visibility change from DOM
 */
async function handleVisibilityChange(): Promise<void> {
  handleStateChange(document.visibilityState === 'hidden');
}

/**
 * Unified state change handler
 */
async function handleStateChange(newInBackground: boolean): Promise<void> {
  const wasInBackground = isInBackground;
  isInBackground = newInBackground;
  
  if (wasInBackground !== isInBackground) {
    console.log('[BackgroundStateManager] State transition:', wasInBackground ? 'background' : 'foreground', '->', isInBackground ? 'background' : 'foreground');
    
    if (isInBackground) {
      // Going to background - acquire WakeLock to keep JavaScript running
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.keepAwake();
          console.log('[BackgroundStateManager] WakeLock acquired - JavaScript will stay active');
        } catch (error) {
          console.error('[BackgroundStateManager] Failed to acquire WakeLock:', error);
        }
      }
    } else {
      // Coming back to foreground - release WakeLock and force reload
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.allowSleep();
          console.log('[BackgroundStateManager] WakeLock released');
        } catch (error) {
          console.error('[BackgroundStateManager] Failed to release WakeLock:', error);
        }
      }
      
      console.log('[BackgroundStateManager] Returning to foreground, forcing reload and ping...');
      
      // Force immediate data reload
      await ensureCriticalDataAvailable(true);
      

    }
  }
}

// ============================================
// Critical Data Management
// ============================================

/**
 * Ensure critical data is loaded from storage
 * Call this before any critical operation in background
 */
export async function ensureCriticalDataAvailable(force = false): Promise<boolean> {
  const now = Date.now();
  const timeSinceLastReload = now - lastReloadTime;
  
  // Skip if recently reloaded (unless forced)
  if (!force && timeSinceLastReload < RELOAD_INTERVAL_MS) {
    return true;
  }
  
  try {
    console.log('[BackgroundStateManager] Reloading critical data from storage...');
    
    // Import getSessionToken for logging
    const { getSessionToken } = await import('./sessionService');
    console.log('[BackgroundStateManager] Before reload - Has token:', !!getSessionToken());
    
    // Reload session (token + user data)
    const sessionReloaded = await reloadSession();
    console.log('[BackgroundStateManager] After reload - Session reloaded:', sessionReloaded, '| Has token:', !!getSessionToken());
    if (!sessionReloaded) {
      console.warn('[BackgroundStateManager] Failed to reload session');
      return false;
    }
    
    // Reload config from cache
    await reloadConfigFromCache();
    
    lastReloadTime = now;
    console.log('[BackgroundStateManager] Critical data reloaded successfully');
    return true;
    
  } catch (error) {
    console.error('[BackgroundStateManager] Failed to reload critical data:', error);
    return false;
  }
}

/**
 * Check if app is currently in background
 */
export function isAppInBackground(): boolean {
  return isInBackground;
}

/**
 * Get time since last reload
 */
export function getTimeSinceLastReload(): number {
  return Date.now() - lastReloadTime;
}

/**
 * Force immediate reload of critical data
 */
export async function forceReload(): Promise<boolean> {
  console.log('[BackgroundStateManager] Force reload requested');
  return ensureCriticalDataAvailable(true);
}
