import { useState, useCallback, useEffect } from 'react';
import { syncConfigMobile, getCachedConfig } from '@/lib/api';
import { UserConfig, SupportContact } from '@/lib/types';

interface ConfigState {
  config: UserConfig | null;
  isLoading: boolean;
  lastSync: string | null;
  error: string | null;
}

export function useConfig() {
  const [state, setState] = useState<ConfigState>(() => ({
    config: getCachedConfig(),
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

    setState({
      config: result.data.configuracoes,
      isLoading: false,
      lastSync: result.data.ultima_atualizacao || new Date().toISOString(),
      error: null,
    });

    return true;
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
  };
}
