import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import orizonLogo from '@/assets/orizon-tech-logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogoWithText } from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const { toast } = useToast();
  const auth = useAuth();

  // Hide splash after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

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

    const result = await auth.login(email, password);

    if (!result.success) {
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

    onLoginSuccess();
  };

  const handleForgotPassword = () => {
    toast({
      title: 'Recuperação de senha',
      description: 'Função em desenvolvimento.',
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[hsl(210,20%,98%)] safe-area-inset-top safe-area-inset-bottom">
      {/* Background gradient effect - subtle for ice white */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-br from-primary/8 to-secondary/6 blur-[100px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {showSplash ? (
          /* Splash Screen - Logo only */
          <motion.div
            key="splash"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative z-10 flex flex-col items-center"
          >
            <LogoWithText size="lg" />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="text-muted-foreground/60 text-sm mt-4"
            >
              Você não está sozinha
            </motion.p>
          </motion.div>
        ) : (
          /* Login Card */
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 w-full max-w-xs bg-white rounded-2xl shadow-lg p-5"
          >
        {/* Logo with entrance animation */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          className="flex justify-center mb-3"
        >
          <LogoWithText size="md" />
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-center text-muted-foreground/70 text-xs mb-4"
        >
          Você não está sozinha
        </motion.p>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Email Field */}
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="relative"
          >
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-lg text-sm"
              autoComplete="email"
              disabled={auth.isLoading}
            />
          </motion.div>

          {/* Password Field */}
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="relative"
          >
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-11 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-lg text-sm"
              autoComplete="current-password"
              disabled={auth.isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              disabled={auth.isLoading}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </motion.div>

          {/* Forgot Password */}
          <motion.button
            type="button"
            onClick={handleForgotPassword}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
            disabled={auth.isLoading}
          >
            Esqueceu sua senha?
          </motion.button>

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-gradient-primary hover:opacity-90 transition-opacity rounded-lg"
              disabled={auth.isLoading}
            >
              {auth.isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                'Entrar'
              )}
            </Button>
          </motion.div>
        </form>

        {/* Footer Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.3 }}
          className="text-center text-[10px] text-muted-foreground/60 mt-3"
        >
          Proteção sempre que você precisar
        </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Powered by footer - always visible */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: showSplash ? 0 : 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute bottom-6 flex flex-col items-center gap-0.5"
      >
        <span className="text-[6px] text-muted-foreground/50">powered by</span>
        <img src={orizonLogo} alt="Orizon Tech" className="h-[25px] object-contain opacity-80 mix-blend-multiply" />
      </motion.footer>
    </div>
  );
}
