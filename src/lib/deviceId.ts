// ============================================
// Device ID Management
// ============================================
// Generates and persists a unique device identifier

import { STORAGE_KEYS, DeviceInfo } from './types';

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
 * The device ID is persisted in localStorage and sent with all API requests
 */
export function getDeviceId(): string {
  const stored = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  
  if (stored) {
    try {
      const deviceInfo: DeviceInfo = JSON.parse(stored);
      return deviceInfo.device_id;
    } catch {
      // Corrupted data, regenerate
    }
  }
  
  // Generate new device ID
  const deviceInfo: DeviceInfo = {
    device_id: generateUUID(),
    created_at: new Date().toISOString(),
  };
  
  localStorage.setItem(STORAGE_KEYS.DEVICE_ID, JSON.stringify(deviceInfo));
  
  return deviceInfo.device_id;
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
      // Fall through to create new
    }
  }
  
  // Create and store new device info
  const deviceInfo: DeviceInfo = {
    device_id: generateUUID(),
    created_at: new Date().toISOString(),
  };
  
  localStorage.setItem(STORAGE_KEYS.DEVICE_ID, JSON.stringify(deviceInfo));
  
  return deviceInfo;
}

/**
 * Clear device ID (useful for testing or factory reset)
 */
export function clearDeviceId(): void {
  localStorage.removeItem(STORAGE_KEYS.DEVICE_ID);
}
