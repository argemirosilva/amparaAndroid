import { STORAGE_KEYS, DeviceInfo } from './types';
import { getDeviceId as getSessionDeviceId, setDeviceId as saveSessionDeviceId } from '@/services/sessionService';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create the device ID
 * The device ID is persisted in multiple storages via sessionService
 */
export function getDeviceId(): string {
  // Try unified service first (cached or loaded from SecureStorage)
  const unified = getSessionDeviceId();
  if (unified) return unified;

  // Fallback to legacy localStorage (handled by sessionService init, but here for safety)
  const stored = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);

  if (stored) {
    try {
      const deviceInfo: DeviceInfo = JSON.parse(stored);
      return deviceInfo.device_id;
    } catch {
      // Corrupted data
    }
  }

  // Generate new device ID if absolutely none found
  const newId = generateUUID();
  saveSessionDeviceId(newId);

  return newId;
}

/**
 * Get device info with creation timestamp
 */
export function getDeviceInfo(): DeviceInfo {
  const stored = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);

  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fall through
    }
  }

  const id = getDeviceId();
  const info = {
    device_id: id,
    created_at: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEYS.DEVICE_ID, JSON.stringify(info));
  return info;
}

/**
 * Clear device ID
 */
export function clearDeviceId(): void {
  localStorage.removeItem(STORAGE_KEYS.DEVICE_ID);
}
