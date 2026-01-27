import { Capacitor } from '@capacitor/core';

export interface IconOption {
  id: string;
  name: string;
  description: string;
  category: 'original' | 'fitness' | 'feminine' | 'games';
  alias: string;
}

export const AVAILABLE_ICONS: IconOption[] = [
  { id: 'ampara', name: 'Ampara Original', description: 'Ícone padrão do app', category: 'original', alias: '.MainActivityAmpara' },
  { id: 'workout', name: 'Treino Fitness', description: 'Disfarce de academia', category: 'fitness', alias: '.MainActivityWorkout' },
  { id: 'steps', name: 'Contador de Passos', description: 'Disfarce de saúde', category: 'fitness', alias: '.MainActivitySteps' },
  { id: 'yoga', name: 'Yoga e Meditação', description: 'Disfarce de bem-estar', category: 'fitness', alias: '.MainActivityYoga' },
  { id: 'cycle', name: 'Calendário Feminino', description: 'Disfarce de ciclo menstrual', category: 'feminine', alias: '.MainActivityCycle' },
  { id: 'beauty', name: 'Beleza e Makeup', description: 'Disfarce de maquiagem', category: 'feminine', alias: '.MainActivityBeauty' },
  { id: 'fashion', name: 'Meu Guarda-Roupa', description: 'Disfarce de moda', category: 'feminine', alias: '.MainActivityFashion' },
  { id: 'puzzle', name: 'Quebra-Cabeça', description: 'Disfarce de jogo puzzle', category: 'games', alias: '.MainActivityPuzzle' },
  { id: 'cards', name: 'Jogo de Cartas', description: 'Disfarce de paciência', category: 'games', alias: '.MainActivityCards' },
  { id: 'casual', name: 'Jogo Casual', description: 'Disfarce de match-3', category: 'games', alias: '.MainActivityCasual' },
];

export const useIconChanger = () => {
  const isNative = Capacitor.isNativePlatform();

  const getPlugin = () => {
    // Tentar acessar o plugin de várias formas para garantir compatibilidade
    return (Capacitor as any).Plugins.IconChanger || (window as any).Capacitor?.Plugins?.IconChanger;
  };

  const changeIcon = async (iconId: string) => {
    if (!isNative) {
      console.warn('Icon change is only available on native platforms');
      return false;
    }

    const icon = AVAILABLE_ICONS.find(i => i.id === iconId);
    if (!icon) return false;

    try {
      const plugin = getPlugin();
      if (!plugin) {
        console.error('IconChanger plugin not found in Capacitor.Plugins');
        return false;
      }

      console.log('Calling IconChanger.changeIcon with:', icon.alias);
      const result = await plugin.changeIcon({ alias: icon.alias });
      return !!result?.success;
    } catch (error) {
      console.error('Error calling IconChanger:', error);
      return false;
    }
  };

  const getCurrentIcon = async () => {
    if (!isNative) return 'ampara';

    try {
      const plugin = getPlugin();
      if (!plugin) return 'ampara';

      const result = await plugin.getCurrentIcon();
      const icon = AVAILABLE_ICONS.find(i => i.alias === result.alias);
      return icon ? icon.id : 'ampara';
    } catch (error) {
      console.error('Error getting current icon:', error);
      return 'ampara';
    }
  };

  return {
    changeIcon,
    getCurrentIcon,
    isNative,
    AVAILABLE_ICONS
  };
};
