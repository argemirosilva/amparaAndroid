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
        relative px-6 py-3 rounded-full
        flex items-center justify-center gap-2
        transition-all duration-200
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
        ${isRecording 
          ? 'bg-destructive text-white hover:bg-destructive/90' 
          : 'bg-primary text-primary-foreground hover:bg-primary/90'
        }
      `}
      whileTap={isDisabled ? undefined : { scale: 0.95 }}
    >
      {/* Icon */}
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isRecording ? (
        <Square className="w-5 h-5" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
      
      {/* Text */}
      <span className="font-medium">
        {isRecording ? 'Parar Gravação' : 'Gravar'}
      </span>
    </motion.button>
  );
}
