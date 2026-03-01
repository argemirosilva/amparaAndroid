import React, { useState, useEffect } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import amparaIcon from '@/assets/icon_ampara_original.png';

import { useAuth } from '@/hooks/useAuth';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onLogout?: () => void;
}

const LAST_LOGIN_EMAIL_KEY = 'ampara_last_login_email';

export function LoginPage({ onLoginSuccess, onLogout }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConnecting, setShowConnecting] = useState(false);
  const { toast } = useToast();
  const auth = useAuth();

  // Auto-redirect if already logged in
  useEffect(() => {
    if (auth.isAuthenticated) {
      console.log('[Login] User already authenticated, redirecting to home...');
      onLoginSuccess();
    }
  }, [auth.isAuthenticated, onLoginSuccess]);

  // Prefill with the last successful login email
  useEffect(() => {
    const lastEmail = localStorage.getItem(LAST_LOGIN_EMAIL_KEY);
    if (lastEmail) {
      setEmail(lastEmail);
    }
  }, []);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    // Note: Token cleanup is now handled by App.tsx and api.ts
    toast({
      title: 'Sessão encerrada',
      description: 'Você foi desconectado.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    // Show connecting screen
    setShowConnecting(true);

    const result = await auth.login(email, password);

    if (!result.success) {
      setShowConnecting(false);
      toast({
        title: 'Erro ao entrar',
        description: result.error || 'Credenciais inválidas. Tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    // Note: If isCoercion is true, we DON'T show any visual feedback
    // The silent alert was already triggered by the API

    toast({
      title: 'Bem-vinda!',
      description: 'Login realizado com sucesso.',
    });

    localStorage.setItem(LAST_LOGIN_EMAIL_KEY, email.trim());

    // Small delay to show success before transitioning
    setTimeout(() => {
      onLoginSuccess();
    }, 500);
  };

  const handleForgotPassword = () => {
    toast({
      title: 'Recuperação de senha',
      description: 'Para recuperar sua senha acesse amparamulher.com.br',
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 safe-area-inset-top safe-area-inset-bottom bg-app-deep">
      <AnimatePresence mode="wait">
        {showConnecting ? (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center"
          >
            <span className="text-base font-medium text-muted-foreground">Conectando...</span>
          </motion.div>
        ) : (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xs rounded-2xl p-6 bg-white border border-slate-200 shadow-xl"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-center mb-6">
                <img
                  src={amparaIcon}
                  alt="Ampara"
                  className="w-24 h-24 object-contain"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus-visible:ring-black"
                  autoComplete="email"
                  disabled={auth.isLoading}
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus-visible:ring-black"
                  autoComplete="current-password"
                  disabled={auth.isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  disabled={auth.isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-slate-700 hover:text-slate-900 hover:underline"
                  disabled={auth.isLoading}
                >
                  Esqueci minha senha
                </button>
              </div>

              <Button
                type="submit"
                disabled={auth.isLoading}
                className="w-full h-11 rounded-xl bg-black hover:bg-black/90 text-white"
              >
                {auth.isLoading ? 'Entrando...' : 'Entrar'}
              </Button>

            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
