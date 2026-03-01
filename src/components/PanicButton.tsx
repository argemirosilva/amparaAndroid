import React from 'react';
import { motion } from 'framer-motion';

interface PanicButtonProps {
  onHoldStart: () => void;
  onHoldEnd: () => void;
  isActivating: boolean;
  isPanicActive?: boolean;
  shouldPulse?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
}

export function PanicButton({
  onHoldStart,
  onHoldEnd,
  isActivating,
  isPanicActive = false,
  shouldPulse = false,
  disabled = false,
  isLoading = false,
}: PanicButtonProps) {


  const isDisabled = disabled || isLoading;
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
        onTouchStart={isDisabled ? undefined : onHoldStart}
        onTouchEnd={isDisabled ? undefined : onHoldEnd}
        onMouseDown={isDisabled ? undefined : onHoldStart}
        onMouseUp={isDisabled ? undefined : onHoldEnd}
        onMouseLeave={isDisabled ? undefined : onHoldEnd}
        disabled={isDisabled}
        className={`
          relative w-[166px] h-[166px] rounded-full
          bg-gradient-panic luminosity-effect
          flex items-center justify-center
          transition-all duration-200
          border-2 border-primary/20
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
          ${isActivating || shouldPulse ? 'shadow-glow-panic' : 'shadow-lg hover:opacity-90'}
          ${shouldPulse ? 'pulse-panic' : ''}
        `}



        whileTap={isDisabled ? undefined : { scale: 0.95 }}
      >

        {/* Progress ring during activation */}
        {isActivating && (
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="83"
              cy="83"
              r="78"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeDasharray="490"
              strokeLinecap="round"
              className="opacity-30"
            />
            <motion.circle
              cx="83"
              cy="83"
              r="78"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeDasharray="490"
              strokeLinecap="round"
              initial={{ strokeDashoffset: 490 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 2, ease: 'linear' }}
            />
          </svg>
        )}

        {/* Button content */}
        <div className="flex flex-col items-center justify-center text-white z-10">
          {isLoading ? (
            <>
              {/* Spinner animation */}
              <motion.div
                className="w-10 h-10 border-4 border-white border-t-transparent rounded-full mb-2"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
              <span className="text-base font-bold tracking-wider">ENVIANDO...</span>
              <span className="text-xs mt-1 opacity-80">Aguarde</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold tracking-wider">
                {isPanicActive ? 'CANCELAR' : 'SOCORRO'}
              </span>
            </>
          )}

        </div>
      </motion.button>

    </div>
  );
}
