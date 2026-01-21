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
  // Novos campos do servidor
  audio_trigger_config?: ServerAudioTriggerConfig;
  periodos_semana?: PeriodosSemana;
}

// Configuração de áudio do servidor (snake_case)
export interface ServerAudioTriggerConfig {
  sample_rate: number;
  frame_ms: number;
  aggregation_ms: number;
  discussion_window_seconds: number;
  pre_trigger_seconds: number;
  start_hold_seconds: number;
  end_hold_seconds: number;
  cooldown_seconds: number;
  noise_floor_learning_rate: number;
  loud_delta_db: number;
  vad_delta_db: number;
  speech_density_min: number;
  loud_density_min: number;
  turn_taking_min: number;
  speech_density_end: number;
  loud_density_end: number;
  silence_decay_seconds: number;
  silence_decay_rate: number;
  male_bias_enabled: boolean;
  f0_low_male: number;
  f0_high_female: number;
  voicing_confidence_min: number;
  zcr_min_voice: number;
  zcr_max_voice: number;
}

// Períodos da semana organizados por dia
export interface PeriodosSemana {
  seg: MonitoringPeriod[];
  ter: MonitoringPeriod[];
  qua: MonitoringPeriod[];
  qui: MonitoringPeriod[];
  sex: MonitoringPeriod[];
  sab: MonitoringPeriod[];
  dom: MonitoringPeriod[];
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

// Recording origin types (for backend routing)
export type OrigemGravacao = 
  | 'comando_voz' 
  | 'botao_panico' 
  | 'botao_manual' 
  | 'automatico' 
  | 'agendado' 
  | 'upload_arquivo';

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
