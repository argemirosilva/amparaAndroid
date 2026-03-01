/**
 * Logout Confirmation Dialog
 * Requires password confirmation before logging out
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getUserEmail, logoutMobile } from '@/lib/api';
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
      // Se não tem email, a sessão já está inválida - força logout local
      console.warn('[Logout] No email found - session already invalid, forcing local logout');
      onConfirm();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Validate password and check for coercion
      console.log('[Logout] Validating password...');
      const result = await validatePassword(password);
      console.log('[Logout] Validation result:', { hasError: !!result.error, error: result.error, hasData: !!result.data });

      if (result.error) {
        console.warn('[Logout] Validation returned error:', result.error);
        // Se o erro for relacionado a sessão inválida, forçamos o logout local SEM chamar API
        const errorLower = result.error.toLowerCase();
        if (errorLower.includes('401') ||
            errorLower.includes('403') ||
            errorLower.includes('forbidden') ||
            errorLower.includes('sessão') ||
            errorLower.includes('session') ||
            errorLower.includes('expirada') ||
            errorLower.includes('expired') ||
            errorLower.includes('inválida') ||
            errorLower.includes('invalid') ||
            errorLower.includes('device') ||
            errorLower.includes('device_id') ||
            errorLower.includes('dispositivo')) {
          console.warn('[Logout] ✅ Session invalid detected - forcing local logout without API call');
          // NÃO chama logoutMobile() porque a sessão já está morta no backend
          onConfirm();
          return;
        }

        console.warn('[Logout] Password incorrect or other error');
        setError('Senha incorreta');
        setIsLoading(false);
        return;
      }

      if (!result.data?.success) {
        console.warn('[Logout] Validation success=false:', result.data);
        setError('Senha incorreta');
        setIsLoading(false);
        return;
      }

      console.log('[Logout] ✅ Password validated successfully, loginTipo:', result.data.loginTipo);
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
        // Normal mode: call logout API first, then proceed with local cleanup
        console.log('[Logout] Valid password - calling logout API');
        try {
          await logoutMobile();
        } catch (error) {
          console.warn('[Logout] API call failed, but proceeding with local logout:', error);
        }
        onConfirm();
      }
    } catch (error: any) {
      console.error('[Logout] Error validating password:', error);

      // Se a exceção for relacionada a sessão inválida, forçar logout SEM chamar API
      const errorMsg = error?.message || error?.toString() || '';
      const errorLower = errorMsg.toLowerCase();
      if (errorLower.includes('401') ||
          errorLower.includes('403') ||
          errorLower.includes('forbidden') ||
          errorLower.includes('sessão') ||
          errorLower.includes('session') ||
          errorLower.includes('expirada') ||
          errorLower.includes('expired') ||
          errorLower.includes('inválida') ||
          errorLower.includes('invalid') ||
          errorLower.includes('device') ||
          errorLower.includes('device_id') ||
          errorLower.includes('dispositivo')) {
        console.warn('[Logout] Session invalid exception, forcing local logout without API call');
        // NÃO chama logoutMobile() porque a sessão já está morta no backend
        onConfirm();
        return;
      }

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
