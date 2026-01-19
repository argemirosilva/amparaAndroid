// ============================================
// AMPARA API - Centralized API Client
// ============================================

import { getDeviceId } from './deviceId';
import {
  ApiResponse,
  LoginResponse,
  PanicActivationResponse,
  PanicCancelResponse,
  AudioUploadResponse,
  LocationUpdateResponse,
  ConfigSyncResponse,
  PingResponse,
  PanicActivationType,
  PanicCancelType,
  RecordingStatusType,
  STORAGE_KEYS,
} from './types';

// API Base URL - single endpoint with action field
const API_URL = import.meta.env.VITE_API_BASE_URL || 
  'https://ilikiajeduezvvanjejz.supabase.co/functions/v1/mobile-api';

// ============================================
// Session Token Management
// ============================================

export function getSessionToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
}

export function getUserEmail(): string | null {
  const user = localStorage.getItem('ampara_user');
  if (user) {
    try {
      return JSON.parse(user).email;
    } catch {
      return null;
    }
  }
  return null;
}

// ============================================
// Core API Request Function
// ============================================

interface MobileApiPayload {
  action: string;
  [key: string]: unknown;
}

async function mobileApi<T>(
  action: string,
  payload: Record<string, unknown> = {},
  options: { requiresAuth?: boolean } = {}
): Promise<ApiResponse<T>> {
  const { requiresAuth = true } = options;
  
  const body: MobileApiPayload = {
    action,
    device_id: getDeviceId(),
    ...payload,
  };

  // Add session token and email if required
  if (requiresAuth) {
    const token = getSessionToken();
    const email = getUserEmail();
    if (!token) {
      return { data: null, error: 'Sessão expirada. Faça login novamente.' };
    }
    body.session_token = token;
    if (email) {
      body.email_usuario = email;
    }
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        data: null, 
        error: errorData.error || errorData.message || `Erro ${response.status}` 
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('API Error:', error);
    return { data: null, error: 'Erro de conexão. Verifique sua internet.' };
  }
}

// ============================================
// Authentication Actions
// ============================================

/**
 * Login with email and password
 * Supports coercion password (silent alert)
 */
export async function loginCustomizado(
  email: string,
  senha: string
): Promise<ApiResponse<LoginResponse> & { isCoercion?: boolean }> {
  const result = await mobileApi<LoginResponse>(
    'loginCustomizado',
    { email, senha },
    { requiresAuth: false }
  );

  if (result.data) {
    // Store session token
    setSessionToken(result.data.session.token);
    
    // Store user config
    localStorage.setItem(
      STORAGE_KEYS.USER_CONFIG,
      JSON.stringify(result.data.configuracoes)
    );

    // Check for coercion (silent - no visual feedback)
    if (result.data.coacao_detectada) {
      return { ...result, isCoercion: true };
    }
  }

  return result;
}

/**
 * Logout from the app
 */
export async function logoutMobile(): Promise<ApiResponse<{ success: boolean }>> {
  const result = await mobileApi<{ success: boolean }>('logoutMobile');
  
  // Clear local session even if API fails
  clearSessionToken();
  localStorage.removeItem(STORAGE_KEYS.USER_CONFIG);
  
  return result;
}

// ============================================
// Panic Mode Actions
// ============================================

/**
 * Activate panic mode
 */
export async function acionarPanicoMobile(
  latitude: number,
  longitude: number,
  tipo_acionamento: PanicActivationType = 'manual'
): Promise<ApiResponse<PanicActivationResponse>> {
  return mobileApi<PanicActivationResponse>('acionarPanicoMobile', {
    localizacao: { latitude, longitude },
    tipo_acionamento,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Cancel panic mode (requires password validation)
 */
export async function cancelarPanicoMobile(
  tipo_cancelamento: PanicCancelType = 'manual'
): Promise<ApiResponse<PanicCancelResponse>> {
  return mobileApi<PanicCancelResponse>('cancelarPanicoMobile', {
    tipo_cancelamento,
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// Location Actions
// ============================================

/**
 * Send GPS location update
 */
export async function enviarLocalizacaoGPS(
  latitude: number,
  longitude: number
): Promise<ApiResponse<LocationUpdateResponse>> {
  const result = await mobileApi<LocationUpdateResponse>('enviarLocalizacaoGPS', {
    latitude,
    longitude,
    timestamp: new Date().toISOString(),
  });

  // Cache last known location
  if (result.data?.success) {
    localStorage.setItem(
      STORAGE_KEYS.LAST_LOCATION,
      JSON.stringify({ latitude, longitude, timestamp: new Date().toISOString() })
    );
  }

  return result;
}

// ============================================
// Recording Actions
// ============================================

/**
 * Upload audio segment (multipart/form-data)
 */
export async function receberAudioMobile(
  audioBlob: Blob,
  segmentIndex: number
): Promise<ApiResponse<AudioUploadResponse>> {
  const email = getUserEmail();
  const token = getSessionToken();
  
  console.log('[receberAudioMobile] email:', email, 'token:', token ? 'exists' : 'missing');
  
  if (!token || !email) {
    console.error('[receberAudioMobile] Missing token or email');
    return { data: null, error: 'Sessão expirada. Faça login novamente.' };
  }

  const formData = new FormData();
  formData.append('action', 'receberAudioMobile');
  formData.append('session_token', token);
  formData.append('device_id', getDeviceId());
  formData.append('email_usuario', email);
  formData.append('segment_index', segmentIndex.toString());
  formData.append('timestamp', new Date().toISOString());
  formData.append('audio', audioBlob, `segment_${segmentIndex}.webm`);
  
  console.log('[receberAudioMobile] FormData created with email_usuario:', email);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        data: null, 
        error: errorData.error || 'Falha no envio do áudio' 
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('Audio upload error:', error);
    return { data: null, error: 'Erro ao enviar áudio' };
  }
}

/**
 * Report recording status changes
 */
export async function reportarStatusGravacao(
  status: RecordingStatusType
): Promise<ApiResponse<{ success: boolean }>> {
  return mobileApi<{ success: boolean }>('reportarStatusGravacao', {
    status_gravacao: status,
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// Configuration & Heartbeat Actions
// ============================================

/**
 * Sync user configuration
 */
export async function syncConfigMobile(): Promise<ApiResponse<ConfigSyncResponse>> {
  const result = await mobileApi<ConfigSyncResponse>('syncConfigMobile');
  
  if (result.data?.configuracoes) {
    localStorage.setItem(
      STORAGE_KEYS.USER_CONFIG,
      JSON.stringify(result.data.configuracoes)
    );
  }
  
  return result;
}

/**
 * Ping server to maintain online status
 */
export async function pingMobile(): Promise<ApiResponse<PingResponse>> {
  return mobileApi<PingResponse>('pingMobile');
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get cached user configuration
 */
export function getCachedConfig(): ConfigSyncResponse['configuracoes'] | null {
  const stored = localStorage.getItem(STORAGE_KEYS.USER_CONFIG);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Get last known location
 */
export function getLastKnownLocation(): { latitude: number; longitude: number; timestamp: string } | null {
  const stored = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Check if session is valid (basic check - doesn't verify with server)
 */
export function hasValidSession(): boolean {
  return !!getSessionToken();
}
