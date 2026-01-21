/**
 * Audio Trigger Debug Panel
 * Real-time display of audio trigger detection metrics
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Mic, MicOff, RotateCcw, Play, Square, AlertCircle, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import type { AudioTriggerControllerReturn } from '@/hooks/useAudioTriggerController';
import { getGenderIcon, getGenderLabel } from '@/services/genderClassifierService';

interface AudioTriggerDebugPanelProps {
  audioTrigger: AudioTriggerControllerReturn;
  onManualStart?: () => void;
  onManualStop?: () => void;
}

export function AudioTriggerDebugPanel({ 
  audioTrigger, 
  onManualStart, 
  onManualStop 
}: AudioTriggerDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const { 
    isCapturing,
    hasPermission, 
    metrics, 
    state, 
    isRecording, 
    discussionOn,
    config,
    start,
    stop,
    reset,
    updateConfig,
    error
  } = audioTrigger;

  const handleStart = async () => {
    console.log('[DebugPanel] Start button clicked');
    setIsStarting(true);
    try {
      onManualStart?.();
      await start();
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = () => {
    onManualStop?.();
    stop();
  };

  // Sensitivity slider: 1 (low) to 10 (high)
  // Maps to adjustments in thresholds
  const getSensitivityLevel = () => {
    // Calculate based on current thresholds - lower thresholds = higher sensitivity
    const speechWeight = (0.70 - config.speechDensityMin) / 0.40; // 0.30-0.70 range
    const loudWeight = (0.50 - config.loudDensityMin) / 0.40; // 0.10-0.50 range
    const dbWeight = (20 - config.loudDeltaDb) / 12; // 8-20 range
    
    const avg = (speechWeight + loudWeight + dbWeight) / 3;
    return Math.round(avg * 9 + 1); // 1-10
  };

  const handleSensitivityChange = (value: number[]) => {
    const level = value[0];
    // Map 1-10 to threshold adjustments
    // Level 1 = least sensitive (high thresholds)
    // Level 10 = most sensitive (low thresholds)
    const factor = (level - 1) / 9; // 0 to 1
    
    const newConfig = {
      // Speech density: 0.70 (level 1) to 0.30 (level 10)
      speechDensityMin: 0.70 - (factor * 0.40),
      // Loud density: 0.50 (level 1) to 0.10 (level 10)
      loudDensityMin: 0.50 - (factor * 0.40),
      // Loud delta: 20dB (level 1) to 8dB (level 10)
      loudDeltaDb: 20 - (factor * 12),
      // VAD delta: 14dB (level 1) to 5dB (level 10)
      vadDeltaDb: 14 - (factor * 9),
      // Turn taking: 10 (level 1) to 4 (level 10)
      turnTakingMin: 10 - (factor * 6),
    };
    
    updateConfig(newConfig);
  };

  // Calculate normalized values for progress bars
  const normalizedVolume = metrics 
    ? Math.max(0, Math.min(100, ((metrics.dbfsCurrent + 60) / 60) * 100))
    : 0;
  
  const normalizedScore = metrics 
    ? (metrics.score / 7) * 100 
    : 0;

  // State badge colors
  const getStateBadgeVariant = () => {
    switch (state) {
      case 'IDLE': return 'secondary';
      case 'PRE_TRIGGER': return 'default';
      case 'RECORDING': return 'destructive';
      case 'COOLDOWN': return 'outline';
      default: return 'secondary';
    }
  };

  const getStateLabel = () => {
    switch (state) {
      case 'IDLE': return 'Monitorando';
      case 'PRE_TRIGGER': return 'Pré-Trigger';
      case 'RECORDING': return 'Gravando';
      case 'COOLDOWN': return 'Cooldown';
      default: return state;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentSensitivity = getSensitivityLevel();

  return (
    <div className="w-full max-w-sm mx-auto mb-4">
      <div className="bg-muted/50 backdrop-blur-sm border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            {isCapturing ? (
              <Mic className="w-4 h-4 text-success animate-pulse" />
            ) : (
              <MicOff className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="font-medium text-sm">Debug Audio Trigger</span>
            <Badge variant={getStateBadgeVariant()} className="text-xs">
              {getStateLabel()}
            </Badge>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-3 pb-3 space-y-3">
                <Separator />

                {/* Sensitivity Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Sensibilidade</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">
                        {currentSensitivity}/10
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSettings(!showSettings);
                        }}
                      >
                        <Settings2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Baixa</span>
                    <Slider
                      value={[currentSensitivity]}
                      min={1}
                      max={10}
                      step={1}
                      onValueChange={handleSensitivityChange}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground">Alta</span>
                  </div>
                  </div>

                  {/* Confirmation Time Slider */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">Tempo de Confirmação</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {config.startHoldSeconds}s
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">4s</span>
                    <Slider
                      value={[config.startHoldSeconds]}
                      min={4}
                      max={15}
                      step={1}
                      onValueChange={(value) => updateConfig({ startHoldSeconds: value[0] })}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground">15s</span>
                  </div>

                {/* Advanced Settings (collapsible) */}
                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="text-xs space-y-1 bg-background/50 rounded p-2"
                    >
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Speech Min:</span>
                        <span className="font-mono">{(config.speechDensityMin * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Loud Min:</span>
                        <span className="font-mono">{(config.loudDensityMin * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Loud Delta:</span>
                        <span className="font-mono">{config.loudDeltaDb.toFixed(0)} dB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">VAD Delta:</span>
                        <span className="font-mono">{config.vadDeltaDb.toFixed(0)} dB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Turn Taking:</span>
                        <span className="font-mono">{config.turnTakingMin.toFixed(0)}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Separator />

                {/* Debug Status Line */}
                <div className="text-xs text-muted-foreground font-mono bg-background/50 rounded px-2 py-1">
                  capture: {isCapturing ? '✅' : '❌'} | 
                  permission: {hasPermission === null ? '⏳' : hasPermission ? '✅' : '❌'} |
                  starting: {isStarting ? '⏳' : '❌'}
                </div>

                {/* Error display */}
                {error && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                    <AlertCircle className="w-3 h-3" />
                    {error}
                  </div>
                )}

                {/* Volume Section */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Volume</span>
                    <span className="font-mono">
                      {metrics?.dbfsCurrent?.toFixed(1) ?? '--'} dB
                    </span>
                  </div>
                  <Progress value={normalizedVolume} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Noise Floor</span>
                    <span className="font-mono">
                      {metrics?.noiseFloorDb?.toFixed(1) ?? '--'} dB
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Detection Indicators */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${metrics?.speechOn ? 'bg-success' : 'bg-muted-foreground/30'}`} />
                    <span>Fala</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${metrics?.loudOn ? 'bg-warning' : 'bg-muted-foreground/30'}`} />
                    <span>Volume Alto</span>
                  </div>
                </div>

                {/* Gender Classification */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span>{getGenderIcon(metrics?.gender ?? 'UNKNOWN')}</span>
                    <span>{getGenderLabel(metrics?.gender ?? 'UNKNOWN')}</span>
                  </div>
                  <span className="font-mono text-muted-foreground">
                    F0: {metrics?.f0Current?.toFixed(0) ?? '--'} Hz
                  </span>
                </div>

                <Separator />

                {/* Discussion Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Score</span>
                    <span className="font-mono font-medium">
                      {metrics?.score?.toFixed(1) ?? '0'} / 7
                    </span>
                  </div>
                  <Progress 
                    value={normalizedScore} 
                    className={`h-3 ${normalizedScore >= 57 ? '[&>div]:bg-destructive' : normalizedScore >= 28 ? '[&>div]:bg-warning' : ''}`}
                  />
                </div>

                {/* Detailed Metrics */}
                <div className="grid grid-cols-3 gap-1 text-xs text-center">
                  <div className="bg-background/50 rounded p-1">
                    <div className="text-muted-foreground">Speech</div>
                    <div className="font-mono font-medium">
                      {((metrics?.speechDensity ?? 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-background/50 rounded p-1">
                    <div className="text-muted-foreground">Loud</div>
                    <div className="font-mono font-medium">
                      {((metrics?.loudDensity ?? 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-background/50 rounded p-1">
                    <div className="text-muted-foreground">Turns</div>
                    <div className="font-mono font-medium">
                      {metrics?.turnTaking?.toFixed(0) ?? '0'}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Status Indicators */}
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${discussionOn ? 'bg-destructive animate-pulse' : 'bg-muted-foreground/30'}`} />
                    <span className={discussionOn ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                      {discussionOn ? 'DISCUSSÃO ATIVA' : 'Sem discussão'}
                    </span>
                  </div>
                  {isRecording && (
                    <div className="flex items-center gap-1 text-destructive">
                      <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                      <span className="font-mono">
                        REC {formatDuration(metrics?.recordingDuration ?? 0)}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Control Buttons */}
                <div className="flex gap-2">
                  {!isCapturing ? (
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={handleStart}
                      disabled={isStarting}
                      className="flex-1"
                    >
                      {isStarting ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Iniciando...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Iniciar
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={handleStop}
                      className="flex-1"
                    >
                      <Square className="w-3 h-3 mr-1" />
                      Parar
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={reset}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}