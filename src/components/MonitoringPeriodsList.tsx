import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp, Shield, CheckCircle } from 'lucide-react';
import { MonitoringPeriod } from '@/lib/types';

interface MonitoringPeriodsListProps {
  periodosHoje: MonitoringPeriod[];
  periodoAtualIndex: number | null;
  isLoading?: boolean;
}

export function MonitoringPeriodsList({
  periodosHoje,
  periodoAtualIndex,
  isLoading = false,
}: MonitoringPeriodsListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [now, setNow] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Determine status for each period
  const periodsWithStatus = useMemo(() => {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return periodosHoje.map((period, index) => {
      const [startH, startM] = period.inicio.split(':').map(Number);
      const [endH, endM] = period.fim.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      let status: 'completed' | 'active' | 'upcoming';
      if (index === periodoAtualIndex) {
        status = 'active';
      } else if (endMinutes <= currentMinutes) {
        status = 'completed';
      } else {
        status = 'upcoming';
      }

      return { ...period, status };
    });
  }, [periodosHoje, periodoAtualIndex, now]);

  if (isLoading) {
    return (
      <div className="w-full max-w-sm bg-muted/30 border border-border rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted animate-pulse" />
          <div className="h-3 w-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (periodosHoje.length === 0) {
    return (
      <div className="w-full max-w-sm bg-muted/30 border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Nenhum período agendado para hoje</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      layout
      className="w-full max-w-sm bg-card border border-border rounded-lg overflow-hidden"
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            Horários de hoje ({periodosHoje.length})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border"
          >
            <div className="p-2 space-y-1">
              {periodsWithStatus.map((period, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-3 p-2 rounded-md ${
                    period.status === 'active'
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : period.status === 'completed'
                      ? 'bg-muted/30 opacity-60'
                      : 'bg-muted/10'
                  }`}
                >
                  {/* Status icon */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      period.status === 'active'
                        ? 'bg-emerald-500/20'
                        : period.status === 'completed'
                        ? 'bg-muted'
                        : 'bg-primary/10'
                    }`}
                  >
                    {period.status === 'active' ? (
                      <Shield className="w-3 h-3 text-emerald-500" />
                    ) : period.status === 'completed' ? (
                      <CheckCircle className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <Clock className="w-3 h-3 text-primary" />
                    )}
                  </div>

                  {/* Time range */}
                  <div className="flex-1">
                    <span
                      className={`text-sm font-medium ${
                        period.status === 'active'
                          ? 'text-emerald-500'
                          : period.status === 'completed'
                          ? 'text-muted-foreground line-through'
                          : 'text-foreground'
                      }`}
                    >
                      {period.inicio} - {period.fim}
                    </span>
                  </div>

                  {/* Status label */}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      period.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-500'
                        : period.status === 'completed'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {period.status === 'active'
                      ? 'Ativo'
                      : period.status === 'completed'
                      ? 'Concluído'
                      : 'Aguardando'}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
