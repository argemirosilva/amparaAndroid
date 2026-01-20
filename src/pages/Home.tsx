import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Settings, Clock, Menu, LogOut, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import orizonLogo from '@/assets/orizon-tech-logo.png';
import { PanicButton } from '@/components/PanicButton';
import { RecordButton } from '@/components/RecordButton';

import { MonitoringStatus } from '@/components/MonitoringStatus';
import { MonitoringPeriodsList } from '@/components/MonitoringPeriodsList';
import { usePanic } from '@/hooks/usePanic';
import { useRecording } from '@/hooks/useRecording';
import { useAppState } from '@/hooks/useAppState';
import { useConfig } from '@/hooks/useConfig';
import { useToast } from '@/hooks/use-toast';

interface HomePageProps {
  onLogout: () => void;
}

export function HomePage({ onLogout }: HomePageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  
  const appState = useAppState();
  const panic = usePanic();
  const recording = useRecording();
  const { monitoring, isLoading: isConfigLoading, syncConfig } = useConfig();

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

  const handleRecordToggle = async () => {
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
  };

  const handlePanicStart = () => {
    panic.startHold();
  };

  const handlePanicEnd = () => {
    panic.cancelHold();
  };

  const handleLogout = () => {
    localStorage.removeItem('ampara_token');
    onLogout();
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-inset-top safe-area-inset-bottom">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
        <div className="mix-blend-multiply">
          <Logo size="sm" />
        </div>
        <div className="flex items-center gap-2">
          {/* Upload file button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/upload')}
          >
            <Upload className="w-5 h-5" />
          </Button>

          {/* Pending uploads badge */}
          {appState.pendingUploads > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/pending')}
              className="relative"
            >
              <Clock className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-warning text-warning-foreground text-xs rounded-full flex items-center justify-center">
                {appState.pendingUploads}
              </span>
            </Button>
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
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-8">

        {/* Monitoring status */}
        {!panic.isPanicActive && !recording.isRecording && (
          <div className="w-full max-w-sm flex flex-col gap-2">
            <MonitoringStatus
              dentroHorario={monitoring.dentroHorario}
              periodoAtualIndex={monitoring.periodoAtualIndex}
              periodosHoje={monitoring.periodosHoje}
              gravacaoInicio={monitoring.gravacaoInicio}
              gravacaoFim={monitoring.gravacaoFim}
              isLoading={isConfigLoading}
            />
            <MonitoringPeriodsList
              periodosHoje={monitoring.periodosHoje}
              periodoAtualIndex={monitoring.periodoAtualIndex}
              isLoading={isConfigLoading}
            />
          </div>
        )}

        {/* Panic button */}
        {!panic.isPanicActive ? (
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
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="text-6xl font-bold text-destructive mb-4">
              {formatDuration(panic.panicDuration)}
            </div>
            <p className="text-muted-foreground mb-8">Proteção ativa</p>
            <Button
              variant="outline"
              onClick={() => navigate('/panic-active')}
              className="opacity-50"
            >
              Cancelar (requer senha)
            </Button>
          </motion.div>
        )}

        {/* Recording button (only when not in panic mode) */}
        {!panic.isPanicActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-4"
          >
            <RecordButton
              onClick={handleRecordToggle}
              isRecording={recording.isRecording}
              disabled={panic.isActivating}
            />
            {recording.isRecording && (
              <div className="text-center">
                <p className="text-warning font-medium">
                  {formatDuration(recording.duration)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {recording.segmentsSent} segmentos enviados
                </p>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Powered by footer */}
      <footer className="py-4 flex flex-col items-center gap-1">
        <span className="text-xs text-muted-foreground">powered by</span>
        <img src={orizonLogo} alt="Orizon Tech" className="h-6 object-contain" />
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
                <Upload className="w-5 h-5" />
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
                  setMenuOpen(false);
                }}
              >
                <Settings className="w-5 h-5" />
                Configurações
              </Button>

              <div className="pt-4 border-t border-border mt-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="w-5 h-5" />
                  Sair
                </Button>
              </div>
            </nav>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
