import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mic, MicOff, AlertTriangle, Volume2, Users, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAudioTriggerController } from '@/hooks/useAudioTriggerController';
import { getGenderLabel, getGenderIcon } from '@/services/genderClassifierService';

export function AudioTriggerDebugPage() {
  const navigate = useNavigate();
  const {
    isCapturing,
    hasPermission,
    error,
    metrics,
    state,
    isRecording,
    discussionOn,
    start,
    stop,
  } = useAudioTriggerController();

  const handleToggle = async () => {
    if (isCapturing) {
      stop();
    } else {
      await start();
    }
  };

  // Normalize dBFS for display (-60 to 0 range)
  const normalizedVolume = metrics 
    ? Math.max(0, Math.min(100, ((metrics.dbfsCurrent + 60) / 60) * 100))
    : 0;

  const getStateColor = () => {
    switch (state) {
      case 'IDLE': return 'bg-muted text-muted-foreground';
      case 'PRE_TRIGGER': return 'bg-yellow-500/20 text-yellow-600';
      case 'RECORDING': return 'bg-destructive/20 text-destructive';
      case 'COOLDOWN': return 'bg-blue-500/20 text-blue-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Audio Trigger Debug</h1>
      </header>

      <main className="flex-1 p-4 space-y-4 overflow-auto">
        {/* Control Button */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <motion.button
                onClick={handleToggle}
                className={`
                  w-24 h-24 rounded-full flex items-center justify-center
                  transition-colors
                  ${isCapturing 
                    ? 'bg-destructive text-destructive-foreground' 
                    : 'bg-primary text-primary-foreground'
                  }
                `}
                whileTap={{ scale: 0.95 }}
              >
                {isCapturing ? (
                  <MicOff className="w-10 h-10" />
                ) : (
                  <Mic className="w-10 h-10" />
                )}
              </motion.button>
              
              <p className="text-sm text-muted-foreground">
                {isCapturing ? 'Capturando áudio...' : 'Clique para iniciar'}
              </p>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              {hasPermission === false && (
                <p className="text-sm text-destructive">
                  Permissão de microfone negada
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* State Machine */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Estado da Máquina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge className={getStateColor()}>{state}</Badge>
              {isRecording && (
                <span className="text-sm text-destructive animate-pulse">
                  ● REC {metrics?.recordingDuration.toFixed(0)}s
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Discussion Status */}
        <Card className={discussionOn ? 'border-destructive' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Detecção de Discussão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status:</span>
                <Badge variant={discussionOn ? 'destructive' : 'secondary'}>
                  {discussionOn ? '🔴 Discussão Ativa' : 'Normal'}
                </Badge>
              </div>
              
              {metrics && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Score</span>
                      <span className="font-mono">{metrics.score.toFixed(1)} / 7</span>
                    </div>
                    <Progress value={(metrics.score / 7) * 100} className="h-2" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-muted rounded">
                      <div className="font-mono">{(metrics.speechDensity * 100).toFixed(0)}%</div>
                      <div className="text-muted-foreground">Fala</div>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <div className="font-mono">{(metrics.loudDensity * 100).toFixed(0)}%</div>
                      <div className="text-muted-foreground">Volume</div>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <div className="font-mono">{metrics.turnTaking.toFixed(0)}</div>
                      <div className="text-muted-foreground">Turnos</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Audio Metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Métricas de Áudio
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics ? (
              <div className="space-y-4">
                {/* Volume Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Volume (dBFS)</span>
                    <span className="font-mono">{metrics.dbfsCurrent.toFixed(1)} dB</span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${metrics.loudOn ? 'bg-destructive' : 'bg-primary'}`}
                      animate={{ width: `${normalizedVolume}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Noise Floor: {metrics.noiseFloorDb.toFixed(1)} dB</span>
                    <span>{metrics.loudOn ? '🔊 Alto' : '🔈 Normal'}</span>
                  </div>
                </div>

                {/* Speech & Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Fala</div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${metrics.speechOn ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                      <span className="text-sm">{metrics.speechOn ? 'Detectada' : 'Silêncio'}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Ratio: {(metrics.speechRatio * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Gênero</div>
                    <div className="flex items-center gap-2">
                      <span>{getGenderIcon(metrics.gender)}</span>
                      <span className="text-sm">{getGenderLabel(metrics.gender)}</span>
                    </div>
                    {metrics.f0Current && (
                      <div className="text-xs text-muted-foreground mt-1">
                        F0: {metrics.f0Current.toFixed(0)} Hz
                      </div>
                    )}
                  </div>
                </div>

                {/* Pitch Info */}
                {metrics.f0Median2s && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-sm">F0 Mediana (2s)</span>
                      <span className="font-mono text-sm">{metrics.f0Median2s.toFixed(0)} Hz</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Confiança</span>
                      <span>{((metrics.voicingConfidence || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Inicie a captura para ver as métricas
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
