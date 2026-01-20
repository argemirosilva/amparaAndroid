import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePanicContext } from '@/contexts/PanicContext';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';

const HOLD_DURATION_MS = 2000;

export function PanicActivePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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

  const handleHoldStart = () => {
    if (!panic.canCancel() || isCancelling) return;
    
    setHoldProgress(0);
    
    // Progress animation
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / HOLD_DURATION_MS) * 100, 100);
      setHoldProgress(progress);
    }, 16);
    
    // Trigger cancel after hold duration
    holdTimerRef.current = setTimeout(() => {
      clearInterval(progressIntervalRef.current!);
      setHoldProgress(100);
      handleCancelPanic();
    }, HOLD_DURATION_MS);
  };

  const handleHoldEnd = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setHoldProgress(0);
  };

  const canCancel = panic.canCancel();
  const isHolding = holdProgress > 0;

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
        className="text-4xl font-bold text-destructive mb-12"
      >
        {formatDuration(panic.panicDuration)}
      </motion.div>

      {/* Cancel button with hold-to-cancel */}
      <motion.button
        onMouseDown={handleHoldStart}
        onMouseUp={handleHoldEnd}
        onMouseLeave={handleHoldEnd}
        onTouchStart={handleHoldStart}
        onTouchEnd={handleHoldEnd}
        disabled={!canCancel || isCancelling}
        className={`
          relative w-40 h-40 rounded-full bg-gradient-safe 
          flex flex-col items-center justify-center 
          ${canCancel && !isCancelling ? 'pulse-safe' : 'opacity-50'}
        `}
        whileTap={canCancel && !isCancelling ? { scale: 0.95 } : {}}
      >
        {/* Progress ring */}
        {isHolding && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 160 160"
          >
            <circle
              cx="80"
              cy="80"
              r="76"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="8"
            />
            <motion.circle
              cx="80"
              cy="80"
              r="76"
              fill="none"
              stroke="white"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 76}
              strokeDashoffset={2 * Math.PI * 76 * (1 - holdProgress / 100)}
            />
          </svg>
        )}

        {canCancel && !isCancelling ? (
          <>
            <span className="text-2xl font-bold text-white">
              {isHolding ? 'Segure...' : 'Cancelar'}
            </span>
            <span className="text-xs text-white/80 mt-1">
              {isHolding ? '' : 'Agora estou segura'}
            </span>
          </>
        ) : isCancelling ? (
          <span className="text-lg font-bold text-white">Cancelando...</span>
        ) : (
          <span className="text-lg font-bold text-white">Aguarde 5s...</span>
        )}
      </motion.button>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
