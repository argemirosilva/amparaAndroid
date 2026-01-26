/**
 * Web implementation of SecureStorage
 * Falls back to localStorage
 */

import { WebPlugin } from '@capacitor/core';
import type { SecureStoragePlugin } from './SecureStorage';

export class SecureStorageWeb extends WebPlugin implements SecureStoragePlugin {
  async set(options: { key: string; value: string }): Promise<void> {
    localStorage.setItem(options.key, options.value);
  }

  async get(options: { key: string }): Promise<{ value: string | null }> {
    const value = localStorage.getItem(options.key);
    return { value };
  }

  async remove(options: { key: string }): Promise<void> {
    localStorage.removeItem(options.key);
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }
}
