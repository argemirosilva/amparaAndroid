import { WebPlugin } from '@capacitor/core';
import type { AudioTriggerNativePlugin } from './audioTriggerNative';

export class AudioTriggerNativeWeb extends WebPlugin implements AudioTriggerNativePlugin {
  async start(): Promise<{ success: boolean }> {
    console.log('[AudioTriggerNativeWeb] start() - Web fallback, no-op');
    return { success: false };
  }

  async stop(): Promise<{ success: boolean }> {
    console.log('[AudioTriggerNativeWeb] stop() - Web fallback, no-op');
    return { success: false };
  }

  async isRunning(): Promise<{ isRunning: boolean }> {
    console.log('[AudioTriggerNativeWeb] isRunning() - Web fallback');
    return { isRunning: false };
  }
}
