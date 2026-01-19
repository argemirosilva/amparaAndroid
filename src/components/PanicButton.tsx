import React from 'react';
import { motion } from 'framer-motion';

interface PanicButtonProps {
  onHoldStart: () => void;
  onHoldEnd: () => void;
  isActivating: boolean;
  disabled?: boolean;
}

export function PanicButton({
  onHoldStart,
  onHoldEnd,
  isActivating,
  disabled = false,
}: PanicButtonProps) {
  return (
    <div className="relative">
      {/* Outer pulsing rings */}
      {isActivating && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full bg-destructive"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-0 rounded-full bg-destructive"
            initial={{ scale: 1, opacity: 0.3 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.2, repeat: Infinity }}
          />
        </>
      )}

      {/* Main button */}
      <motion.button
        onTouchStart={disabled ? undefined : onHoldStart}
        onTouchEnd={disabled ? undefined : onHoldEnd}
        onMouseDown={disabled ? undefined : onHoldStart}
        onMouseUp={disabled ? undefined : onHoldEnd}
        onMouseLeave={disabled ? undefined : onHoldEnd}
        disabled={disabled}
        className={`
          relative w-48 h-48 rounded-full
          bg-gradient-panic
          flex items-center justify-center
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
          ${isActivating ? 'animate-pulse-glow scale-105' : 'glow-panic'}
        `}
        whileTap={disabled ? undefined : { scale: 0.95 }}
      >
        {/* Progress ring during activation */}
        {isActivating && (
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="92"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeDasharray="578"
              strokeLinecap="round"
              className="opacity-30"
            />
            <motion.circle
              cx="96"
              cy="96"
              r="92"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeDasharray="578"
              strokeLinecap="round"
              initial={{ strokeDashoffset: 578 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 2, ease: 'linear' }}
            />
          </svg>
        )}

        {/* Button content */}
        <div className="flex flex-col items-center justify-center text-white z-10">
          <span className="text-4xl font-bold tracking-wider">PÂNICO</span>
          <span className="text-sm mt-2 opacity-80">Segure por 2s</span>
        </div>
      </motion.button>

      {/* Helper text */}
      <p className="text-center text-muted-foreground text-sm mt-6">
        {isActivating ? 'Continue segurando...' : 'Segure para ativar proteção'}
      </p>
    </div>
  );
}
