import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Triangle, Menu, LogOut, X, Upload, Calendar } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

import orizonLogo from '@/assets/orizon-tech-logo.png';
import amparaCircleLogo from '@/assets/ampara-circle-logo.png';
import { PanicButton } from '@/components/PanicButton';
import { RecordButton } from '@/components/RecordButton';
import { LogoutConfirmDialog } from '@/components/LogoutConfirmDialog';
import { PermissionsRequest } from '@/components/PermissionsRequest';

// MonitoringStatus is now integrated into AudioTriggerMeter
import { MonitoringPeriodsList } from '@/components/MonitoringPeriodsList';
import { AudioTriggerMeter } from '@/components/AudioTriggerMeter';
import { AudioTriggerDebugPanel } from '@/components/AudioTriggerDebugPanel';
import { usePanicContext } from '@/contexts/PanicContext';
import { useRecording } from '@/hooks/useRecording';
import { useAppState } from '@/hooks/useAppState';
import { useConfig } from '@/hooks/useConfig';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useToast } from '@/hooks/use-toast';
import { useAudioTriggerController } from '@/hooks/useAudioTriggerController';
import { useStealthNotification } from '@/hooks/useStealthNotification';
import { usePermissions } from '@/hooks/usePermissions';

interface HomePageProps {
  onLogout: () => void;
}

export function HomePage({ onLogout }: HomePageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  
  // Permissions check
  const { permissions, isLoading: isPermissionsLoading, hasAllRequired, requestAll } = usePermissions();
  
  const appState = useAppState();
  const panic = usePanicContext();
  const recording = useRecording();
  const { monitoring, audioTriggerConfig, isLoading: isConfigLoading, syncConfig, isVoiceTriggerEnabled, periodosSemana } = useConfig();
  useHeartbeat({ autoStart: true });
  const audioTrigger = useAudioTriggerController(undefined, audioTriggerConfig);
  
  // Stealth notification - shows "Bem-estar Ativo" when monitoring is active
  useStealthNotification(audioTrigger.isCapturing);
  
  // Ref to track if we auto-started the recording (to avoid duplicate toasts)
  const autoRecordingStartedRef = useRef(false);
  // Ref to track if audio was started manually via debug panel
  const manualAudioStartRef = useRef(false);

  const handleManualAudioStart = () => {
    manualAudioStartRef.current = true;
  };

  const handleManualAudioStop = () => {
    manualAudioStartRef.current = false;
  };

  // Sync config on mount and every 5 minutes
  useEffect(() => {
    syncConfig();
    const interval = setInterval(syncConfig, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [syncConfig]);

  // Re-sync when app becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncConfig();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [syncConfig]);

  // Auto-request native permissions on mount
  useEffect(() => {
    if (!hasAllRequired && !isPermissionsLoading) {
      console.log('[Home] Requesting native permissions...');
      requestAll();
    }
  }, [hasAllRequired, isPermissionsLoading, requestAll]);

  // Auto-start audio monitoring when in monitoring period (only if permissions granted)
	  // Auto-stop when exiting the period (unless started manually via debug panel)
	  useEffect(() => {
	    if (!hasAllRequired) return; // Don't start monitoring without permissions
	    
	    if (monitoring.dentroHorario && !audioTrigger.isCapturing) {
	      console.log('[Home] Auto-starting audio trigger (dentro do período de monitoramento)');
	      audioTrigger.start();
	    } else if (!monitoring.dentroHorario && audioTrigger.isCapturing && !manualAudioStartRef.current) {
	      console.log('[Home] Auto-stopping audio trigger (fora do período de monitoramento)');
	      audioTrigger.stop();
	    }
	  }, [
	    hasAllRequired,
	    monitoring.dentroHorario, 
	    audioTrigger.isCapturing,
	    audioTrigger.start,
	    audioTrigger.stop,
	    manualAudioStartRef.current, // Add dependency
	  ]);

  // Auto-start recording when discussion is detected
  useEffect(() => {
    const shouldAutoRecord = 
      audioTrigger.discussionOn && 
      !recording.isRecording && 
      !panic.isPanicActive &&
      !autoRecordingStartedRef.current;

    if (shouldAutoRecord) {
      autoRecordingStartedRef.current = true;
      recording.startRecording('automatico').then(success => {
        if (success) {
          appState.setStatus('recording');
          toast({
            title: 'Gravação automática iniciada',
            description: 'Discussão detectada pelo monitoramento.',
          });
        } else {
          autoRecordingStartedRef.current = false;
        }
      });
    }
    
    // Reset the ref when discussion ends and recording stops
    if (!audioTrigger.discussionOn && !recording.isRecording) {
      autoRecordingStartedRef.current = false;
    }
  }, [audioTrigger.discussionOn, recording.isRecording, panic.isPanicActive, appState, toast]);

  const [isRecordLoading, setIsRecordLoading] = useState(false);

  const handleRecordToggle = async () => {
    if (isRecordLoading) return; // Prevent multiple clicks
    
    setIsRecordLoading(true);
    try {
      if (recording.isRecording) {
        await recording.stopRecording();
        appState.setStatus('normal');
        toast({
          title: 'Gravação encerrada',
          description: `${recording.segmentsSent} segmentos enviados.`,
        });
      } else {
        const success = await recording.startRecording();
        if (success) {
          appState.setStatus('recording');
          toast({
            title: 'Gravação iniciada',
            description: 'O áudio está sendo enviado em tempo real.',
          });
        } else {
          toast({
            title: 'Erro ao iniciar gravação',
            description: 'Verifique as permissões do microfone.',
            variant: 'destructive',
          });
        }
      }
    } finally {
      setIsRecordLoading(false);
    }
  };

  const handlePanicStart = () => {
    panic.startHold();
  };

  const handlePanicEnd = () => {
    panic.cancelHold();
  };

  const handleLogoutRequest = () => {
    setMenuOpen(false);
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = async () => {
    // Note: onLogout in App.tsx now handles clearing all storage via Preferences
    setLogoutDialogOpen(false);
    onLogout();
  };

  // Show permissions request screen if permissions are not granted
  // Desativado temporariamente para permitir pop-ups nativos diretos
  /*
  if (!isPermissionsLoading && !hasAllRequired) {
    return (
      <PermissionsRequest
        permissions={permissions}
        onRequestAll={requestAll}
      />
    );
  }
  */

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-inset-top safe-area-inset-bottom relative overflow-hidden">
      {/* Background watermark logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img 
          src={amparaCircleLogo} 
          alt="" 
          className="w-[3200px] h-[3200px] object-contain opacity-20"
        />
      </div>
      {/* Header */}
	      <header className="flex items-center justify-between px-4 py-2 bg-background">
	        <Logo size="sm" />
	        <div className="flex items-center gap-2">
          {/* Upload file button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/upload')}
              >
                <Upload className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px] text-center">
              <p>Enviar arquivo de áudio gravado fora do app para incluir no seu perfil e análise</p>
            </TooltipContent>
          </Tooltip>

          {/* Pending uploads badge */}
          {appState.pendingUploads > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/pending')}
                  className="relative"
                >
                  <Triangle className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-warning text-warning-foreground text-xs rounded-full flex items-center justify-center">
                    {appState.pendingUploads}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Uploads pendentes</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Menu button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center p-6">
        
	        {/* Top section: Audio meter with integrated monitoring status */}
	        {!panic.isPanicActive && (
	          <div className="w-full max-w-sm flex flex-col items-center pt-4 mb-auto">
	            <AudioTriggerDebugPanel 
	              audioTrigger={audioTrigger}
	              onManualStart={handleManualAudioStart}
	              onManualStop={handleManualAudioStop}
	            />
	            <AudioTriggerMeter 
	              score={audioTrigger.metrics?.score ?? 0}
	              isCapturing={audioTrigger.isCapturing}
	              state={audioTrigger.state}
	              isRecording={recording.isRecording}
	              recordingDuration={recording.duration}
	              recordingOrigin={recording.origemGravacao}
	              dentroHorario={monitoring.dentroHorario}
	              periodoAtualIndex={monitoring.periodoAtualIndex}
	              periodosHoje={monitoring.periodosHoje}
	              periodosSemana={periodosSemana}
	              isLoading={isConfigLoading}
	            />
	          </div>
	        )}

        {/* Center section: Panic button + Record button */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {!panic.isPanicActive ? (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <PanicButton
                  onHoldStart={handlePanicStart}
                  onHoldEnd={handlePanicEnd}
                  isActivating={panic.isActivating}
                  disabled={recording.isRecording}
                  isLoading={isConfigLoading}
                />
              </motion.div>
              
              {/* Recording button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <RecordButton
                  onClick={handleRecordToggle}
                  isRecording={recording.isRecording}
                  disabled={panic.isActivating}
                  isLoading={isRecordLoading}
                />
              </motion.div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-6"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.03, 1], 
                  opacity: [1, 0.8, 1] 
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="text-6xl font-bold text-destructive"
              >
                {formatDuration(panic.panicDuration)}
              </motion.div>
              
              <motion.button
                onClick={() => navigate('/panic-active')}
                className={`
                  w-32 h-32 rounded-full bg-gradient-safe 
                  flex flex-col items-center justify-center 
                  ${panic.canCancel() ? 'pulse-safe' : 'opacity-50'}
                `}
                whileTap={panic.canCancel() ? { scale: 0.95 } : {}}
              >
                {panic.canCancel() ? (
                  <>
                    <span className="text-xl font-bold text-white">Cancelar</span>
                    <span className="text-[10px] text-white/80 mt-1">Agora estou segura</span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-white">Aguarde 5s...</span>
                )}
              </motion.button>
            </motion.div>
          )}
        </div>
      </main>

      {/* Powered by footer */}
      <footer className="py-4 px-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[6px] text-muted-foreground/60">powered by</span>
          <img src={orizonLogo} alt="Orizon Tech" className="h-4 object-contain mix-blend-multiply opacity-70" />
        </div>
      </footer>


      {/* Side menu */}
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50"
          onClick={() => setMenuOpen(false)}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute right-0 top-0 bottom-0 w-72 bg-card border-l border-border p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-semibold">Menu</h2>
              <Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <nav className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3"
                onClick={() => {
                  navigate('/pending');
                  setMenuOpen(false);
                }}
              >
                <Triangle className="w-5 h-5 text-amber-400 fill-amber-400" />
                Pendências
                {appState.pendingUploads > 0 && (
                  <span className="ml-auto bg-warning text-warning-foreground text-xs px-2 py-0.5 rounded-full">
                    {appState.pendingUploads}
                  </span>
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start gap-3"
                onClick={() => {
                  navigate('/upload');
                  setMenuOpen(false);
                }}
              >
                <Upload className="w-5 h-5" />
                Enviar arquivo
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start gap-3"
                onClick={() => {
                  navigate('/schedule');
                  setMenuOpen(false);
                }}
              >
                <Calendar className="w-5 h-5" />
                Agenda de monitoramento
              </Button>

              <div className="pt-4 border-t border-border mt-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                  onClick={handleLogoutRequest}
                >
                  <LogOut className="w-5 h-5" />
                  Sair
                </Button>
              </div>
            </nav>
          </motion.div>
        </motion.div>
      )}

      {/* Logout confirmation dialog */}
      <LogoutConfirmDialog
        isOpen={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
