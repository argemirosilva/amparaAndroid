/**
 * Token Refresh Service
 * Handles automatic token refresh when receiving 401 errors
 */

import { getRefreshToken, setSessionToken, setRefreshToken, clearSession } from './sessionService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.ampara.app.br';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh the access token using the refresh token
 * Returns true if successful, false otherwise
 */
export async function refreshAccessToken(): Promise<boolean> {
  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    console.log('[TokenRefresh] Already refreshing, waiting for existing request...');
    return refreshPromise;
  }

  isRefreshing = true;
  
  refreshPromise = (async () => {
    try {
      console.log('[TokenRefresh] Starting token refresh...');
      
      const refreshToken = getRefreshToken();
      
      if (!refreshToken) {
        console.error('[TokenRefresh] No refresh token available');
        return false;
      }

      // Get device_id from storage
      const { getDeviceId } = await import('./sessionService');
      const deviceId = getDeviceId();
      
      // Call the backend refresh endpoint
      const response = await fetch(`${API_BASE_URL}/mobile-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refresh_token',
          refresh_token: refreshToken,
          device_id: deviceId || 'web-fallback',
        }),
      });

      if (!response.ok) {
        console.error('[TokenRefresh] Refresh failed with status:', response.status);
        
        // If refresh fails with 401, the refresh token is invalid/expired
        if (response.status === 401) {
          console.error('[TokenRefresh] Refresh token invalid/expired, clearing session');
          await clearSession();
        }
        
        return false;
      }

      const data = await response.json();

      if (!data.success || !data.access_token || !data.refresh_token) {
        console.error('[TokenRefresh] Invalid response from refresh endpoint:', data);
        return false;
      }

      // Update tokens in storage
      console.log('[TokenRefresh] Tokens refreshed successfully, updating storage...');
      await setSessionToken(data.access_token);
      await setRefreshToken(data.refresh_token);

      console.log('[TokenRefresh] Token refresh complete!');
      return true;

    } catch (error) {
      console.error('[TokenRefresh] Exception during token refresh:', error);
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Check if currently refreshing
 */
export function isCurrentlyRefreshing(): boolean {
  return isRefreshing;
}
