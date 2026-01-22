import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Trash2,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getPendingUploads,
  removePendingUpload,
  updatePendingUpload,
  PendingUpload,
} from '@/lib/appState';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';

export function PendingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const appState = useAppState();
  const [uploads, setUploads] = React.useState<PendingUpload[]>([]);
  const [retrying, setRetrying] = React.useState<string | null>(null);

  React.useEffect(() => {
    setUploads(getPendingUploads());
  }, []);

  const handleRetry = async (upload: PendingUpload) => {
    setRetrying(upload.id);
    updatePendingUpload(upload.id, { status: 'uploading' });
    setUploads(getPendingUploads());

    // Simulate upload attempt
    await new Promise((r) => setTimeout(r, 2000));

    // Random success/failure for demo
    const success = Math.random() > 0.3;

    if (success) {
      removePendingUpload(upload.id);
      toast({
        title: 'Arquivo enviado',
        description: upload.fileName,
      });
    } else {
      updatePendingUpload(upload.id, {
        status: 'failed',
        retryCount: upload.retryCount + 1,
      });
      toast({
        title: 'Falha no envio',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    }

    setUploads(getPendingUploads());
    appState.refreshPendingCount();
    setRetrying(null);
  };

  const handleDelete = (upload: PendingUpload) => {
    removePendingUpload(upload.id);
    setUploads(getPendingUploads());
    appState.refreshPendingCount();
    toast({
      title: 'Arquivo removido',
      description: upload.fileName,
    });
  };

  const handleRetryAll = async () => {
    for (const upload of uploads.filter((u) => u.status !== 'uploading')) {
      await handleRetry(upload);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeRemaining = (createdAt: number) => {
    const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours
    const elapsed = Date.now() - createdAt;
    const remaining = MAX_AGE_MS - elapsed;
    
    if (remaining <= 0) return 'Expirando...';
    
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `Expira em ${days}d ${remainingHours}h`;
    }
    
    if (hours > 0) {
      return `Expira em ${hours}h ${minutes}min`;
    }
    
    return `Expira em ${minutes}min`;
  };

  const getStatusIcon = (status: PendingUpload['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'uploading':
        return (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <RefreshCw className="w-4 h-4 text-primary" />
          </motion.div>
        );
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <CheckCircle className="w-4 h-4 text-success" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-inset-top safe-area-inset-bottom">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Pendências</h1>
        </div>
        
        {uploads.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleRetryAll}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar todos
          </Button>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        {/* Explanation card */}
        <div className="bg-muted/50 rounded-xl p-4 mb-4 border border-border">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Pendências</strong> são arquivos que não puderam ser enviados por falta de conexão. 
            Eles serão reenviados automaticamente quando houver internet disponível.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            ⏱️ Itens com mais de 48 horas são removidos automaticamente.
          </p>
        </div>

        {uploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum arquivo pendente
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {uploads.map((upload, index) => (
              <motion.div
                key={upload.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card rounded-xl p-4 border border-border"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(upload.status)}
                      <p className="font-medium truncate">{upload.fileName}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatSize(upload.fileSize)}</span>
                      <span>•</span>
                      <span>{formatTime(upload.createdAt)}</span>
                      {upload.retryCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-warning">
                            {upload.retryCount} tentativas
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      ⏱️ {formatTimeRemaining(upload.createdAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRetry(upload)}
                      disabled={retrying === upload.id}
                    >
                      <RefreshCw className={`w-4 h-4 ${retrying === upload.id ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(upload)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {upload.status === 'uploading' && (
                  <div className="mt-3">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 2, ease: 'linear' }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
