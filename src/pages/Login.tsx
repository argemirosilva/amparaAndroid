import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogoWithText } from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';
import { AUTH_ENDPOINTS, apiRequest } from '@/lib/api';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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

    setIsLoading(true);

    try {
      const { data, error } = await apiRequest<{ token: string; user: unknown }>(
        AUTH_ENDPOINTS.login,
        {
          method: 'POST',
          body: { email, password },
        }
      );

      if (error || !data) {
        toast({
          title: 'Erro ao entrar',
          description: error || 'Credenciais inválidas. Tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      // Save token
      localStorage.setItem('ampara_token', data.token);
      
      toast({
        title: 'Bem-vinda!',
        description: 'Login realizado com sucesso.',
      });

      onLoginSuccess();
    } catch (err) {
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível conectar ao servidor.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast({
      title: 'Recuperação de senha',
      description: 'Função em desenvolvimento.',
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background safe-area-inset-top safe-area-inset-bottom">
      {/* Background gradient effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-primary opacity-20 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <LogoWithText />
        </div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-muted-foreground mb-8"
        >
          Você não está sozinha
        </motion.p>

        {/* Login Form */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Email Field */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-12 h-14 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl"
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          {/* Password Field */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-12 pr-12 h-14 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl"
              autoComplete="current-password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Forgot Password */}
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm text-primary hover:text-primary/80 transition-colors"
            disabled={isLoading}
          >
            Esqueceu sua senha?
          </button>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-14 text-lg font-semibold bg-gradient-primary hover:opacity-90 transition-opacity rounded-xl"
            disabled={isLoading}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              'Entrar'
            )}
          </Button>
        </motion.form>

        {/* Footer Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-sm text-muted-foreground mt-8"
        >
          Proteção sempre que você precisar
        </motion.p>
      </motion.div>
    </div>
  );
}
