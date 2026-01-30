/**
 * Config Storage - Persistence for AudioTriggerConfig
 */

import type { AudioTriggerConfig } from '@/types/audioTrigger';
import type { ServerAudioTriggerConfig } from '@/lib/types';
import { DEFAULT_CONFIG } from '@/types/audioTrigger';
import { serverToClientConfig } from '@/utils/configConverter';

const STORAGE_KEY = 'ampara_trigger_config';
const SERVER_CONFIG_KEY = 'ampara_server_audio_config';

/**
 * Save config to localStorage
 */
export function saveConfig(config: Partial<AudioTriggerConfig>): void {
  try {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullConfig));
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

/**
 * Load config from localStorage
 */
export function loadConfig(): Partial<AudioTriggerConfig> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load config:', error);
    return null;
  }
}

/**
 * Save server config to localStorage for offline fallback
 * DISABLED: audio_trigger_config from API is now ignored
 */
export function saveServerConfig(config: ServerAudioTriggerConfig): void {
  console.log('[configStorage] saveServerConfig called -> IGNORED (use local defaults only)');
  // Do nothing - server config is no longer used
}

/**
 * Load server config from localStorage
 * DISABLED: audio_trigger_config from API is now ignored
 */
export function loadServerConfig(): ServerAudioTriggerConfig | null {
  console.log('[configStorage] loadServerConfig called -> returning null (use local defaults only)');
  return null;
}

/**
 * Get full config with defaults
 * CHANGED: Always use DEFAULT_CONFIG, never from server
 */
export function getFullConfig(): AudioTriggerConfig {
  console.log('[configStorage] getFullConfig -> using DEFAULT_CONFIG only');
  // Always return DEFAULT_CONFIG (no server config, no local storage)
  return { ...DEFAULT_CONFIG };
}

/**
 * Export config as JSON string
 */
export function exportConfigJson(config: AudioTriggerConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Import config from JSON string
 */
export function importConfigJson(json: string): AudioTriggerConfig | null {
  try {
    const parsed = JSON.parse(json);
    // Validate that it has required fields
    if (typeof parsed === 'object' && parsed !== null) {
      return { ...DEFAULT_CONFIG, ...parsed };
    }
    return null;
  } catch (error) {
    console.error('Failed to parse config JSON:', error);
    return null;
  }
}

/**
 * Clear stored config
 */
export function clearConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear config:', error);
  }
}

/**
 * Download config as JSON file
 */
export function downloadConfig(config: AudioTriggerConfig): void {
  const json = exportConfigJson(config);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ampara-trigger-config.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Upload config from file input
 */
export function uploadConfig(file: File): Promise<AudioTriggerConfig | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result as string;
      const config = importConfigJson(json);
      resolve(config);
    };
    reader.onerror = () => {
      resolve(null);
    };
    reader.readAsText(file);
  });
}
