import { registerPlugin } from '@capacitor/core';

export interface AlarmPermissionPlugin {
  /**
   * Check if the app can schedule exact alarms (SCHEDULE_EXACT_ALARM permission)
   * @returns {Promise<{ canSchedule: boolean }>}
   */
  canScheduleExactAlarms(): Promise<{ canSchedule: boolean }>;

  /**
   * Request permission to schedule exact alarms
   * Opens system settings on Android 12+
   * @returns {Promise<void>}
   */
  requestScheduleExactAlarms(): Promise<void>;
}

const AlarmPermission = registerPlugin<AlarmPermissionPlugin>('AlarmPermission', {
  web: () => import('./alarmPermissionWeb').then(m => new m.AlarmPermissionWeb()),
});

export default AlarmPermission;
