// ============================================
// AMPARA API - Centralized API Client
// ============================================

import { getDeviceId } from './deviceId';
import { getTimezoneInfo } from '@/utils/timezoneHelper';
import { setSessionToken as saveSessionToken, setRefreshToken as saveRefreshToken, setUserData, clearSession, getSessionToken as getToken, getUserData } from '@/services/sessionService';
import { refreshAccessToken } from '@/services/tokenRefreshService';
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
  OrigemGravacao,
  STORAGE_KEYS,
} from './types';

// API Base URL - single endpoint with action field
const API_URL = import.meta.env.VITE_API_BASE_URL ||
  'https://uogenwcycqykfsuongrl.supabase.co/functions/v1/mobile-api';

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2Vud2N5Y3F5a2ZzdW9uZ3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjg2NjIsImV4cCI6MjA4NjQwNDY2Mn0.hncTs6DDS-sbb8sT_QBOBf1mTcTu0e_Pc5yXo4tHZwE';

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

  // Capturar timezone
  const timezoneInfo = getTimezoneInfo();

  const body: MobileApiPayload = {
    action,
    device_id: getDeviceId(),
    timezone: timezoneInfo.timezone,
    timezone_offset_minutes: timezoneInfo.timezone_offset_minutes,
    ...payload,
  };

  // Add session token and email if required
  if (requiresAuth) {
    const token = getSessionToken();
    const email = getUserEmail();

    const tokenPreview = token ? `${token.substring(0, 10)}...${token.substring(token.length - 10)}` : 'null';
    console.log('[API] Token check for', action, '- Has token:', !!token, '| Token preview:', tokenPreview, '| In background:', document.visibilityState === 'hidden');

    if (!token) {
      console.error(`[API] 🛑 SHUTDOWN: No token available for ${action}. Fetch will NOT be attempted.`);
      return { data: null, error: 'Senha ou Usuário inválido' };
    }
    body.session_token = token;
    if (email) {
      body.email_usuario = email;
    }
  }

  try {
    console.log(`[API] 🚀 SENDING REQUEST TO: ${API_URL}`);
    console.log(`[API] 📦 BODY:`, JSON.stringify(body, null, 2));

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
      },
      body: JSON.stringify(body),
    });

    console.log(`[API] 📡 RESPONSE STATUS: ${response.status} ${response.statusText}`);

    // Handle 401 or 403 Unauthorized - try to refresh token
    if ((response.status === 401 || response.status === 403) && requiresAuth) {
      console.log(`[API] Received ${response.status}, attempting token refresh...`);

      const refreshed = await refreshAccessToken();

      if (refreshed) {
        console.log('[API] Token refreshed, retrying request...');

        // Retry the request with the new token
        const newToken = getSessionToken();
        if (newToken) {
          body.session_token = newToken;

          const retryResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': API_KEY,
            },
            body: JSON.stringify(body),
          });

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}));
            return {
              data: null,
              error: errorData.error || errorData.message || `Erro ${retryResponse.status}`
            };
          }

          const retryData = await retryResponse.json();
          return { data: retryData, error: null };
        }
      }

      // If refresh failed, return session expired error
      console.error('[API] Token refresh failed, session expired');
      return {
        data: null,
        error: 'Sessão expirada. Faça login novamente.',
        session_expired: true
      } as any;
    }

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
 */
export async function loginCustomizado(
  email: string,
  senha: string
): Promise<ApiResponse<LoginResponse> & { isCoercion?: boolean }> {
  const deviceId = await getDeviceId();
  const timezone = getTimezoneInfo();

  const result = await mobileApi<LoginResponse>(
    'loginCustomizado',
    { email, senha, device_id: deviceId, ...timezone },
    { requiresAuth: false }
  );

  if (result.data) {
    const accessToken = result.data.access_token || result.data.session?.token;
    const refreshToken = result.data.refresh_token || result.data.session?.refresh_token;
    const userData = result.data.user || result.data.usuario;

    if (accessToken) await setSessionToken(accessToken);
    if (refreshToken) await saveRefreshToken(refreshToken);
    if (userData) await setUserData(JSON.stringify(userData));

    const data = result.data as any;
    const monitoramento = data.monitoramento;

    // Seguindo rigorosamente o payload do servidor
    const configResponse: ConfigSyncResponse = {
      configuracoes: {
        gatilhos: {
          voz: data.gravacao_ativa_config ?? true,
          manual: true
        }
      },
      dentro_horario: data.dentro_horario ?? false,
      gravacao_ativa: data.gravacao_ativa ?? false,
      periodo_atual_index: data.periodo_atual_index ?? null,
      gravacao_inicio: data.gravacao_inicio ?? null,
      gravacao_fim: data.gravacao_fim ?? null,
      periodos_hoje: data.periodos_hoje ?? [],
      gravacao_dias: data.dias_gravacao ?? [],
      audio_trigger_config: data.audio_trigger_config ?? null,
      periodos_semana: monitoramento?.periodos_semana ?? null,
      ultima_atualizacao: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEYS.USER_CONFIG, JSON.stringify(configResponse));
    console.log('[API] Login: Full config mapped and cached');

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

  // Verificar erro de pânico ativo (403 PANIC_ACTIVE_CANNOT_LOGOUT)
  if (result.error && (result.error.includes('PANIC_ACTIVE') || result.error.includes('pânico ativo'))) {
    return {
      data: null,
      error: 'Não é possível sair durante um pânico ativo. Desative o pânico primeiro.'
    };
  }

  // Limpar sessão local apenas se não houve erro de pânico
  if (!result.error || !result.error.includes('PANIC')) {
    await clearSessionToken();
    localStorage.removeItem(STORAGE_KEYS.USER_CONFIG);
  }

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
  longitude: number,
  extras?: {
    speed?: number | null;
    heading?: number | null;
    precisao_metros?: number | null;
    bateria_percentual?: number | null;
  }
): Promise<ApiResponse<LocationUpdateResponse>> {
  const result = await mobileApi<LocationUpdateResponse>('enviarLocalizacaoGPS', {
    latitude,
    longitude,
    speed: extras?.speed ?? null,
    heading: extras?.heading ?? null,
    precisao_metros: extras?.precisao_metros ?? null,
    bateria_percentual: extras?.bateria_percentual ?? null,
    timestamp_gps: new Date().toISOString(),
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

  // Adicionar timezone (Item 10 da API update)
  const timezoneInfo = getTimezoneInfo();
  formData.append('timezone', timezoneInfo.timezone);
  formData.append('timezone_offset_minutes', timezoneInfo.timezone_offset_minutes.toString());

  formData.append('audio', audioBlob, `segment_${segmentIndex}.wav`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
      },
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
  status: RecordingStatusType,
  origem?: OrigemGravacao,
  alertaId?: string,
  protocolo?: string,
  segmentoIdx?: number,
  motivoParada?: string
): Promise<ApiResponse<{ success: boolean }>> {
  const payload: any = {
    status_gravacao: status,
    timestamp: new Date().toISOString(),
  };

  // Add optional fields if provided
  if (origem) {
    payload.origem_gravacao = origem;
  }

  if (alertaId) {
    payload.device_id = await getDeviceId();
    payload.alerta_id = alertaId;
  }

  if (protocolo) {
    payload.protocolo = protocolo;
  }

  if (segmentoIdx !== undefined) {
    payload.segmento_idx = segmentoIdx;
  }

  // Item 7 da API update: novo campo motivo_parada
  if (motivoParada) {
    payload.motivo_parada = motivoParada;
  }

  return mobileApi<{ success: boolean }>('reportarStatusGravacao', payload);
}

// ============================================
// Configuration & Heartbeat Actions
// ============================================

/**
 * Sync user configuration
 */
export async function syncConfigMobile(): Promise<ApiResponse<ConfigSyncResponse>> {
  console.log('[API] 🔄 Starting syncConfigMobile flow...');

  // Tentar ação padrão
  let result = await mobileApi<any>('syncConfigMobile');

  // Tentar ação alternativa se a primeira falhar ou para garantir redundância (Snake Case)
  if (result.error) {
    console.warn('[API] syncConfigMobile (CamelCase) failed, trying sync_config_mobile (snake_case)...');
    const fallbackResult = await mobileApi<any>('sync_config_mobile');
    if (!fallbackResult.error) {
      result = fallbackResult;
    }
  }

  if (result.error) {
    console.error('[API] ❌ All sync attempts failed:', result.error);
    return { data: null, error: result.error || 'Failed to sync config' };
  } else {
    console.log('[API] ✅ syncConfigMobile success: Data received');
  }

  const data = result.data;
  const monitoramento = data.monitoramento;

  // Seguindo rigorosamente o payload do servidor
  const configResponse: ConfigSyncResponse = {
    configuracoes: {
      gatilhos: {
        voz: data.gravacao_ativa_config ?? true,
        manual: true
      }
    },
    dentro_horario: data.dentro_horario ?? false,
    gravacao_ativa: data.gravacao_ativa ?? false,
    periodo_atual_index: data.periodo_atual_index ?? null,
    gravacao_inicio: data.gravacao_inicio ?? null,
    gravacao_fim: data.gravacao_fim ?? null,
    periodos_hoje: data.periodos_hoje ?? [],
    gravacao_dias: data.dias_gravacao ?? [], // O servidor envia 'dias_gravacao'
    audio_trigger_config: data.audio_trigger_config ?? null,
    periodos_semana: monitoramento?.periodos_semana ?? null,
    ultima_atualizacao: new Date().toISOString()
  };

  // Salvar no localStorage para persistência entre recarregamentos
  localStorage.setItem(
    STORAGE_KEYS.USER_CONFIG,
    JSON.stringify(configResponse)
  );

  console.log('[API] syncConfigMobile processed correctly:', {
    has_weekly: !!configResponse.periodos_semana,
    periodos_hoje: configResponse.periodos_hoje?.length
  });

  return { data: configResponse, error: null };
}

/**
 * Ping server to maintain online status
 */
export async function pingMobile(): Promise<ApiResponse<PingResponse>> {
  try {
    // Import device info plugin dynamically to avoid circular dependencies
    const DeviceInfoExtended = (await import('@/plugins/deviceInfo')).default;
    const deviceInfo = await DeviceInfoExtended.getExtendedInfo();

    // Obter localização GPS para incluir no ping
    let locationData: Record<string, unknown> = {};
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,   // Usar GPS real, não WiFi/rede
          timeout: 10000,             // 10s para obter fix GPS
          maximumAge: 30000,          // Aceitar cache de até 30 segundos
        });
        locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          location_accuracy: position.coords.accuracy,
          location_timestamp: position.timestamp,
        };
        console.log('[API] Ping location obtained:', locationData.latitude, locationData.longitude);
      }
    } catch (locError) {
      console.warn('[API] Failed to get GPS for ping, trying cached location:', locError);
      // Fallback: usar última localização conhecida do cache
      const cached = getLastKnownLocation();
      if (cached) {
        locationData = {
          latitude: cached.latitude,
          longitude: cached.longitude,
          location_accuracy: null,
          location_timestamp: new Date(cached.timestamp).getTime(),
        };
        console.log('[API] Ping using cached location:', cached.latitude, cached.longitude);
      }
    }

    return mobileApi<PingResponse>('pingMobile', {
      device_model: deviceInfo.deviceModel,
      battery_level: deviceInfo.batteryLevel, // Mantendo por compatibilidade
      bateria_percentual: deviceInfo.batteryLevel, // Novo padrão
      is_charging: deviceInfo.isCharging, // Mantendo por compatibilidade
      bateria_carregando: deviceInfo.isCharging, // Novo padrão
      android_version: deviceInfo.androidVersion,
      app_version: deviceInfo.appVersion,
      is_ignoring_battery_optimization: deviceInfo.isIgnoringBatteryOptimization,
      connection_type: deviceInfo.connectionType,
      wifi_signal_strength: deviceInfo.wifiSignalStrength,
      ...locationData,
    });
  } catch (error) {
    console.warn('[API] Failed to get device info for ping, sending without it:', error);
    // Fallback: send ping without device info
    return mobileApi<PingResponse>('pingMobile');
  }
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
