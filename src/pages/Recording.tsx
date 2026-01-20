import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecording } from '@/hooks/useRecording';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import orizonLogo from '@/assets/orizon-tech-logo.png';

export function RecordingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  
  const appState = useAppState();
  const recording = useRecording();

  const handleCancelRecording = async () => {
    await recording.stopRecording();
    appState.setStatus('normal');
    toast({
      title: 'Gravação encerrada',
      description: `${recording.segmentsSent} segmentos foram enviados.`,
    });
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-inset-top safe-area-inset-bottom">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Gravação Ativa</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Pulsing microphone */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="relative mb-8"
        >
          <div className="w-32 h-32 rounded-full bg-gradient-recording flex items-center justify-center pulse-recording">
            <Mic className="w-16 h-16 text-white" />
          </div>
          
          {/* Pulse rings */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-warning"
            animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        {/* Timer */}
        <div className="text-6xl font-bold text-warning mb-2">
          {formatDuration(recording.duration)}
        </div>
        
        <p className="text-muted-foreground text-center mb-4">
          Gravando...
        </p>

        {/* Segment status */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-success">
              ✓ {recording.segmentsSent} enviados
            </span>
            {recording.segmentsPending > 0 && (
              <span className="text-warning">
                ⏳ {recording.segmentsPending} pendentes
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Segmentos de 10s enviados em tempo real
          </p>
        </div>

        {/* Pause/Resume buttons */}
        <div className="flex gap-4 mb-8">
          {recording.isPaused ? (
            <Button onClick={recording.resumeRecording} className="bg-gradient-recording">
              Retomar
            </Button>
          ) : (
            <Button onClick={recording.pauseRecording} variant="outline">
              Pausar
            </Button>
          )}
        </div>

        {/* Cancel button - Green panic-style with pulse */}
        <motion.button
          onClick={() => setShowCancelModal(true)}
          className="w-40 h-40 rounded-full bg-gradient-safe flex flex-col items-center justify-center pulse-safe"
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-2xl font-bold text-white">Cancelar</span>
          <span className="text-xs text-white/80 mt-1">Agora estou segura</span>
        </motion.button>

        <p className="text-xs text-muted-foreground mt-4 text-center max-w-xs">
          A gravação será encerrada automaticamente após 10 minutos de silêncio
        </p>
      </main>

      {/* Powered by footer */}
      <footer className="py-4 flex flex-col items-center gap-1">
        <span className="text-[8px] text-muted-foreground">powered by</span>
        <img src={orizonLogo} alt="Orizon Tech" className="h-5 object-contain mix-blend-multiply" />
      </footer>

      {/* Cancel modal */}
      {showCancelModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
          onClick={() => setShowCancelModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Encerrar gravação</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCancelModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <p className="text-muted-foreground text-sm mb-6">
              Deseja encerrar a gravação?
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelModal(false)}
                disabled={recording.isStopping}
              >
                Voltar
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onClick={handleCancelRecording}
                disabled={recording.isStopping}
              >
                {recording.isStopping && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {recording.isStopping ? 'Finalizando...' : 'Confirmar'}
              </Button>
            </div>
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
