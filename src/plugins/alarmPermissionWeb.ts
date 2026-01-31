import { WebPlugin } from '@capacitor/core';
import type { AlarmPermissionPlugin } from './alarmPermission';

export class AlarmPermissionWeb extends WebPlugin implements AlarmPermissionPlugin {
  async canScheduleExactAlarms(): Promise<{ canSchedule: boolean }> {
    // Web doesn't need alarm permission
    return { canSchedule: true };
  }

  async requestScheduleExactAlarms(): Promise<void> {
    // No-op on web
    console.log('[AlarmPermission] Web platform - no permission needed');
  }
}
