import React, { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import BatteryOptimization from '../plugins/batteryOptimization';
import KeepAlive from '../plugins/keepAlive';

interface PermissionGuardProps {
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ children }) => {
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

  const checkAndRequestPermissions = async () => {
    try {
      // 1. Check Geolocation
      const geoStatus = await Geolocation.checkPermissions();
      
      // 2. Check Microphone
      const micStatus = await VoiceRecorder.hasAudioRecordingPermission();

      if (geoStatus.location === 'granted' && micStatus.value) {
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

      // 3. Check Battery Optimization (não bloqueia o app)
      try {
        const batteryStatus = await BatteryOptimization.isIgnoringBatteryOptimizations();
        if (!batteryStatus.isIgnoring) {
          console.log('[PermissionGuard] Requesting battery optimization exemption...');
          await BatteryOptimization.requestIgnoreBatteryOptimizations();
        }
      } catch (error) {
        console.error('[PermissionGuard] Error checking battery optimization:', error);
      }

      // 4. Start KeepAlive Service
      try {
        console.log('[PermissionGuard] Starting KeepAlive service...');
        await KeepAlive.start();
      } catch (error) {
        console.error('[PermissionGuard] Error starting KeepAlive service:', error);
      }
    } catch (error) {
      console.error('[PermissionGuard] Error checking permissions:', error);
      setHasPermissions(false);
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

  // Even if not granted, we let them through to the app, 
  // but the native pop-ups will have been triggered.
  return <>{children}</>;
};
