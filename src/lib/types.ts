// ============================================
// AMPARA API Types
// ============================================

// Device ID for tracking sessions
export interface DeviceInfo {
  device_id: string;
  created_at: string;
}

// Login Response
export interface LoginResponse {
  session: {
    token: string;
    expires_at: string;
  };
  usuario: {
    id: string;
    nome: string;
    email: string;
  };
  configuracoes: UserConfig;
  coacao_detectada?: boolean;
}

// User Configuration
export interface UserConfig {
  gatilhos: {
    voz: boolean;
    manual: boolean;
  };
  contatos_suporte: SupportContact[];
}

// Support Contact
export interface SupportContact {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  avatar_url?: string;
  is_guardian: boolean;
}

// Panic Activation Response
export interface PanicActivationResponse {
  numero_protocolo: string;
  guardioes_notificados: number;
  autoridades_acionadas: boolean;
  timestamp: string;
}

// Panic Cancel Response
export interface PanicCancelResponse {
  success: boolean;
  duracao_total: number;
}

// Audio Upload Response
export interface AudioUploadResponse {
  segment_id: string;
  received_at: string;
}

// Location Update Response
export interface LocationUpdateResponse {
  success: boolean;
  timestamp: string;
}

// Monitoring Period
export interface MonitoringPeriod {
  inicio: string; // "08:00"
  fim: string;    // "12:00"
}

// Config Sync Response
export interface ConfigSyncResponse {
  configuracoes: UserConfig;
  ultima_atualizacao: string;
  dentro_horario?: boolean;
  gravacao_ativa?: boolean;
  periodo_atual_index?: number | null;
  gravacao_inicio?: string | null;
  gravacao_fim?: string | null;
  periodos_hoje?: MonitoringPeriod[];
  gravacao_dias?: string[];
}

// Ping Response
export interface PingResponse {
  status: 'online';
  server_time: string;
}

// API Error Response
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: string;
}

// Generic API Response wrapper
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  isCoercion?: boolean;
}

// Panic activation types
export type PanicActivationType = 'manual' | 'voz' | 'oculto' | 'widget';

// Panic cancel types
export type PanicCancelType = 'manual' | 'timeout' | 'coacao';

// Recording status types
export type RecordingStatusType = 'iniciada' | 'pausada' | 'retomada' | 'finalizada' | 'enviando' | 'erro';

// App status types
export type AppStatusType = 'normal' | 'recording' | 'panic';

// Session storage keys
export const STORAGE_KEYS = {
  SESSION_TOKEN: 'ampara_session_token',
  DEVICE_ID: 'ampara_device_id',
  USER_CONFIG: 'ampara_user_config',
  LAST_LOCATION: 'ampara_last_location',
  PENDING_UPLOADS: 'ampara_pending_uploads',
  APP_STATE: 'ampara_app_state',
} as const;
