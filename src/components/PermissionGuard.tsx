import React, { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { Capacitor } from '@capacitor/core';
import BatteryOptimization from '../plugins/batteryOptimization';
import KeepAlive from '../plugins/keepAlive';

interface PermissionGuardProps {
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ children }) => {
  console.log('🚨🚨🚨 [PermissionGuard] COMPONENT MOUNTED! 🚨🚨🚨');
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

  const checkAndRequestPermissions = async () => {
    try {
      // 1. Check Geolocation
      const geoStatus = await Geolocation.checkPermissions();
      
      // 2. Check Microphone
      const micStatus = await VoiceRecorder.hasAudioRecordingPermission();

      if (geoStatus.location === 'granted' && micStatus.value) {
        console.log('[PermissionGuard] ✅ All basic permissions granted');
        setHasPermissions(true);
      } else {
        // Request them
        console.log('[PermissionGuard] Requesting permissions...');
        
        if (geoStatus.location !== 'granted') {
          await Geolocation.requestPermissions();
        }
        
        if (!micStatus.value) {
          await VoiceRecorder.requestAudioRecordingPermission();
        }

        // Re-check after request
        const finalGeo = await Geolocation.checkPermissions();
        const finalMic = await VoiceRecorder.hasAudioRecordingPermission();
        
        setHasPermissions(finalGeo.location === 'granted' && finalMic.value);
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
        
        // Battery Optimization
        if (!status.isIgnoring) {
          console.log('[PermissionGuard] ⚠️ App is being optimized, requesting exemption...');
          await BatteryOptimization.requestIgnoreBatteryOptimizations();
        }
        
        // Exact Alarms (Android 12+)
        if (!status.canScheduleExactAlarms) {
          console.log('[PermissionGuard] ⚠️ App cannot schedule exact alarms, requesting permission...');
          await BatteryOptimization.requestExactAlarmPermission();
        }

      } catch (error) {
        console.error('[PermissionGuard] ❌ Error with battery/alarm optimization:', error);
      }
    }

    // 4. Start KeepAlive Service (apenas no Android)
    if (Capacitor.getPlatform() === 'android') {
      try {
        console.log('[PermissionGuard] 🚀 Starting KeepAlive service...');
        await KeepAlive.start();
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

  return <>{children}</>;
};
