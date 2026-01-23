import React, { useState } from 'react';
import { Mic, MapPin, Shield, Settings, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PermissionsState, PermissionStatus } from '@/services/permissionsService';
import amparaLogo from '@/assets/ampara-logo.png';

interface PermissionsRequestProps {
  permissions: PermissionsState | null;
  onRequestAll: () => Promise<void>;
  onOpenSettings?: () => void;
}

const PermissionItem: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  status: PermissionStatus;
}> = React.memo(({ icon, title, description, status }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'granted':
        return <CheckCircle2 className="w-5 h-5 text-primary" />;
      case 'denied':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />;
    }
  };

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
      <div className="p-2 rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">{title}</h3>
          {getStatusIcon()}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
});

export const PermissionsRequest: React.FC<PermissionsRequestProps> = ({
  permissions,
  onRequestAll,
  onOpenSettings,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequest = async () => {
    setIsRequesting(true);
    try {
      await onRequestAll();
    } finally {
      setIsRequesting(false);
    }
  };

  const hasDenied = permissions && (
    permissions.microphone === 'denied' || 
    permissions.location === 'denied'
  );

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
            <h1 className="text-xl font-semibold">Permissões Necessárias</h1>
          </div>
          <p className="text-muted-foreground">
            Para sua proteção, o AMPARA precisa acessar os seguintes recursos:
          </p>
        </div>

        {/* Permission Items */}
        <div className="space-y-3">
          <PermissionItem
            icon={<Mic className="w-5 h-5" />}
            title="Microfone"
            description="Detectar situações de risco através do áudio ambiente"
            status={permissions?.microphone ?? 'prompt'}
          />
          
          <PermissionItem
            icon={<MapPin className="w-5 h-5" />}
            title="Localização"
            description="Enviar sua posição em caso de emergência"
            status={permissions?.location ?? 'prompt'}
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          {hasDenied ? (
            <>
              <p className="text-sm text-center text-destructive">
                Uma ou mais permissões foram negadas. Por favor, habilite-as nas configurações do aplicativo.
              </p>
              <Button
                onClick={onOpenSettings}
                variant="outline"
                className="w-full"
              >
                <Settings className="w-4 h-4 mr-2" />
                Abrir Configurações
              </Button>
              <Button
                onClick={handleRequest}
                variant="ghost"
                className="w-full"
                disabled={isRequesting}
              >
                {isRequesting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Tentar Novamente
              </Button>
            </>
          ) : (
            <Button
              onClick={handleRequest}
              className="w-full"
              size="lg"
              disabled={isRequesting}
            >
              {isRequesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              Permitir Acesso
            </Button>
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
