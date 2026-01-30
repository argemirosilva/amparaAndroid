import { useState, useCallback, useEffect } from 'react';
import { syncConfigMobile, getCachedConfig } from '@/lib/api';
import { UserConfig, SupportContact, MonitoringPeriod, ServerAudioTriggerConfig, PeriodosSemana } from '@/lib/types';
import type { AudioTriggerConfig } from '@/types/audioTrigger';
import { saveServerConfig, loadServerConfig } from '@/utils/configStorage';
import { getConfigFromServer } from '@/utils/configConverter';

interface MonitoringState {
  dentroHorario: boolean;
  gravacaoAtiva: boolean;
  periodoAtualIndex: number | null;
  gravacaoInicio: string | null;
  gravacaoFim: string | null;
  periodosHoje: MonitoringPeriod[];
  gravacaoDias: string[];
}

interface ConfigState {
  config: UserConfig | null;
  monitoring: MonitoringState;
  periodosSemana: PeriodosSemana | null;
  isLoading: boolean;
  lastSync: string | null;
  error: string | null;
}

const initialMonitoringState: MonitoringState = {
  dentroHorario: false,
  gravacaoAtiva: false,
  periodoAtualIndex: null,
  gravacaoInicio: null,
  gravacaoFim: null,
  periodosHoje: [],
  gravacaoDias: [],
};

export function useConfig() {
  const [state, setState] = useState<ConfigState>(() => ({
    config: getCachedConfig(),
    monitoring: initialMonitoringState,
    periodosSemana: null,
    isLoading: false,
    lastSync: null,
    error: null,
  }));

  // Sync configuration from server
  const syncConfig = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const result = await syncConfigMobile();

    if (result.error || !result.data) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: result.error || 'Falha ao sincronizar configurações',
      }));
      return false;
    }

    // IGNORED: audio_trigger_config from API (use local defaults only)
    if (result.data.audio_trigger_config) {
      console.log('[useConfig] audio_trigger_config from API -> IGNORED');
    }

    setState({
      config: result.data.configuracoes,
      monitoring: {
        dentroHorario: result.data.dentro_horario ?? false,
        gravacaoAtiva: result.data.gravacao_ativa ?? false,
        periodoAtualIndex: result.data.periodo_atual_index ?? null,
        gravacaoInicio: result.data.gravacao_inicio ?? null,
        gravacaoFim: result.data.gravacao_fim ?? null,
        periodosHoje: result.data.periodos_hoje ?? [],
        gravacaoDias: result.data.gravacao_dias ?? [],
      },
      // audioTriggerConfig removed - use local defaults only
      periodosSemana: result.data.periodos_semana ?? null,
      isLoading: false,
      lastSync: result.data.ultima_atualizacao || new Date().toISOString(),
      error: null,
    });

    return true;
  }, []);

  // Get audio trigger config converted to client format
  // REMOVED: Always use local defaults, never from API
  const getAudioTriggerConfig = useCallback((): AudioTriggerConfig => {
    console.log('[useConfig] getAudioTriggerConfig called -> returning null (use local defaults)');
    return getConfigFromServer(null);
  }, []);

  // Get support contacts (guardians)
  const getGuardians = useCallback((): SupportContact[] => {
    if (!state.config?.contatos_suporte) return [];
    return state.config.contatos_suporte.filter(c => c.is_guardian);
  }, [state.config]);

  // Get all support contacts
  const getSupportContacts = useCallback((): SupportContact[] => {
    return state.config?.contatos_suporte || [];
  }, [state.config]);

  // Check if voice trigger is enabled
  const isVoiceTriggerEnabled = useCallback((): boolean => {
    return state.config?.gatilhos?.voz ?? false;
  }, [state.config]);

  // Check if manual trigger is enabled
  const isManualTriggerEnabled = useCallback((): boolean => {
    return state.config?.gatilhos?.manual ?? true;
  }, [state.config]);

  // Reload cached config
  const reloadFromCache = useCallback(() => {
    const cached = getCachedConfig();
    if (cached) {
      setState(prev => ({ ...prev, config: cached }));
    }
  }, []);

  // Load cached config on mount
  useEffect(() => {
    reloadFromCache();
  }, [reloadFromCache]);

  return {
    ...state,
    syncConfig,
    getGuardians,
    getSupportContacts,
    isVoiceTriggerEnabled,
    isManualTriggerEnabled,
    reloadFromCache,
    getAudioTriggerConfig,
  };
}
