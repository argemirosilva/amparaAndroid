/**
 * Logout Confirmation Dialog
 * Requires password confirmation before logging out
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getUserEmail } from '@/lib/api';
import { validatePassword } from '@/lib/api_settings';
import { App } from '@capacitor/app';

interface LogoutConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmDialog({ isOpen, onClose, onConfirm }: LogoutConfirmDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('Digite sua senha');
      return;
    }

    const email = getUserEmail();
    if (!email) {
      setError('Sessão inválida. Faça login novamente.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Validate password and check for coercion
      const result = await validatePassword(password);
      
      if (result.error) {
        // Se o erro for 401 (Sessão expirada), forçamos o logout local
        if (result.error.includes('401') || result.error.includes('Sessão expirada')) {
          console.warn('[Logout] Session expired during password validation, forcing local logout');
          onConfirm();
          return;
        }
        
        setError('Senha incorreta');
        setIsLoading(false);
        return;
      }

      if (!result.data?.success) {
        setError('Senha incorreta');
        setIsLoading(false);
        return;
      }

      const isCoercion = result.data.loginTipo === 'coacao';

      setIsLoading(false);
      setPassword('');

      if (isCoercion) {
        // Coercion mode: minimize app instead of logging out
        console.log('[Logout] Coercion detected - minimizing app instead of logout');
        try {
          await App.minimizeApp();
        } catch (error) {
          console.error('[Logout] Failed to minimize app:', error);
          // Fallback: just close the dialog
        }
        onClose();
      } else {
        // Normal mode: proceed with actual logout
        onConfirm();
      }
    } catch (error) {
      console.error('[Logout] Error validating password:', error);
      setError('Erro ao verificar senha');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-destructive/10">
                  <LogOut className="w-5 h-5 text-destructive" />
                </div>
                <h2 className="text-lg font-semibold">Confirmar Saída</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-6">
              Para sua segurança, confirme sua senha para sair do aplicativo.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  className="pr-10"
                  autoFocus
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {error}
                </motion.p>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  className="flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Sair'
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
