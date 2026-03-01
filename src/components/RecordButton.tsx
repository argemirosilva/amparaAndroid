import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Loader2 } from 'lucide-react';

interface RecordButtonProps {
  onClick: () => void;
  isRecording: boolean;
  disabled?: boolean;
  isLoading?: boolean;
}

export function RecordButton({ onClick, isRecording, disabled = false, isLoading = false }: RecordButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={`
        relative w-24 h-24 rounded-full
        flex flex-col items-center justify-center gap-1
        transition-all duration-200
        border border-border luminosity-effect
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
        ${isRecording
          ? 'bg-destructive text-white hover:bg-destructive/90 shadow-glow-recording'
          : 'bg-black text-white hover:bg-black/90'
        }
      `}


      whileTap={isDisabled ? undefined : { scale: 0.95 }}
    >
      {/* Icon */}
      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : isRecording ? (
        <Square className="w-6 h-6 fill-current" />
      ) : (
        <Mic className="w-6 h-6" />
      )}

      {/* Text */}
      <span className="text-[10px] font-medium leading-tight text-center">
        {isRecording ? 'Parar' : 'Gravar'}
      </span>
    </motion.button>
  );
}
