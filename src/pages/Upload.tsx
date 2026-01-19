import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, File, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getSessionToken, getUserEmail } from '@/lib/api';
import { getDeviceId } from '@/lib/deviceId';
import { addPendingUpload } from '@/lib/appState';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

const API_URL = import.meta.env.VITE_API_BASE_URL || 
  'https://ilikiajeduezvvanjejz.supabase.co/functions/v1/mobile-api';

export function UploadPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const appState = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus('idle');
      setUploadProgress(0);
    }
  };

  const uploadFileWithProgress = async (
    file: File,
    onProgress: (progress: number) => void
  ): Promise<{ success: boolean; error: string | null }> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      
      formData.append('action', 'uploadArquivo');
      formData.append('session_token', getSessionToken() || '');
      formData.append('device_id', getDeviceId());
      formData.append('email_usuario', getUserEmail() || '');
      formData.append('audio', file);
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
      xhr.send(formData);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadProgress(0);

    const { success } = await uploadFileWithProgress(
      selectedFile,
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
      <header className="flex items-center gap-4 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Enviar Arquivo</h1>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
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
                  <File className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate mb-1">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSize(selectedFile.size)}
                  </p>
                </div>
                {uploadStatus === 'idle' && (
                  <Button variant="ghost" size="icon" onClick={handleReset}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

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
            {uploadStatus === 'idle' && (
              <Button
                onClick={handleUpload}
                className="w-full h-14 text-lg bg-gradient-primary"
              >
                <Upload className="w-5 h-5 mr-2" />
                Enviar arquivo
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
    </div>
  );
}
