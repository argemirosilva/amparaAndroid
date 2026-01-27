import { registerPlugin } from '@capacitor/core';

export interface BatteryOptimizationPlugin {
  /**
   * Verifica se o app está ignorando otimizações de bateria
   */
  isIgnoringBatteryOptimizations(): Promise<{ isIgnoring: boolean }>;
  
  /**
   * Solicita ao usuário que desative a otimização de bateria para o app
   */
  requestIgnoreBatteryOptimizations(): Promise<void>;
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization');

export default BatteryOptimization;
