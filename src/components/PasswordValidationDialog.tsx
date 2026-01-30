import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PasswordValidationDialogProps {
  // Compatibilidade: aceita ambos os nomes
  open?: boolean;
  isOpen?: boolean;
  title: string;
  description: string;
  // Compatibilidade: aceita ambos os nomes
  onValidated?: (loginTipo: 'normal' | 'coacao') => Promise<void>;
  onValidate?: (senha: string) => Promise<void>;
  onCancel?: () => void;
  onOpenChange?: (open: boolean) => void;
  isValidating?: boolean;
}

export function PasswordValidationDialog({
  open,
  isOpen,
  title,
  description,
  onValidated,
  onValidate,
  onCancel,
  onOpenChange,
  isValidating = false,
}: PasswordValidationDialogProps) {
  // Compatibilidade: usa open ou isOpen
  const dialogOpen = open ?? isOpen ?? false;
  
  // Compatibilidade: usa onValidated ou onValidate
  const handleValidate = onValidated || onValidate;
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senha.trim()) return;
    
    if (handleValidate) {
      // Se for onValidated (com loginTipo), sempre passa 'normal'
      if (onValidated) {
        await onValidated('normal');
      } else if (onValidate) {
        await onValidate(senha);
      }
    }
  };

  const handleCancel = () => {
    setSenha('');
    setShowSenha(false);
    if (onCancel) onCancel();
    if (onOpenChange) onOpenChange(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      if (!open) handleCancel();
      if (onOpenChange) onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="senha-validacao">Senha</Label>
            <div className="relative">
              <Input
                id="senha-validacao"
                type={showSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                disabled={isValidating}
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={isValidating}
              >
                {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isValidating}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isValidating || !senha.trim()}
              className="flex-1"
            >
              {isValidating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Validando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
