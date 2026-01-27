import { Capacitor } from '@capacitor/core';

export interface IconOption {
  id: string;
  name: string;
  description: string;
  category: 'original' | 'fitness' | 'feminine' | 'games';
  alias: string;
}

export const AVAILABLE_ICONS: IconOption[] = [
  { id: 'ampara', name: 'Ampara Original', description: 'Ícone padrão do app', category: 'original', alias: 'tech.orizon.ampara.MainActivityAmpara' },
  { id: 'workout', name: 'Treino Fitness', description: 'Disfarce de academia', category: 'fitness', alias: 'tech.orizon.ampara.MainActivityWorkout' },
  { id: 'steps', name: 'Contador de Passos', description: 'Disfarce de saúde', category: 'fitness', alias: 'tech.orizon.ampara.MainActivitySteps' },
  { id: 'yoga', name: 'Yoga e Meditação', description: 'Disfarce de bem-estar', category: 'fitness', alias: 'tech.orizon.ampara.MainActivityYoga' },
  { id: 'cycle', name: 'Calendário Feminino', description: 'Disfarce de ciclo menstrual', category: 'feminine', alias: 'tech.orizon.ampara.MainActivityCycle' },
  { id: 'beauty', name: 'Beleza e Makeup', description: 'Disfarce de maquiagem', category: 'feminine', alias: 'tech.orizon.ampara.MainActivityBeauty' },
  { id: 'fashion', name: 'Meu Guarda-Roupa', description: 'Disfarce de moda', category: 'feminine', alias: 'tech.orizon.ampara.MainActivityFashion' },
  { id: 'puzzle', name: 'Quebra-Cabeça', description: 'Disfarce de jogo puzzle', category: 'games', alias: 'tech.orizon.ampara.MainActivityPuzzle' },
  { id: 'cards', name: 'Jogo de Cartas', description: 'Disfarce de paciência', category: 'games', alias: 'tech.orizon.ampara.MainActivityCards' },
  { id: 'casual', name: 'Jogo Casual', description: 'Disfarce de match-3', category: 'games', alias: 'tech.orizon.ampara.MainActivityCasual' },
];

export const useIconChanger = () => {
  const isNative = Capacitor.isNativePlatform();

  const changeIcon = async (iconId: string) => {
    if (!isNative) return false;

    const icon = AVAILABLE_ICONS.find(i => i.id === iconId);
    if (!icon) return false;

    try {
      // Usar a interface direta injetada na WebView
      const androidInterface = (window as any).AndroidIconChanger;
      
      if (androidInterface && typeof androidInterface.changeIcon === 'function') {
        console.log('Calling AndroidIconChanger.changeIcon with:', icon.alias);
        return androidInterface.changeIcon(icon.alias);
      } else {
        console.error('AndroidIconChanger interface not found');
        return false;
      }
    } catch (error) {
      console.error('Error calling AndroidIconChanger:', error);
      return false;
    }
  };

  const getCurrentIcon = async () => {
    if (!isNative) return 'ampara';

    try {
      const androidInterface = (window as any).AndroidIconChanger;
      if (androidInterface && typeof androidInterface.getCurrentIcon === 'function') {
        const aliasName = androidInterface.getCurrentIcon();
        // Converter nome do alias para id (ex: MainActivityWorkout -> workout)
        const icon = AVAILABLE_ICONS.find(i => i.alias.endsWith(aliasName));
        return icon ? icon.id : 'ampara';
      }
    } catch (error) {}
    return 'ampara';
  };

  return {
    changeIcon,
    getCurrentIcon,
    isNative,
    AVAILABLE_ICONS
  };
};
