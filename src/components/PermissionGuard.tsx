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

    // 3. Check Battery Optimization & Exact Alarms (apenas no Android)
    if (Capacitor.getPlatform() === 'android') {
      try {
        console.log('[PermissionGuard] 🔋 Checking battery & alarm status...');
        const status = await BatteryOptimization.isIgnoringBatteryOptimizations();
        console.log('[PermissionGuard] Status:', status);
        
        // Update PermissionFlowState
        PermissionFlowState.setMissing({
          batteryOpt: !status.isIgnoring,
          exactAlarm: !status.canScheduleExactAlarms,
        });

        // Battery Optimization
        if (!status.isIgnoring) {
          console.log('[PermissionGuard] ⚠️ App is being optimized, requesting exemption...');
          PermissionFlowState.setInFlow(true, 'requesting battery optimization');
          await BatteryOptimization.requestIgnoreBatteryOptimizations();
          // Note: User will be taken to system settings, app will pause
        }
        
        // Exact Alarms (Android 12+)
        if (!status.canScheduleExactAlarms) {
          console.log('[PermissionGuard] ⚠️ App cannot schedule exact alarms, requesting permission...');
          PermissionFlowState.setInFlow(true, 'requesting exact alarm permission');
          await BatteryOptimization.requestExactAlarmPermission();
          // Note: User will be taken to system settings, app will pause
        }

      } catch (error) {
        console.error('[PermissionGuard] ❌ Error with battery/alarm optimization:', error);
      }
    }

    // 4. Start KeepAlive Service (apenas no Android)
    if (Capacitor.getPlatform() === 'android') {
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
