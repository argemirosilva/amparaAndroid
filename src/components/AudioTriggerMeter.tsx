/**
 * Audio Trigger Meter - Minimalist circular meter with integrated monitoring status
 * Shows detection proximity and monitoring period info in a unified component
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Ear, EarOff } from 'lucide-react';
import type { TriggerState } from '@/types/audioTrigger';
import type { MonitoringPeriod } from '@/lib/types';

export type MonitoringStatusType = 'active' | 'next' | 'none' | 'loading';

interface AudioTriggerMeterProps {
  score: number;
  isCapturing: boolean;
  state: TriggerState;
  isRecording: boolean;
  recordingDuration?: number;
  // Monitoring status props
  dentroHorario?: boolean;
  periodoAtualIndex?: number | null;
  periodosHoje?: MonitoringPeriod[];
  isLoading?: boolean;
}

// Linear interpolation between two hex colors
const lerpColor = (color1: string, color2: string, ratio: number): string => {
  const hex = (c: string) => parseInt(c, 16);
  const r1 = hex(color1.slice(1, 3));
  const g1 = hex(color1.slice(3, 5));
  const b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3));
  const g2 = hex(color2.slice(3, 5));
  const b2 = hex(color2.slice(5, 7));
  
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  
  return `rgb(${r}, ${g}, ${b})`;
};

// Get gradient color based on score (0-7)
const getGradientColor = (score: number): string => {
  const ratio = Math.min(score / 7, 1);
  
  if (ratio <= 0.5) {
    // Darker Green (#16a34a) → Yellow (#eab308)
    return lerpColor('#16a34a', '#eab308', ratio * 2);
  } else {
    // Yellow (#eab308) → Red (#ef4444)
    return lerpColor('#eab308', '#ef4444', (ratio - 0.5) * 2);
  }
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function AudioTriggerMeter({
  score,
  isCapturing,
  state,
  isRecording,
  recordingDuration = 0,
  dentroHorario = false,
  periodoAtualIndex = null,
  periodosHoje = [],
  isLoading = false,
}: AudioTriggerMeterProps) {
  const [now, setNow] = useState(new Date());

  // Update time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const size = 56;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Use 270° arc (75% of circle)
  const arcLength = circumference * 0.75;
  const progress = Math.min(score / 7, 1);
  const offset = arcLength * (1 - progress);
  
  const strokeColor = getGradientColor(score);

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

  // Determine monitoring status
  const monitoringStatus: MonitoringStatusType = isLoading 
    ? 'loading' 
    : dentroHorario && currentPeriod 
      ? 'active' 
      : nextPeriod 
        ? 'next' 
        : 'none';

  // Get status text for recording
  const getRecordingText = () => {
    if (state === 'RECORDING') return `REC ${formatDuration(recordingDuration)}`;
    return null;
  };

  const recordingText = getRecordingText();

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Circular meter */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-[135deg]"
        >
          {/* Background arc - more transparent */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted) / 0.4)"
            strokeWidth={strokeWidth}
            strokeDasharray={arcLength}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
          
          {/* Progress arc with gradient color */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={arcLength}
            strokeLinecap="round"
            initial={{ strokeDashoffset: arcLength }}
            animate={{ 
              strokeDashoffset: offset,
              stroke: strokeColor,
            }}
            transition={{ 
              strokeDashoffset: { duration: 0.5, ease: 'easeOut' },
              stroke: { duration: 0.3 },
            }}
            style={{
              filter: isRecording ? `drop-shadow(0 0 6px ${strokeColor})` : 'none',
            }}
          />
        </svg>
        
        {/* Center icon with sound waves */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Sound wave animations */}
          {isCapturing && (
            <>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border"
                  style={{ 
                    borderColor: strokeColor,
                    width: 18,
                    height: 18,
                  }}
                  initial={{ scale: 0.8, opacity: 0.6 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </>
          )}
          
          <motion.div
            animate={isCapturing ? {
              scale: [1, 1.1, 1],
            } : {}}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className={`p-1.5 rounded-full relative z-10 ${
              isRecording 
                ? 'bg-destructive/10' 
                : isCapturing 
                  ? 'bg-success/10' 
                  : 'bg-muted/40'
            }`}
            style={isRecording ? {
              boxShadow: `0 0 12px ${strokeColor}`,
            } : undefined}
          >
            {isCapturing ? (
              <Ear 
                className="w-3.5 h-3.5" 
                style={{ color: strokeColor }}
              />
            ) : (
              <EarOff className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </motion.div>
        </div>
      </div>
      
      {/* Recording status text */}
      {recordingText && (
        <motion.span
          key={recordingText}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-medium text-destructive"
        >
          {recordingText}
        </motion.span>
      )}

      {/* Integrated monitoring status */}
      {!recordingText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-0.5"
        >
          {monitoringStatus === 'loading' && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
              <span className="text-xs text-muted-foreground">Carregando...</span>
            </div>
          )}

          {monitoringStatus === 'active' && currentPeriod && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-500">Ativo</span>
                <span className="text-[10px] text-muted-foreground">{currentPeriod.inicio}-{currentPeriod.fim}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Termina em {formatTimeDiff(parseTime(currentPeriod.fim))}
              </span>
            </>
          )}

          {monitoringStatus === 'next' && nextPeriod && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-xs font-medium text-primary">Próximo</span>
                <span className="text-[10px] text-muted-foreground">{nextPeriod.inicio}-{nextPeriod.fim}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Inicia em {formatTimeDiff(parseTime(nextPeriod.inicio))}
              </span>
            </>
          )}

          {monitoringStatus === 'none' && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
              <span className="text-xs text-muted-foreground">Sem monitoramento</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
