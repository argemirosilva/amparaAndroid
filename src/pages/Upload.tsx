import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, File, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getSessionToken, getUserEmail } from '@/lib/api';
import { getDeviceId } from '@/lib/deviceId';
import { addPendingUpload } from '@/lib/appState';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import { isAudioFile, convertAudioTo16kWav, getConvertedFileName } from '@/lib/audioConverter';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'converting';

const API_URL = import.meta.env.VITE_API_BASE_URL ||
  'https://uogenwcycqykfsuongrl.supabase.co/functions/v1/mobile-api';

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2Vud2N5Y3F5a2ZzdW9uZ3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjg2NjIsImV4cCI6MjA4NjQwNDY2Mn0.hncTs6DDS-sbb8sT_QBOBf1mTcTu0e_Pc5yXo4tHZwE';

export function UploadPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const appState = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setOriginalSize(file.size);
    setConvertedBlob(null);
    setUploadStatus('idle');
    setUploadProgress(0);

    // If it's an audio file, convert to 16kHz WAV
    if (isAudioFile(file)) {
      setUploadStatus('converting');
      try {
        const converted = await convertAudioTo16kWav(file);
        setConvertedBlob(converted);
        setUploadStatus('idle');
        toast({
          title: 'Áudio otimizado',
          description: `${formatSize(file.size)} → ${formatSize(converted.size)}`,
        });
      } catch (error) {
        console.error('Failed to convert audio:', error);
        setUploadStatus('idle');
        toast({
          title: 'Aviso',
          description: 'Não foi possível otimizar o áudio. Será enviado no formato original.',
          variant: 'destructive',
        });
      }
    }
  };

  const uploadFileWithProgress = async (
    file: File | Blob,
    fileName: string,
    onProgress: (progress: number) => void
  ): Promise<{ success: boolean; error: string | null }> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      formData.append('action', 'uploadArquivo');
      formData.append('session_token', getSessionToken() || '');
      formData.append('device_id', getDeviceId());
      formData.append('email_usuario', getUserEmail() || '');
      formData.append('origem_gravacao', 'upload_arquivo');
      formData.append('audio', file, fileName);
      formData.append('timestamp', new Date().toISOString());

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ success: true, error: null });
        } else {
          resolve({ success: false, error: 'Upload failed' });
        }
      });

      xhr.addEventListener('error', () => {
        resolve({ success: false, error: 'Network error' });
      });

      xhr.open('POST', API_URL);
      xhr.setRequestHeader('apikey', API_KEY);
      xhr.send(formData);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadProgress(0);

    // Use converted blob if available, otherwise use original file
    let fileToUpload: File | Blob = selectedFile;
    if (convertedBlob) {
      fileToUpload = new Blob([convertedBlob], { type: 'audio/wav' });
    }

    const fileName = convertedBlob
      ? getConvertedFileName(selectedFile.name)
      : selectedFile.name;

    const { success } = await uploadFileWithProgress(
      fileToUpload,
      fileName,
      (progress) => setUploadProgress(progress)
    );

    if (success) {
      setUploadStatus('success');
      toast({
        title: 'Arquivo enviado!',
        description: selectedFile.name,
      });
    } else {
      setUploadStatus('error');

      // Add to pending queue
      const reader = new FileReader();
      reader.onloadend = () => {
        addPendingUpload({
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          type: 'file',
          data: reader.result as string,
        });
        appState.refreshPendingCount();
      };
      reader.readAsDataURL(selectedFile);

      toast({
        title: 'Falha no envio',
        description: 'Arquivo salvo para envio posterior.',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setConvertedBlob(null);
    setOriginalSize(0);
    setUploadStatus('idle');
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-inset-top safe-area-inset-bottom">
      {/* Header */}
      <header
        className="flex items-center gap-4 px-4 pb-3 border-b border-border"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <h1 className="text-lg font-semibold">Enviar Arquivo</h1>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Description */}
        <div className="w-full max-w-sm mb-6">
          <p className="text-sm text-muted-foreground text-center">
            Envie arquivos de áudio gravados fora do app para incluir no seu perfil e análise.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="*/*"
        />

        {!selectedFile ? (
          // File selection area
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => fileInputRef.current?.click()}
            className="w-full max-w-sm aspect-square rounded-2xl border-2 border-dashed border-border bg-card/50 flex flex-col items-center justify-center gap-4 transition-colors hover:border-primary hover:bg-card"
          >
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium mb-1">Selecionar arquivo</p>
              <p className="text-sm text-muted-foreground">
                Toque para escolher
              </p>
            </div>
          </motion.button>
        ) : (
          // File preview and upload
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm"
          >
            {/* File card */}
            <div className="bg-card rounded-2xl p-6 border border-border mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  {uploadStatus === 'converting' ? (
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  ) : (
                    <File className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate mb-1">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {convertedBlob ? (
                      <span>
                        <span className="line-through">{formatSize(originalSize)}</span>
                        {' → '}
                        <span className="text-primary font-medium">{formatSize(convertedBlob.size)}</span>
                      </span>
                    ) : (
                      formatSize(selectedFile.size)
                    )}
                  </p>
                </div>
                {uploadStatus === 'idle' && (
                  <Button variant="ghost" size="icon" onClick={handleReset}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Converting status */}
              {uploadStatus === 'converting' && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Otimizando áudio...
                  </p>
                </div>
              )}

              {/* Progress bar */}
              {uploadStatus === 'uploading' && (
                <div className="mt-4">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    {uploadProgress}%
                  </p>
                </div>
              )}

              {/* Status icons */}
              {uploadStatus === 'success' && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center justify-center gap-2 mt-4 text-success"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Enviado com sucesso!</span>
                </motion.div>
              )}

              {uploadStatus === 'error' && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center justify-center gap-2 mt-4 text-destructive"
                >
                  <AlertCircle className="w-5 h-5" />
                  <span>Falha no envio</span>
                </motion.div>
              )}
            </div>

            {/* Actions */}
            {(uploadStatus === 'idle' || uploadStatus === 'converting') && (
              <Button
                onClick={handleUpload}
                disabled={uploadStatus === 'converting'}
                className="w-full h-14 text-lg bg-gradient-primary"
              >
                {uploadStatus === 'converting' ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 mr-2" />
                )}
                {uploadStatus === 'converting' ? 'Otimizando...' : 'Enviar arquivo'}
              </Button>
            )}

            {(uploadStatus === 'success' || uploadStatus === 'error') && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/')}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleReset}
                >
                  Enviar outro
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Bottom back button */}
      <div
        className="border-t border-border px-4 pt-3 bg-background/70 backdrop-blur-md"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <Button
          variant="outline"
          className="w-full h-11"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    </div>
  );
}
