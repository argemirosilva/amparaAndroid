import React, { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfig } from '@/hooks/useConfig';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { MonitoringPeriod, PeriodosSemana } from '@/lib/types';

interface DayScheduleProps {
  dayKey: string;
  dayLabel: string;
  periods: MonitoringPeriod[];
  isToday: boolean;
  isActive: boolean;
  activePeriodIndex: number | null;
}

function DaySchedule({ dayKey, dayLabel, periods, isToday, isActive, activePeriodIndex }: DayScheduleProps) {
  const hasPeriods = periods.length > 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        rounded-xl p-4 border transition-colors
        ${isToday 
          ? 'bg-primary/5 border-primary/30' 
          : 'bg-card border-border'
        }
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
            {dayLabel}
          </span>
          {isToday && (
            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
              Hoje
            </span>
          )}
          {isActive && (
            <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ativo
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {hasPeriods ? `${periods.length} período${periods.length > 1 ? 's' : ''}` : 'Sem monitoramento'}
        </span>
      </div>
      
      {hasPeriods ? (
        <div className="space-y-2">
          {periods.map((period, index) => {
            const isCurrentPeriod = isActive && activePeriodIndex === index;
            
            return (
              <div 
                key={index}
                className={`
                  flex items-center gap-2 text-sm rounded-lg px-3 py-2 -mx-3 transition-colors
                  ${isCurrentPeriod 
                    ? 'bg-emerald-500/10 border border-emerald-500/30' 
                    : ''
                  }
                `}
              >
                {isCurrentPeriod && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                )}
                <Clock className={`w-3.5 h-3.5 ${isCurrentPeriod ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                <span className={`font-medium ${isCurrentPeriod ? 'text-emerald-600' : ''}`}>{period.inicio}</span>
                <span className="text-muted-foreground">—</span>
                <span className={`font-medium ${isCurrentPeriod ? 'text-emerald-600' : ''}`}>{period.fim}</span>
                {isCurrentPeriod && (
                  <span className="ml-auto text-[10px] text-emerald-500 font-medium">
                    Ativo agora
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground/70">
          Nenhum período configurado para este dia.
        </p>
      )}
    </motion.div>
  );
}

export function SchedulePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { periodosSemana, monitoring, isLoading, syncConfig } = useConfig();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Sync config on mount to ensure we have the latest data
  useEffect(() => {
    syncConfig();
  }, [syncConfig]);
  
  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const success = await syncConfig();
      if (success) {
        toast({
          title: "Atualizado",
          description: "Períodos atualizados com sucesso",
        });
      } else {
        toast({
          title: "Erro",
          description: "Falha ao atualizar períodos",
          variant: "destructive",
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const dayLabels: Record<string, string> = {
    dom: 'Domingo',
    seg: 'Segunda-feira',
    ter: 'Terça-feira',
    qua: 'Quarta-feira',
    qui: 'Quinta-feira',
    sex: 'Sexta-feira',
    sab: 'Sábado',
  };
  
  // Order days starting from today
  const orderedDays = useMemo(() => {
    const dayKeys = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const today = new Date().getDay(); // 0 = Sunday
    const reordered: string[] = [];
    
    for (let i = 0; i < 7; i++) {
      reordered.push(dayKeys[(today + i) % 7]);
    }
    
    return reordered;
  }, []);
  
  const todayKey = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][new Date().getDay()];
  
  // Count total periods
  const totalPeriods = useMemo(() => {
    if (!periodosSemana) return 0;
    return Object.values(periodosSemana).reduce((sum, periods) => sum + periods.length, 0);
  }, [periodosSemana]);

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-inset-top safe-area-inset-bottom">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Agenda de Monitoramento</h1>
          <p className="text-xs text-muted-foreground">
            Períodos configurados para a semana
          </p>
        </div>
        <Button 
          variant="outline" 
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 overflow-auto">
        {/* Summary card */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-muted/50 rounded-xl p-4 mb-4 border border-border"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {isLoading ? (
                  <Skeleton className="h-4 w-32" />
                ) : totalPeriods > 0 ? (
                  `${totalPeriods} período${totalPeriods > 1 ? 's' : ''} configurado${totalPeriods > 1 ? 's' : ''}`
                ) : (
                  'Nenhum período configurado'
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Configure seus horários no <strong>Portal Ampara</strong>.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Weekly schedule */}
        <div className="space-y-3">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-xl p-4 border border-border bg-card">
                <Skeleton className="h-5 w-24 mb-3" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))
          ) : (
            orderedDays.map((dayKey, index) => {
              const periods = periodosSemana?.[dayKey as keyof PeriodosSemana] || [];
              const isToday = dayKey === todayKey;
              const isActive = isToday && monitoring.dentroHorario;
              const activePeriodIndex = isActive ? monitoring.periodoAtualIndex : null;
              
              return (
                <DaySchedule
                  key={dayKey}
                  dayKey={dayKey}
                  dayLabel={dayLabels[dayKey]}
                  periods={periods}
                  isToday={isToday}
                  isActive={isActive}
                  activePeriodIndex={activePeriodIndex}
                />
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
