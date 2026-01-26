/**
 * Secure Storage Plugin
 * Uses native Android SharedPreferences for maximum persistence
 */

import { registerPlugin } from '@capacitor/core';

export interface SecureStoragePlugin {
  set(options: { key: string; value: string }): Promise<void>;
  get(options: { key: string }): Promise<{ value: string | null }>;
  remove(options: { key: string }): Promise<void>;
  clear(): Promise<void>;
}

const SecureStorage = registerPlugin<SecureStoragePlugin>('SecureStorage', {
  web: () => import('./SecureStorageWeb').then(m => new m.SecureStorageWeb()),
});

export default SecureStorage;
