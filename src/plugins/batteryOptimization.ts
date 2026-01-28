import { registerPlugin } from '@capacitor/core';

export interface BatteryOptimizationPlugin {
  /**
   * Verifica se o app está ignorando otimizações de bateria e se pode agendar alarmes exatos
   */
  isIgnoringBatteryOptimizations(): Promise<{ 
    isIgnoring: boolean;
    canScheduleExactAlarms: boolean;
  }>;
  
  /**
   * Solicita ao usuário que desative a otimização de bateria para o app
   */
  requestIgnoreBatteryOptimizations(): Promise<void>;

  /**
   * Solicita permissão para agendar alarmes exatos (Android 12+)
   */
  requestExactAlarmPermission(): Promise<void>;
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization', {
  web: () => import('./batteryOptimizationWeb').then(m => new m.BatteryOptimizationWeb()),
});

export default BatteryOptimization;
