import { WebPlugin } from '@capacitor/core';
import type { BatteryOptimizationPlugin } from './batteryOptimization';

export class BatteryOptimizationWeb extends WebPlugin implements BatteryOptimizationPlugin {
  async isIgnoringBatteryOptimizations(): Promise<{ isIgnoring: boolean }> {
    console.log('[BatteryOptimization] Web platform - returning true (no optimization on web)');
    return { isIgnoring: true };
  }

  async requestIgnoreBatteryOptimizations(): Promise<void> {
    console.log('[BatteryOptimization] Web platform - no action needed');
    return Promise.resolve();
  }
}
