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
}

export function MonitoringStatus({
  dentroHorario,
  periodoAtualIndex,
  periodosHoje,
  gravacaoInicio,
  gravacaoFim,
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

  // Active monitoring
  if (dentroHorario && currentPeriod) {
    const endTime = parseTime(currentPeriod.fim);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-emerald-500">Monitoramento Ativo</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {currentPeriod.inicio} - {currentPeriod.fim}
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-emerald-500/20">
          <p className="text-sm text-muted-foreground">
            Termina em <span className="font-medium text-foreground">{formatTimeDiff(endTime)}</span>
          </p>
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
        className="w-full max-w-sm bg-amber-500/10 border border-amber-500/30 rounded-xl p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <span className="font-medium text-amber-500">Próximo Monitoramento</span>
            <p className="text-sm text-muted-foreground">
              {nextPeriod.inicio} - {nextPeriod.fim}
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-amber-500/20">
          <p className="text-sm text-muted-foreground">
            Inicia em <span className="font-medium text-foreground">{formatTimeDiff(startTime)}</span>
          </p>
        </div>
      </motion.div>
    );
  }

  // No more periods today
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm bg-muted/50 border border-border rounded-xl p-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <Moon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <span className="font-medium text-muted-foreground">Sem monitoramento hoje</span>
          {periodosHoje.length > 0 && (
            <p className="text-sm text-muted-foreground/70">
              Próximo: amanhã às {periodosHoje[0].inicio}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
