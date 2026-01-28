import { registerPlugin } from '@capacitor/core';

export interface KeepAlivePlugin {
  /**
   * Inicia o serviço de foreground para manter o app ativo em Doze Mode
   */
  start(options: { deviceId: string }): Promise<void>;
  
  /**
   * Para o serviço de foreground
   */
  stop(): Promise<void>;
}

const KeepAlive = registerPlugin<KeepAlivePlugin>('KeepAlive', {
  web: () => import('./keepAliveWeb').then(m => new m.KeepAliveWeb()),
});

export default KeepAlive;
