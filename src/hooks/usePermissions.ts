import { useState, useEffect, useCallback } from 'react';
import { permissionsService, PermissionsState, PermissionStatus } from '@/services/permissionsService';

interface UsePermissionsReturn {
  permissions: PermissionsState | null;
  isLoading: boolean;
  hasAllRequired: boolean;
  requestMicrophone: () => Promise<boolean>;
  requestLocation: () => Promise<boolean>;
  requestAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<PermissionsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkPermissions = useCallback(async () => {
    try {
      const state = await permissionsService.checkAll();
      setPermissions(state);
    } catch (error) {
      console.error('Error checking permissions:', error);
      // Default to prompt state on error
      setPermissions({
        microphone: 'prompt',
        location: 'prompt',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  const requestMicrophone = useCallback(async (): Promise<boolean> => {
    const granted = await permissionsService.requestMicrophone();
    await checkPermissions();
    return granted;
  }, [checkPermissions]);

  const requestLocation = useCallback(async (): Promise<boolean> => {
    const granted = await permissionsService.requestLocation();
    await checkPermissions();
    return granted;
  }, [checkPermissions]);

  const requestAll = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    await permissionsService.requestAll();
    await checkPermissions();
  }, [checkPermissions]);

  const hasAllRequired = permissions 
    ? permissionsService.hasAllRequired(permissions)
    : false;

  return {
    permissions,
    isLoading,
    hasAllRequired,
    requestMicrophone,
    requestLocation,
    requestAll,
    refresh: checkPermissions,
  };
}
