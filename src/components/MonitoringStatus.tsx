import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Shield, Moon } from 'lucide-react';
import { MonitoringPeriod } from '@/lib/types';

interface MonitoringStatusProps {
  dentroHorario: boolean;
  periodoAtualIndex: number | null;
  periodosHoje: MonitoringPeriod[];
  gravacaoInicio: string | null;
  gravacaoFim: string | null;
  isLoading?: boolean;
  isAudioMonitoring?: boolean;
  audioScore?: number;
}

export function MonitoringStatus({
  dentroHorario,
  periodoAtualIndex,
  periodosHoje,
  gravacaoInicio,
  gravacaoFim,
  isLoading = false,
  isAudioMonitoring = false,
  audioScore,
}: MonitoringStatusProps) {
  const [now, setNow] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Parse time string "HH:MM" to today's Date
  const parseTime = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // Get current period
  const currentPeriod = useMemo(() => {
    if (periodoAtualIndex !== null && periodosHoje[periodoAtualIndex]) {
      return periodosHoje[periodoAtualIndex];
    }
    return null;
  }, [periodoAtualIndex, periodosHoje]);

  // Get next period
  const nextPeriod = useMemo(() => {
    if (dentroHorario || !periodosHoje.length) return null;
    
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    for (const period of periodosHoje) {
      const [hours, minutes] = period.inicio.split(':').map(Number);
      const periodStart = hours * 60 + minutes;
      if (periodStart > currentTime) {
        return period;
      }
    }
    return null;
  }, [dentroHorario, periodosHoje, now]);

  // Calculate time difference in readable format
  const formatTimeDiff = (targetTime: Date): string => {
    const diff = targetTime.getTime() - now.getTime();
    if (diff <= 0) return '0min';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  // Loading state
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-muted/50 border border-border rounded-lg p-2"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-28 bg-muted rounded animate-pulse" />
            <div className="h-2 w-20 bg-muted/70 rounded animate-pulse" />
          </div>
        </div>
      </motion.div>
    );
  }

  // Active monitoring
  if (dentroHorario && currentPeriod) {
    const endTime = parseTime(currentPeriod.fim);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Shield className="w-3 h-3 text-emerald-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-emerald-500">Ativo</span>
              <span className="text-xs text-muted-foreground">{currentPeriod.inicio}-{currentPeriod.fim}</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                Termina em {formatTimeDiff(endTime)}
              </p>
              {isAudioMonitoring && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  Áudio {audioScore !== undefined ? `${audioScore}/7` : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Next period available
  if (nextPeriod) {
    const startTime = parseTime(nextPeriod.inicio);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-primary/10 border border-primary/30 rounded-lg p-2"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <Clock className="w-3 h-3 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-primary">Próximo</span>
              <span className="text-xs text-muted-foreground">{nextPeriod.inicio}-{nextPeriod.fim}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Inicia em {formatTimeDiff(startTime)}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // No more periods today
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm bg-muted/50 border border-border rounded-lg p-2"
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          <Moon className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <span className="text-sm font-medium text-muted-foreground">Sem monitoramento</span>
          {periodosHoje.length > 0 && (
            <p className="text-xs text-muted-foreground/70">
              Próximo: amanhã {periodosHoje[0].inicio}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
