import { registerPlugin } from '@capacitor/core';

export interface AudioTriggerNativePlugin {
  /**
   * Start native audio trigger service
   */
  start(): Promise<{ success: boolean }>;
  
  /**
   * Stop native audio trigger service
   */
  stop(): Promise<{ success: boolean }>;
  
  /**
   * Check if native audio trigger is running
   */
  isRunning(): Promise<{ isRunning: boolean }>;
  
  /**
   * Add listener for audio trigger events
   */
  addListener(
    eventName: 'audioTriggerEvent',
    listenerFunc: (event: AudioTriggerEvent) => void
  ): Promise<any>;
  
  /**
   * Remove all listeners
   */
  removeAllListeners(): Promise<void>;
}

export interface AudioTriggerEvent {
  event: 'discussionDetected' | 'discussionEnded';
  reason: string;
  timestamp: number;
}

const AudioTriggerNative = registerPlugin<AudioTriggerNativePlugin>('AudioTriggerNative', {
  web: () => import('./audioTriggerNativeWeb').then(m => new m.AudioTriggerNativeWeb()),
});

export default AudioTriggerNative;
