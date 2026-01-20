import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePanicContext } from '@/contexts/PanicContext';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';

export function PanicActivePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const appState = useAppState();
  const panic = usePanicContext();

  const handleCancelPanic = async () => {
    setIsCancelling(true);
    
    await panic.deactivatePanic();
    appState.setStatus('normal');
    toast({
      title: 'Proteção desativada',
      description: 'O modo pânico foi encerrado.',
    });
    navigate('/');
    
    setIsCancelling(false);
  };

  const canCancel = panic.canCancel();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background safe-area-inset-top safe-area-inset-bottom p-6">
      {/* Timer with pulse effect */}
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
        className="text-8xl font-bold text-destructive mb-12"
      >
        {formatDuration(panic.panicDuration)}
      </motion.div>

      {/* Cancel button */}
      <Button
        variant="outline"
        size="lg"
        onClick={() => setShowConfirmModal(true)}
        disabled={!canCancel}
        className={`
          rounded-xl px-8
          ${!canCancel ? 'opacity-30' : 'opacity-60 hover:opacity-100'}
        `}
      >
        {canCancel ? 'Cancelar proteção' : 'Aguarde 5s...'}
      </Button>

      {/* Confirm modal */}
      {showConfirmModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
          onClick={() => setShowConfirmModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Cancelar proteção</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowConfirmModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <p className="text-muted-foreground text-sm mb-6">
              Tem certeza que deseja cancelar a proteção?
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowConfirmModal(false)}
                disabled={isCancelling}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancelPanic}
                disabled={isCancelling}
              >
                {isCancelling ? 'Cancelando...' : 'Confirmar'}
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
