import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Dumbbell, Heart, Gamepad2, Sparkles, Footprints, Flower2, Shirt, Puzzle, PlayingCards, Candy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconChanger, AVAILABLE_ICONS } from '../composables/useIconChanger';
import { useToast } from '@/hooks/use-toast';

// Import das imagens dos ícones
import iconAmpara from '../assets/icon_ampara_original.png';
import iconWorkout from '../assets/icon_fitness_workout.png';
import iconSteps from '../assets/icon_fitness_steps.png';
import iconYoga from '../assets/icon_fitness_yoga.png';
import iconCycle from '../assets/icon_feminine_cycle.png';
import iconBeauty from '../assets/icon_feminine_beauty.png';
import iconFashion from '../assets/icon_feminine_fashion.png';
import iconPuzzle from '../assets/icon_game_puzzle.png';
import iconCards from '../assets/icon_game_cards.png';
import iconCasual from '../assets/icon_game_casual.png';

const IconSelector: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { changeIcon, getCurrentIcon, isNative } = useIconChanger();
  const [currentIconId, setCurrentIconId] = useState<string>('ampara');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadCurrentIcon();
  }, []);
  
  // Recarregar o ícone atual sempre que a tela ficar visível
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadCurrentIcon();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const loadCurrentIcon = async () => {
    const iconId = await getCurrentIcon();
    setCurrentIconId(iconId);
  };

  const handleIconSelect = async (iconId: string) => {
    if (!isNative) {
      toast({
        title: "Aviso",
        description: "Troca de ícone disponível apenas no app Android.",
        variant: "destructive"
      });
      return;
    }

    if (iconId === currentIconId) return;

    setLoading(true);
    try {
      const success = await changeIcon(iconId);
      if (success) {
        setCurrentIconId(iconId);
        toast({
          title: "✅ Ícone Alterado!",
          description: "Volte para a tela inicial. O novo ícone pode levar até 10 segundos para aparecer. Se não mudar, reinicie o celular.",
        });
        // Não recarregar automaticamente para dar tempo do Android processar
        setTimeout(() => {
          setLoading(false);
        }, 3000);
      } else {
        throw new Error("Falha na troca");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o ícone.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getIconImage = (iconId: string) => {
    const iconMap: Record<string, string> = {
      ampara: iconAmpara,
      workout: iconWorkout,
      steps: iconSteps,
      yoga: iconYoga,
      cycle: iconCycle,
      beauty: iconBeauty,
      fashion: iconFashion,
      puzzle: iconPuzzle,
      cards: iconCards,
      casual: iconCasual,
    };
    return iconMap[iconId] || iconAmpara;
  };

  const getCategoryInfo = (category: string) => {
    const info: Record<string, { title: string, icon: any, color: string }> = {
      original: { title: 'Original', icon: Sparkles, color: 'text-primary' },
      fitness: { title: 'Fitness', icon: Dumbbell, color: 'text-orange-500' },
      feminine: { title: 'Feminino', icon: Heart, color: 'text-pink-500' },
      games: { title: 'Jogos', icon: Gamepad2, color: 'text-blue-500' },
    };
    return info[category] || { title: category, icon: Sparkles, color: 'text-primary' };
  };

  const groupedIcons = AVAILABLE_ICONS.reduce((acc, icon) => {
    if (!acc[icon.category]) acc[icon.category] = [];
    acc[icon.category].push(icon);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_ICONS>);

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
            className="rounded-full"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold tracking-tight">Personalizar Ícone</h1>
        </div>
      </header>

      <main className="container px-4 pt-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Escolha o disfarce</h2>
          <p className="text-muted-foreground">
            Selecione como o app aparecerá na sua tela inicial para maior segurança e privacidade.
          </p>
        </div>

        <div className="space-y-10">
          {Object.entries(groupedIcons).map(([category, icons]) => {
            const catInfo = getCategoryInfo(category);
            const IconComp = catInfo.icon;
            
            return (
              <section key={category} className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <IconComp className={`h-5 w-5 ${catInfo.color}`} />
                  <h3 className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">
                    {catInfo.title}
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {icons.map((icon) => (
                    <motion.div
                      key={icon.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleIconSelect(icon.id)}
                      className={`relative cursor-pointer rounded-2xl border-2 p-3 transition-all ${
                        currentIconId === icon.id 
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted mb-3 relative">
                        <img
                          src={getIconImage(icon.id)}
                          alt={icon.name}
                          className="h-full w-full object-cover"
                        />
                        {currentIconId === icon.id && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                            <CheckCircle2 className="h-10 w-10 text-primary drop-shadow-md" />
                          </div>
                        )}
                      </div>
                      
                      <div className="text-center">
                        <p className="font-bold text-sm leading-tight mb-1">{icon.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                          {icon.description}
                        </p>
                      </div>

                      {currentIconId === icon.id && (
                        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-lg font-medium animate-pulse">Aplicando novo ícone...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IconSelector;
