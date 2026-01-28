import { WebPlugin } from '@capacitor/core';
import type { KeepAlivePlugin } from './keepAlive';

export class KeepAliveWeb extends WebPlugin implements KeepAlivePlugin {
  async start(options: { deviceId: string }): Promise<void> {
    console.log('[KeepAlive] Web platform - no action needed (deviceId:', options.deviceId, ')');
    return Promise.resolve();
  }

  async stop(): Promise<void> {
    console.log('[KeepAlive] Web platform - no action needed');
    return Promise.resolve();
  }
}
