import { Capacitor } from '@capacitor/core';

export interface IconOption {
  id: string;
  name: string;
  description: string;
  category: 'original' | 'fitness' | 'feminine' | 'games';
}

export const AVAILABLE_ICONS: IconOption[] = [
  { id: 'ampara', name: 'Ampara', description: 'Ícone original', category: 'original' },
  { id: 'workout', name: 'Treino Fitness', description: 'App de exercícios', category: 'fitness' },
  { id: 'steps', name: 'Contador de Passos', description: 'Rastreador de caminhada', category: 'fitness' },
  { id: 'yoga', name: 'Yoga & Meditação', description: 'Relaxamento e bem-estar', category: 'fitness' },
  { id: 'cycle', name: 'Calendário Feminino', description: 'Ciclo menstrual', category: 'feminine' },
  { id: 'beauty', name: 'Beleza & Makeup', description: 'Dicas de maquiagem', category: 'feminine' },
  { id: 'fashion', name: 'Meu Guarda-Roupa', description: 'Looks do dia', category: 'feminine' },
  { id: 'puzzle', name: 'Quebra-Cabeça', description: 'Jogo de raciocínio', category: 'games' },
  { id: 'cards', name: 'Jogo de Cartas', description: 'Paciência e cartas', category: 'games' },
  { id: 'casual', name: 'Jogo Casual', description: 'Diversão relaxante', category: 'games' },
];

export function useIconChanger() {
  const isNative = Capacitor.isNativePlatform();

  const changeIcon = async (iconId: string): Promise<boolean> => {
    if (!isNative) {
      console.warn('Icon change is only available on native platforms');
      return false;
    }

    try {
      const IconChanger = Capacitor.Plugins.IconChanger as any;
      
      if (!IconChanger) {
        console.error('IconChanger plugin not found');
        return false;
      }

      await IconChanger.changeIcon({ iconName: iconId });
      
      // Salvar preferência localmente
      localStorage.setItem('selectedIcon', iconId);
      
      return true;
    } catch (error) {
      console.error('Failed to change icon:', error);
      return false;
    }
  };

  const getCurrentIcon = async (): Promise<string> => {
    if (!isNative) {
      return 'ampara';
    }

    try {
      const IconChanger = Capacitor.Plugins.IconChanger as any;
      
      if (!IconChanger) {
        return localStorage.getItem('selectedIcon') || 'ampara';
      }

      const result = await IconChanger.getCurrentIcon();
      return result.iconName || 'ampara';
    } catch (error) {
      console.error('Failed to get current icon:', error);
      return localStorage.getItem('selectedIcon') || 'ampara';
    }
  };

  const getIconPreview = (iconId: string): string => {
    // Retorna o caminho para a imagem de preview do ícone
    return `/assets/icons/preview_${iconId}.png`;
  };

  return {
    changeIcon,
    getCurrentIcon,
    getIconPreview,
    availableIcons: AVAILABLE_ICONS,
    isNative,
  };
}
