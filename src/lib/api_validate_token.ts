/**
 * Token Validation Utility
 * Validates if the stored session token is still valid on the server
 */

import { getSessionToken, getUserEmail } from './api';
import { getDeviceId } from './deviceId';

const API_URL = import.meta.env.VITE_API_BASE_URL || 
  'https://ilikiajeduezvvanjejz.supabase.co/functions/v1/mobile-api';

/**
 * Validate the current session token with the server
 * Returns true if token is valid, false otherwise
 */
export async function validateSessionToken(): Promise<boolean> {
  const token = getSessionToken();
  const email = getUserEmail();
  
  if (!token || !email) {
    console.log('[TokenValidator] No token or email found');
    return false;
  }

  try {
    console.log('[TokenValidator] Validating session token...');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'ping',
        device_id: getDeviceId(),
        session_token: token,
        email_usuario: email,
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      console.log('[TokenValidator] HTTP error:', response.status);
      return false;
    }

    const data = await response.json();
    
    // If ping succeeds, token is valid
    if (data.success) {
      console.log('[TokenValidator] Token is valid');
      return true;
    }
    
    // If there's an error about session, token is invalid
    if (data.error && (
      data.error.includes('Sessão') || 
      data.error.includes('Session') ||
      data.error.includes('Token') ||
      data.error.includes('inválida') ||
      data.error.includes('expirada')
    )) {
      console.log('[TokenValidator] Token is invalid:', data.error);
      return false;
    }
    
    // Other errors might be temporary, consider token valid
    console.log('[TokenValidator] Ping returned error but token might be valid:', data.error);
    return true;
    
  } catch (error) {
    // Network errors - assume token is valid (don't force logout on connectivity issues)
    console.warn('[TokenValidator] Network error, assuming token is valid:', error);
    return true;
  }
}
