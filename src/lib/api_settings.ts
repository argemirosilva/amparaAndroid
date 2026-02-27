// ============================================
// AMPARA Settings API
// ============================================

import { getDeviceId } from './deviceId';
import { getSessionToken, getUserEmail } from './api';
import { ApiResponse } from './types';

const API_URL = import.meta.env.VITE_API_BASE_URL ||
  'https://uogenwcycqykfsuongrl.supabase.co/functions/v1/mobile-api';

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2Vud2N5Y3F5a2ZzdW9uZ3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjg2NjIsImV4cCI6MjA4NjQwNDY2Mn0.hncTs6DDS-sbb8sT_QBOBf1mTcTu0e_Pc5yXo4tHZwE';

// ============================================
// Types
// ============================================

export interface ChangePasswordResponse {
  success: boolean;
}

export interface UpdateSchedulesResponse {
  success: boolean;
  message?: string;
  periodos_atualizados?: number;
  errors?: string[];
}

export interface ValidatePasswordResponse {
  success: boolean;
  loginTipo: 'normal' | 'coacao';
}

export interface SchedulePeriod {
  inicio: string; // HH:MM
  fim: string; // HH:MM
}

export type DayOfWeek = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

export type WeekSchedule = Partial<Record<DayOfWeek, SchedulePeriod[]>>;

// ============================================
// Core API Request Function for Settings
// ============================================

async function settingsApi<T>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<ApiResponse<T>> {
  const token = getSessionToken();
  const email = getUserEmail();

  if (!token) {
    console.error('[Settings API] No token available for', action);
    return { data: null, error: 'Sessão expirada. Faça login novamente.' };
  }

  const body = {
    action,
    device_id: getDeviceId(),
    session_token: token,
    ...(email && { email_usuario: email }),
    ...payload,
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Check for session expiration
    if (!data.success && data.error?.includes('Sessão')) {
      return { data: null, error: 'Sessão expirada. Faça login novamente.' };
    }

    return { data, error: null };
  } catch (error) {
    console.error('[Settings API] Error:', error);
    if (error instanceof Error) {
      if (error.name === 'TimeoutError') {
        return { data: null, error: 'Tempo esgotado. Verifique sua conexão.' };
      }
      return { data: null, error: error.message };
    }
    return { data: null, error: 'Erro desconhecido ao processar requisição.' };
  }
}

// ============================================
// Change Password
// ============================================

/**
 * Change user password
 */
export async function changePassword(
  senhaAtual: string,
  novaSenha: string
): Promise<ApiResponse<ChangePasswordResponse>> {
  console.log('[Settings API] Calling changePassword');

  return await settingsApi<ChangePasswordResponse>('change_password', {
    senha_atual: senhaAtual,
    nova_senha: novaSenha,
  });
}

// ============================================
// Update Schedules
// ============================================

/**
 * Update weekly monitoring schedules
 * Only send modified days (patch approach)
 */
export async function updateSchedules(
  periodosSemanaPatch: WeekSchedule
): Promise<ApiResponse<UpdateSchedulesResponse>> {
  console.log('[Settings API] Calling updateSchedules', periodosSemanaPatch);

  return await settingsApi<UpdateSchedulesResponse>('update_schedules', {
    periodos_semana: periodosSemanaPatch,
  });
}

// ============================================
// Validate Password (for coercion detection)
// ============================================

/**
 * Validate password and detect coercion
 * Used before accessing Settings or Logout
 */
export async function validatePassword(
  senha: string
): Promise<ApiResponse<ValidatePasswordResponse>> {
  console.log('[Settings API] Calling validatePassword');

  return await settingsApi<ValidatePasswordResponse>('validate_password', {
    senha,
  });
}
