// ============================================
// AMPARA API - Centralized API Client
// ============================================

import { getDeviceId } from './deviceId';
import { setSessionToken as saveSessionToken, setUserData, clearSession, getSessionToken as getToken, getUserData } from '@/services/sessionService';
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
  return getToken();
}

export async function setSessionToken(token: string): Promise<void> {
  await saveSessionToken(token);
}

export async function clearSessionToken(): Promise<void> {
  await clearSession();
}

export function getUserEmail(): string | null {
  const userData = getUserData();
  if (userData) {
    try {
      return JSON.parse(userData).email;
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
    // Store session token and user data using session service
    await setSessionToken(result.data.session.token);
    await setUserData(JSON.stringify(result.data.usuario));
    
    // Store user config in localStorage (not critical for auth)
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
  await clearSessionToken();
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
 * @param audioBlob - The audio blob to upload
 * @param segmentIndex - The segment index (0-based)
 * @param durationSeconds - Duration of this segment in seconds
 * @param origemGravacao - Origin of the recording for backend routing
 */
export async function receberAudioMobile(
  audioBlob: Blob,
  segmentIndex: number,
  durationSeconds: number,
  origemGravacao: import('@/lib/types').OrigemGravacao = 'botao_manual'
): Promise<ApiResponse<AudioUploadResponse>> {
  const email = getUserEmail();
  const token = getSessionToken();

  if (!token || !email) {
    return { data: null, error: 'Sessão expirada. Faça login novamente.' };
  }

  const formData = new FormData();
  formData.append('action', 'receberAudioMobile');
  formData.append('session_token', token);
  formData.append('device_id', getDeviceId());
  formData.append('email_usuario', email);
  formData.append('segment_index', segmentIndex.toString());
  formData.append('duration_seconds', durationSeconds.toString());
  formData.append('origem_gravacao', origemGravacao);
  formData.append('timestamp', new Date().toISOString());
  formData.append('audio', audioBlob, `segment_${segmentIndex}.wav`);

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
  console.log('[API] Calling syncConfigMobile...');
  
  const result = await mobileApi<any>('syncConfigMobile');
  
  console.log('[API] syncConfigMobile raw response:', JSON.stringify(result, null, 2));
  
  if (result.error || !result.data) {
    console.error('[API] syncConfigMobile error:', result.error);
    return { data: null, error: result.error || 'Failed to sync config' };
  }
  
  // Backend now returns data directly, not wrapped in 'configuracoes'
  // Transform the flat response into the expected ConfigSyncResponse format
  const configResponse: ConfigSyncResponse = {
    configuracoes: {
      contatos_suporte: result.data.contatos_rede_apoio || [],
      gatilhos: {
        voz: result.data.gravacao_ativa_config ?? true,
        manual: true
      }
    },
    dentro_horario: result.data.dentro_horario ?? false,
    gravacao_ativa: result.data.gravacao_ativa ?? false,
    periodo_atual_index: result.data.periodo_atual_index ?? null,
    gravacao_inicio: result.data.gravacao_inicio ?? null,
    gravacao_fim: result.data.gravacao_fim ?? null,
    periodos_hoje: result.data.periodos_hoje ?? [],
    gravacao_dias: result.data.gravacao_dias ?? [],
    audio_trigger_config: result.data.audio_trigger_config ?? null,
    periodos_semana: result.data.periodos_semana ?? null,
    ultima_atualizacao: new Date().toISOString()
  };
  
  // Cache the transformed config
  localStorage.setItem(
    STORAGE_KEYS.USER_CONFIG,
    JSON.stringify(configResponse.configuracoes)
  );
  
  console.log('[API] syncConfigMobile processed successfully', {
    dentro_horario: configResponse.dentro_horario,
    periodos_hoje_count: configResponse.periodos_hoje.length
  });
  
  return { data: configResponse, error: null };
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
