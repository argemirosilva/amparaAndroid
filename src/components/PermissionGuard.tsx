import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import BatteryOptimization from '../plugins/batteryOptimization';
import KeepAlive from '../plugins/keepAlive';
import { getDeviceId } from '../lib/deviceId';
import { UnifiedPermissionsScreen } from './UnifiedPermissionsScreen';
import { checkPermissions } from '@/services/permissionsService';
import { PermissionFlowState } from '@/services/permissionFlowState';

interface PermissionGuardProps {
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ children }) => {
  console.log('🚨🚨🚨 [PermissionGuard] COMPONENT MOUNTED! 🚨🚨🚨');
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

  // Initialize PermissionFlowState
  useEffect(() => {
    PermissionFlowState.init();
  }, []);

  const checkAndRequestPermissions = async () => {
    try {
      // Check all permissions
      const permissions = await checkPermissions();
      
      // Check if all critical permissions are granted
      const allGranted = 
        permissions.microphone === 'granted' &&
        permissions.location === 'granted';
      
      // Update PermissionFlowState
      PermissionFlowState.setMissing({
        audio: permissions.microphone !== 'granted',
        location: permissions.location !== 'granted',
      });

      if (allGranted) {
        console.log('[PermissionGuard] ✅ All basic permissions granted');
        setHasPermissions(true);
        // Permission flow ended (basic permissions OK)
        PermissionFlowState.setInFlow(false, 'basic permissions granted');
      } else {
        console.log('[PermissionGuard] ⚠️ Missing permissions, showing unified screen');
        setHasPermissions(false);
        // Permission flow active (showing permission screen)
        PermissionFlowState.setInFlow(true, 'missing basic permissions');
      }
    } catch (error) {
      console.error('[PermissionGuard] Error checking permissions:', error);
      setHasPermissions(false);
    }

    // 3. Start KeepAlive Service ONLY if all permissions are granted
    if (allGranted && Capacitor.getPlatform() === 'android') {
      try {
        console.log('[PermissionGuard] 🚀 Starting KeepAlive service...');
        const deviceId = getDeviceId();
        console.log('[PermissionGuard] 📱 Syncing device_id:', deviceId);
        await KeepAlive.start({ deviceId });
        console.log('[PermissionGuard] ✅ KeepAlive service started successfully');
      } catch (error) {
        console.error('[PermissionGuard] ❌ Error starting KeepAlive service:', error);
      }
    }
  };

  useEffect(() => {
    checkAndRequestPermissions();
  }, []);

  if (hasPermissions === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (hasPermissions === false) {
    return <UnifiedPermissionsScreen onComplete={checkAndRequestPermissions} />;
  }

  return <>{children}</>;
};
