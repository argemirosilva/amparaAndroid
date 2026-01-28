import { WebPlugin } from '@capacitor/core';
import type { DeviceInfoPlugin, DeviceInfoExtended } from './deviceInfo';

export class DeviceInfoWeb extends WebPlugin implements DeviceInfoPlugin {
  async getExtendedInfo(): Promise<DeviceInfoExtended> {
    // Fallback para web - retorna valores padrão
    return {
      deviceModel: 'Web Browser',
      batteryLevel: 100,
      isCharging: false,
      androidVersion: 'N/A',
      appVersion: '1.0.0',
      isIgnoringBatteryOptimization: true,
      connectionType: navigator.onLine ? 'wifi' : 'none',
      wifiSignalStrength: null,
    };
  }
}
