import React, { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { VoiceRecorder } from 'capacitor-voice-recorder';

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a0a2e] text-white p-6 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-lg font-medium">Iniciando Ampara...</p>
        <p className="text-sm text-gray-400 mt-2">Verificando permissões de segurança</p>
      </div>
    );
  }

  // Even if not granted, we let them through to the app, 
  // but the native pop-ups will have been triggered.
  return <>{children}</>;
};
