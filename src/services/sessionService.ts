/**
 * Session Service - Robust session persistence for Android 15
 * Uses Capacitor Preferences as primary storage with localStorage fallback
 */

import { Preferences } from '@capacitor/preferences';
import SecureStorage from '@/plugins/SecureStorage';

const SESSION_KEY = 'ampara_token';
const REFRESH_TOKEN_KEY = 'ampara_refresh_token';
const USER_KEY = 'ampara_user';

// In-memory cache for immediate synchronous access
let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let cachedUser: string | null = null;
let isInitialized = false;

/**
 * Initialize the session service
 * Must be called on app startup
 */
export async function initializeSession(): Promise<void> {
  if (isInitialized) return;
  
  try {
    console.log('[SessionService] Initializing...');
    
    // Try multiple storage sources in order of reliability
    // 1. SecureStorage (native SharedPreferences - most reliable)
    let tokenFromSecure: string | null = null;
    let refreshTokenFromSecure: string | null = null;
    let userFromSecure: string | null = null;
    
    try {
      const [tokenResult, refreshTokenResult, userResult] = await Promise.all([
        SecureStorage.get({ key: SESSION_KEY }),
        SecureStorage.get({ key: REFRESH_TOKEN_KEY }),
        SecureStorage.get({ key: USER_KEY })
      ]);
      tokenFromSecure = tokenResult.value;
      refreshTokenFromSecure = refreshTokenResult.value;
      userFromSecure = userResult.value;
    } catch (e) {
      console.warn('[SessionService] SecureStorage.get failed:', e);
    }
    
    // 2. Capacitor Preferences (fallback)
    let tokenFromPrefs: string | null = null;
    let refreshTokenFromPrefs: string | null = null;
    let userFromPrefs: string | null = null;
    
    try {
      const [tokenResult, refreshTokenResult, userResult] = await Promise.all([
        Preferences.get({ key: SESSION_KEY }),
        Preferences.get({ key: REFRESH_TOKEN_KEY }),
        Preferences.get({ key: USER_KEY })
      ]);
      tokenFromPrefs = tokenResult.value;
      refreshTokenFromPrefs = refreshTokenResult.value;
      userFromPrefs = userResult.value;
    } catch (e) {
      console.warn('[SessionService] Preferences.get failed:', e);
    }
    
    // Fallback to localStorage
    const localToken = localStorage.getItem(SESSION_KEY);
    const localRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const localUser = localStorage.getItem(USER_KEY);
    
    // Fallback to sessionStorage (survives page reloads but not app restarts)
    const sessionToken = sessionStorage.getItem(SESSION_KEY);
    const sessionRefreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    const sessionUser = sessionStorage.getItem(USER_KEY);
    
    // Use first available value (SecureStorage has priority)
    cachedToken = tokenFromSecure || tokenFromPrefs || localToken || sessionToken;
    cachedRefreshToken = refreshTokenFromSecure || refreshTokenFromPrefs || localRefreshToken || sessionRefreshToken;
    cachedUser = userFromSecure || userFromPrefs || localUser || sessionUser;
    
    console.log('[SessionService] Sources - Secure:', !!tokenFromSecure, 'Prefs:', !!tokenFromPrefs, 'Local:', !!localToken, 'Session:', !!sessionToken);
    console.log('[SessionService] Loaded - Token:', !!cachedToken, 'RefreshToken:', !!cachedRefreshToken, 'User:', !!cachedUser);
    
    // Sync all storages if we found data
    if (cachedToken) {
      await syncToken(cachedToken);
    }
    if (cachedRefreshToken) {
      await syncRefreshToken(cachedRefreshToken);
    }
    if (cachedUser) {
      await syncUser(cachedUser);
    }
    
    isInitialized = true;
  } catch (error) {
    console.error('[SessionService] Initialization failed:', error);
    isInitialized = true; // Mark as initialized even on error
  }
}

/**
 * Get the current session token (synchronous)
 */
export function getSessionToken(): string | null {
  console.log('[SessionService] getSessionToken called - Has token:', !!cachedToken, '| Token length:', cachedToken?.length || 0);
  return cachedToken;
}

/**
 * Get the current refresh token (synchronous)
 */
export function getRefreshToken(): string | null {
  console.log('[SessionService] getRefreshToken called - Has refresh token:', !!cachedRefreshToken);
  return cachedRefreshToken;
}

/**
 * Get the current user data (synchronous)
 */
export function getUserData(): string | null {
  return cachedUser;
}

/**
 * Check if user is authenticated (synchronous)
 */
export function isAuthenticated(): boolean {
  return !!cachedToken;
}

/**
 * Set session token with full persistence
 */
export async function setSessionToken(token: string): Promise<void> {
  try {
    console.log('[SessionService] Setting token');
    cachedToken = token;
    await syncToken(token);
  } catch (error) {
    console.error('[SessionService] Failed to set token:', error);
    throw error;
  }
}

/**
 * Set refresh token with full persistence
 */
export async function setRefreshToken(refreshToken: string): Promise<void> {
  try {
    console.log('[SessionService] Setting refresh token');
    cachedRefreshToken = refreshToken;
    await syncRefreshToken(refreshToken);
  } catch (error) {
    console.error('[SessionService] Failed to set refresh token:', error);
    throw error;
  }
}

/**
 * Set user data with full persistence
 */
export async function setUserData(userData: string): Promise<void> {
  try {
    console.log('[SessionService] Setting user data');
    cachedUser = userData;
    await syncUser(userData);
  } catch (error) {
    console.error('[SessionService] Failed to set user data:', error);
    throw error;
  }
}

/**
 * Clear session (logout)
 */
export async function clearSession(): Promise<void> {
  try {
    console.log('[SessionService] Clearing session');
    cachedToken = null;
    cachedRefreshToken = null;
    cachedUser = null;
    
    // Clear from all storages
    try {
      await Promise.all([
        SecureStorage.remove({ key: SESSION_KEY }),
        SecureStorage.remove({ key: REFRESH_TOKEN_KEY }),
        SecureStorage.remove({ key: USER_KEY })
      ]);
    } catch (e) {
      console.warn('[SessionService] SecureStorage.remove failed:', e);
    }
    
    try {
      await Promise.all([
        Preferences.remove({ key: SESSION_KEY }),
        Preferences.remove({ key: REFRESH_TOKEN_KEY }),
        Preferences.remove({ key: USER_KEY })
      ]);
    } catch (e) {
      console.warn('[SessionService] Preferences.remove failed:', e);
    }
    
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('[SessionService] Failed to clear session:', error);
  }
}

/**
 * Sync token to all storages
 */
async function syncToken(token: string): Promise<void> {
  // Store in all available storages for maximum redundancy
  // Priority: SecureStorage (native) > Preferences > localStorage > sessionStorage
  try {
    await SecureStorage.set({ key: SESSION_KEY, value: token });
  } catch (e) {
    console.warn('[SessionService] SecureStorage.set failed for token:', e);
  }
  
  try {
    await Preferences.set({ key: SESSION_KEY, value: token });
  } catch (e) {
    console.warn('[SessionService] Preferences.set failed for token:', e);
  }
  
  localStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(SESSION_KEY, token);
}

/**
 * Sync user data to all storages
 */
async function syncUser(userData: string): Promise<void> {
  // Store in all available storages for maximum redundancy
  try {
    await SecureStorage.set({ key: USER_KEY, value: userData });
  } catch (e) {
    console.warn('[SessionService] SecureStorage.set failed for user:', e);
  }
  
  try {
    await Preferences.set({ key: USER_KEY, value: userData });
  } catch (e) {
    console.warn('[SessionService] Preferences.set failed for user:', e);
  }
  
  localStorage.setItem(USER_KEY, userData);
  sessionStorage.setItem(USER_KEY, userData);
}

/**
 * Force reload session from storage
 * Useful after app resume or visibility change
 */
export async function reloadSession(): Promise<boolean> {
  try {
    console.log('[SessionService] Reloading session...');
    
    // Try multiple sources (SecureStorage first)
    let tokenFromSecure: string | null = null;
    let refreshTokenFromSecure: string | null = null;
    let userFromSecure: string | null = null;
    
    try {
      const [tokenResult, refreshTokenResult, userResult] = await Promise.all([
        SecureStorage.get({ key: SESSION_KEY }),
        SecureStorage.get({ key: REFRESH_TOKEN_KEY }),
        SecureStorage.get({ key: USER_KEY })
      ]);
      tokenFromSecure = tokenResult.value;
      refreshTokenFromSecure = refreshTokenResult.value;
      userFromSecure = userResult.value;
    } catch (e) {
      console.warn('[SessionService] SecureStorage.get failed on reload:', e);
    }
    
    let tokenFromPrefs: string | null = null;
    let refreshTokenFromPrefs: string | null = null;
    let userFromPrefs: string | null = null;
    
    try {
      const [tokenResult, refreshTokenResult, userResult] = await Promise.all([
        Preferences.get({ key: SESSION_KEY }),
        Preferences.get({ key: REFRESH_TOKEN_KEY }),
        Preferences.get({ key: USER_KEY })
      ]);
      tokenFromPrefs = tokenResult.value;
      refreshTokenFromPrefs = refreshTokenResult.value;
      userFromPrefs = userResult.value;
    } catch (e) {
      console.warn('[SessionService] Preferences.get failed on reload:', e);
    }
    
    const localToken = localStorage.getItem(SESSION_KEY);
    const localRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const localUser = localStorage.getItem(USER_KEY);
    const sessionToken = sessionStorage.getItem(SESSION_KEY);
    const sessionRefreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    const sessionUser = sessionStorage.getItem(USER_KEY);
    
    // Use first available (SecureStorage has priority)
    cachedToken = tokenFromSecure || tokenFromPrefs || localToken || sessionToken;
    cachedRefreshToken = refreshTokenFromSecure || refreshTokenFromPrefs || localRefreshToken || sessionRefreshToken;
    cachedUser = userFromSecure || userFromPrefs || localUser || sessionUser;
    
    console.log('[SessionService] Reload sources - Secure:', !!tokenFromSecure, 'Prefs:', !!tokenFromPrefs, 'Local:', !!localToken, 'Session:', !!sessionToken);
    console.log('[SessionService] Reloaded - Token:', !!cachedToken, 'RefreshToken:', !!cachedRefreshToken, 'User:', !!cachedUser);
    
    // If we found data, sync it back to all storages
    if (cachedToken) {
      await syncToken(cachedToken);
    }
    if (cachedRefreshToken) {
      await syncRefreshToken(cachedRefreshToken);
    }
    if (cachedUser) {
      await syncUser(cachedUser);
    }
    
    return !!cachedToken;
  } catch (error) {
    console.error('[SessionService] Reload failed:', error);
    return false;
  }
}

/**
 * Sync refresh token to all storages
 */
async function syncRefreshToken(refreshToken: string): Promise<void> {
  // Store in all available storages for maximum redundancy
  try {
    await SecureStorage.set({ key: REFRESH_TOKEN_KEY, value: refreshToken });
  } catch (e) {
    console.warn('[SessionService] SecureStorage.set failed for refresh token:', e);
  }
  
  try {
    await Preferences.set({ key: REFRESH_TOKEN_KEY, value: refreshToken });
  } catch (e) {
    console.warn('[SessionService] Preferences.set failed for refresh token:', e);
  }
  
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}
