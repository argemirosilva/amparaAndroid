import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePanicContext } from '@/contexts/PanicContext';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import { PasswordValidationDialog } from '@/components/PasswordValidationDialog';

export function PanicActivePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isCoercionMode, setIsCoercionMode] = useState(false);

  const appState = useAppState();
  const panic = usePanicContext();

  const handlePasswordValidated = async (loginTipo: 'normal' | 'coacao') => {
    setShowPasswordDialog(false);
    setIsCancelling(true);

    if (loginTipo === 'coacao') {
      console.log('[PanicActive] MODO COAÇÃO DETECTADO - Simulando cancelamento');
      setIsCoercionMode(true);
      toast({
        title: 'Proteção desativada',
        description: 'O modo pânico foi encerrado.',
      });
      navigate('/');
      setIsCancelling(false);
      return;
    }

    console.log('[PanicActive] Cancelando pânico (modo normal)');
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
    <>
      <PasswordValidationDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onValidated={handlePasswordValidated}
        title="Confirmar Cancelamento"
        description="Digite sua senha para cancelar o modo pânico"
      />

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
          className="text-4xl font-bold text-destructive mb-12"
        >
          {formatDuration(panic.panicDuration)}
        </motion.div>

        {/* Cancel button with immediate password request */}
        <motion.button
          onClick={() => {
            if (canCancel && !isCancelling) {
              setShowPasswordDialog(true);
            }
          }}
          disabled={!canCancel || isCancelling}
          className={`
            relative w-40 h-40 rounded-full bg-secondary
            flex flex-col items-center justify-center 
            transition-all duration-200
            border-2 border-primary/20
            ${canCancel && !isCancelling ? 'shadow-lg active:scale-95' : 'opacity-50'}
          `}
        >
          {canCancel && !isCancelling ? (
            <span className="text-2xl font-bold text-white">
              Cancelar
            </span>
          ) : isCancelling ? (
            <span className="text-lg font-bold text-white">Cancelando...</span>
          ) : (
            <>
              <span className="text-lg font-bold text-white">Aguarde...</span>
              <span className="text-xs text-white/80 mt-1">Disponível em 5s</span>
            </>
          )}
        </motion.button>
      </div>
    </>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
