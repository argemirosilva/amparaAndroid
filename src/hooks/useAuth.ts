import { useState, useCallback, useEffect } from 'react';
import { 
  loginCustomizado, 
  logoutMobile, 
  syncConfigMobile,
  getSessionToken,
  clearSessionToken,
  getCachedConfig,
} from '@/lib/api';
import { UserConfig, STORAGE_KEYS } from '@/lib/types';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { id: string; nome: string; email: string } | null;
  config: UserConfig | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: !!getSessionToken(),
    isLoading: false,
    user: null,
    config: getCachedConfig(),
  });

  // Load user info from storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('ampara_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setState(prev => ({ ...prev, user }));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const login = useCallback(async (
    email: string, 
    password: string
  ): Promise<{ success: boolean; error?: string; isCoercion?: boolean }> => {
    setState(prev => ({ ...prev, isLoading: true }));

    const result = await loginCustomizado(email, password);

    if (result.error || !result.data) {
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: result.error || 'Falha no login' };
    }

    // Store user info
    localStorage.setItem('ampara_user', JSON.stringify(result.data.usuario));

    setState({
      isAuthenticated: true,
      isLoading: false,
      user: result.data.usuario,
      config: result.data.configuracoes,
    });

    // Sync config in background
    syncConfigMobile().catch(console.error);

    // Return coercion status (silent alert triggered)
    return { 
      success: true, 
      isCoercion: result.isCoercion 
    };
  }, []);

  const logout = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isLoading: true }));

    const result = await logoutMobile();

    // Clear local state regardless of API result
    localStorage.removeItem('ampara_user');
    localStorage.removeItem(STORAGE_KEYS.USER_CONFIG);
    clearSessionToken();

    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      config: null,
    });

    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true };
  }, []);

  const refreshConfig = useCallback(async (): Promise<void> => {
    const result = await syncConfigMobile();
    if (result.data?.configuracoes) {
      setState(prev => ({
        ...prev,
        config: result.data!.configuracoes,
      }));
    }
  }, []);

  const checkAuth = useCallback((): boolean => {
    const hasToken = !!getSessionToken();
    if (hasToken !== state.isAuthenticated) {
      setState(prev => ({ ...prev, isAuthenticated: hasToken }));
    }
    return hasToken;
  }, [state.isAuthenticated]);

  return {
    ...state,
    login,
    logout,
    refreshConfig,
    checkAuth,
  };
}
