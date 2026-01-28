import React, { useState, useEffect } from 'react';
import { Mic, MapPin, Shield, Battery, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestMicrophonePermission, requestLocationPermission } from '@/services/permissionsService';
import { Geolocation } from '@capacitor/geolocation';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import BatteryOptimization from '@/plugins/batteryOptimization';
import amparaLogo from '@/assets/ampara-logo.png';

interface PermissionItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: 'granted' | 'denied' | 'prompt' | 'checking';
  onRequest: () => Promise<void>;
  isRequesting: boolean;
}

const PermissionItem: React.FC<PermissionItemProps> = ({
  icon,
  title,
  description,
  status,
  onRequest,
  isRequesting
}) => {
  const getStatusIcon = () => {
    if (isRequesting) {
      return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />;
    }
    
    switch (status) {
      case 'granted':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'denied':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'checking':
        return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
    }
  };

  const getButtonText = () => {
    if (isRequesting) return 'Solicitando...';
    if (status === 'granted') return 'Concedida';
    if (status === 'denied') return 'Tentar Novamente';
    return 'Permitir';
  };

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
      <div className="p-2 rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-foreground">{title}</h3>
          {getStatusIcon()}
        </div>
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
        <Button
          onClick={onRequest}
          disabled={isRequesting || status === 'granted'}
          size="sm"
          variant={status === 'granted' ? 'secondary' : 'default'}
          className="w-full"
        >
          {getButtonText()}
        </Button>
      </div>
    </div>
  );
};

interface UnifiedPermissionsScreenProps {
  onComplete: () => void;
}

export const UnifiedPermissionsScreen: React.FC<UnifiedPermissionsScreenProps> = ({ onComplete }) => {
  const [microphoneStatus, setMicrophoneStatus] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');
  const [locationStatus, setLocationStatus] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');
  const [batteryStatus, setBatteryStatus] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');
  
  const [requestingMic, setRequestingMic] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [requestingBattery, setRequestingBattery] = useState(false);

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    // Check microphone
    try {
      const micStatus = await VoiceRecorder.hasAudioRecordingPermission();
      setMicrophoneStatus(micStatus.value ? 'granted' : 'prompt');
    } catch (error) {
      console.error('Error checking microphone:', error);
      setMicrophoneStatus('prompt');
    }
    
    // Check location
    try {
      const locStatus = await Geolocation.checkPermissions();
      setLocationStatus(locStatus.location === 'granted' ? 'granted' : locStatus.location === 'denied' ? 'denied' : 'prompt');
    } catch (error) {
      console.error('Error checking location:', error);
      setLocationStatus('prompt');
    }
    
    // Check battery optimization
    try {
      const batteryResult = await BatteryOptimization.isIgnoringBatteryOptimizations();
      setBatteryStatus(batteryResult.isIgnoring ? 'granted' : 'prompt');
    } catch (error) {
      console.error('Error checking battery optimization:', error);
      setBatteryStatus('prompt');
    }
  };

  const handleRequestMicrophone = async () => {
    setRequestingMic(true);
    try {
      const result = await requestMicrophonePermission();
      setMicrophoneStatus(result);
    } finally {
      setRequestingMic(false);
    }
  };

  const handleRequestLocation = async () => {
    setRequestingLocation(true);
    try {
      const result = await requestLocationPermission();
      setLocationStatus(result);
    } finally {
      setRequestingLocation(false);
    }
  };



  const handleRequestBattery = async () => {
    setRequestingBattery(true);
    try {
      await BatteryOptimization.requestIgnoreBatteryOptimizations();
      // Check again after request
      const batteryResult = await BatteryOptimization.isIgnoringBatteryOptimizations();
      setBatteryStatus(batteryResult.isIgnoring ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error requesting battery optimization:', error);
      setBatteryStatus('denied');
    } finally {
      setRequestingBattery(false);
    }
  };

  const allGranted = 
    microphoneStatus === 'granted' &&
    locationStatus === 'granted' &&
    batteryStatus === 'granted';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-4">
          <img 
            src={amparaLogo} 
            alt="AMPARA" 
            className="h-16 w-auto"
          />
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Shield className="w-6 h-6" />
            <h1 className="text-xl font-semibold">Configuração Inicial</h1>
          </div>
          <p className="text-muted-foreground">
            Para sua proteção, o AMPARA precisa das seguintes permissões:
          </p>
        </div>

        {/* Permission Items */}
        <div className="space-y-3">


          <PermissionItem
            icon={<Mic className="w-5 h-5" />}
            title="Microfone"
            description="Detectar situações de risco através do áudio ambiente"
            status={microphoneStatus}
            onRequest={handleRequestMicrophone}
            isRequesting={requestingMic}
          />
          
          <PermissionItem
            icon={<MapPin className="w-5 h-5" />}
            title="Localização Precisa"
            description="Enviar sua posição exata em caso de emergência"
            status={locationStatus}
            onRequest={handleRequestLocation}
            isRequesting={requestingLocation}
          />

          <PermissionItem
            icon={<Battery className="w-5 h-5" />}
            title="Sem Restrições de Bateria"
            description="Configurar como 'Sem Restrições' para funcionar em segundo plano"
            status={batteryStatus}
            onRequest={handleRequestBattery}
            isRequesting={requestingBattery}
          />
        </div>

        {/* Continue Button */}
        <div className="space-y-3 pt-4">
          {allGranted ? (
            <Button
              onClick={onComplete}
              className="w-full"
              size="lg"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Continuar
            </Button>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Clique em "Permitir" em cada permissão acima para continuar
              </p>
              <Button
                onClick={onComplete}
                variant="outline"
                className="w-full"
              >
                Pular por Enquanto
              </Button>
            </div>
          )}
        </div>

        {/* Info Text */}
        <p className="text-xs text-center text-muted-foreground">
          Suas informações são usadas apenas para sua segurança e nunca são compartilhadas sem sua autorização.
        </p>
      </div>
    </div>
  );
};
