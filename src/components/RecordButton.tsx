import React from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';

interface RecordButtonProps {
  onClick: () => void;
  isRecording: boolean;
  disabled?: boolean;
}

export function RecordButton({ onClick, isRecording, disabled = false }: RecordButtonProps) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        relative w-24 h-24 rounded-full
        flex items-center justify-center
        transition-all duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
        ${isRecording 
          ? 'bg-gradient-recording pulse-recording' 
          : 'bg-card border-2 border-primary hover:bg-primary/10'
        }
      `}
      whileTap={disabled ? undefined : { scale: 0.95 }}
    >
      {/* Recording pulse effect */}
      {isRecording && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full bg-warning/30"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </>
      )}

      {/* Icon */}
      <Mic
        className={`w-10 h-10 z-10 ${
          isRecording ? 'text-white' : 'text-primary'
        }`}
      />
    </motion.button>
  );
}
