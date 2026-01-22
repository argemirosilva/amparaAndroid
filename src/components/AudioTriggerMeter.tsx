/**
 * Audio Trigger Meter - Minimalist circular meter with gradient colors
 * Shows detection proximity without numbers, using color gradients only
 */

import { motion } from 'framer-motion';
import { Ear, EarOff } from 'lucide-react';
import type { TriggerState } from '@/types/audioTrigger';

interface AudioTriggerMeterProps {
  score: number;
  isCapturing: boolean;
  state: TriggerState;
  isRecording: boolean;
  recordingDuration?: number;
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
    // Green (#22c55e) → Yellow (#eab308)
    return lerpColor('#22c55e', '#eab308', ratio * 2);
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
}: AudioTriggerMeterProps) {
  const size = 56;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Use 270° arc (75% of circle)
  const arcLength = circumference * 0.75;
  const progress = Math.min(score / 7, 1);
  const offset = arcLength * (1 - progress);
  
  const strokeColor = getGradientColor(score);
  
  const getStatusText = () => {
    if (state === 'RECORDING') return `REC ${formatDuration(recordingDuration)}`;
    return null;
  };

  const statusText = getStatusText();

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Circular meter */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-[135deg]"
        >
          {/* Background arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
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
                ? 'bg-destructive/20' 
                : isCapturing 
                  ? 'bg-success/20' 
                  : 'bg-muted'
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
      
      {/* Status text - only when recording */}
      {statusText && (
        <motion.span
          key={statusText}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-medium text-destructive"
        >
          {statusText}
        </motion.span>
      )}
    </div>
  );
}
