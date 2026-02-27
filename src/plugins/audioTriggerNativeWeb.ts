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

  async startRecording(options?: any): Promise<{ success: boolean }> {
    console.warn('[AudioTriggerNativeWeb] startRecording not supported on web');
    return { success: false };
  }

  async stopRecording(): Promise<{ success: boolean }> {
    console.warn('[AudioTriggerNativeWeb] stopRecording not supported on web');
    return { success: false };
  }

  async updateConfig(options: { config: any }): Promise<{ success: boolean }> {
    console.log('[AudioTriggerNativeWeb] updateConfig (mock)', options.config);
    return { success: true };
  }

  async reportStatus(options: { status: string; isMonitoring: boolean; motivo: string }): Promise<{ success: boolean }> {
    console.log('[AudioTriggerNativeWeb] reportStatus (mock)', options);
    return { success: true };
  }

  async getPendingRecordings(): Promise<{ success: boolean; recordings: any[] }> {
    console.log('[AudioTriggerNativeWeb] getPendingRecordings (mock)');
    return { success: true, recordings: [] };
  }

  async deleteRecording(options: { filePath: string }): Promise<{ success: boolean }> {
    console.log('[AudioTriggerNativeWeb] deleteRecording (mock)', options);
    return { success: true };
  }

  async uploadRecording(options: { filePath: string; segmentIndex: number; sessionId: string; origemGravacao: string }): Promise<{ success: boolean }> {
    console.log('[AudioTriggerNativeWeb] uploadRecording (mock)', options);
    return { success: true };
  }
}
