import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Mic, AlertTriangle, CheckCircle } from 'lucide-react';
import type { AppStatus } from '@/lib/appState';

interface StatusIndicatorProps {
  status: AppStatus;
  pendingUploads: number;
}

export function StatusIndicator({ status, pendingUploads }: StatusIndicatorProps) {
  const statusConfig = {
    normal: {
      icon: CheckCircle,
      label: 'Monitoramento ativo',
      color: 'text-success',
      bgColor: 'bg-success/20',
      borderColor: 'border-success/30',
    },
    recording: {
      icon: Mic,
      label: 'Gravando',
      color: 'text-warning',
      bgColor: 'bg-warning/20',
      borderColor: 'border-warning/30',
    },
    panic: {
      icon: AlertTriangle,
      label: 'Proteção ativa',
      color: 'text-destructive',
      bgColor: 'bg-destructive/20',
      borderColor: 'border-destructive/30',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Main status badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`
          flex items-center gap-3 px-5 py-3 rounded-full
          ${config.bgColor} border ${config.borderColor}
        `}
      >
        {status === 'panic' || status === 'recording' ? (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Icon className={`w-5 h-5 ${config.color}`} />
          </motion.div>
        ) : (
          <Icon className={`w-5 h-5 ${config.color}`} />
        )}
        <span className={`font-medium ${config.color}`}>{config.label}</span>
      </motion.div>

      {/* Pending uploads badge */}
      {pendingUploads > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-warning/10 border border-warning/30"
        >
          <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
          <span className="text-sm text-warning">
            Pendentes: {pendingUploads}
          </span>
        </motion.div>
      )}
    </div>
  );
}
