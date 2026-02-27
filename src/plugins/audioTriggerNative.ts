import { registerPlugin } from '@capacitor/core';

export interface AudioTriggerNativePlugin {
  /**
   * Start native audio trigger service
   */
  start(options?: { config?: any }): Promise<{ success: boolean; alreadyRunning?: boolean }>;

  /**
   * Stop native audio trigger service
   */
  stop(): Promise<{ success: boolean }>;

  /**
   * Check if native audio trigger is running
   */
  isRunning(): Promise<{ isRunning: boolean }>;

  /**
   * Start native recording manually
   */
  startRecording(options?: { sessionToken?: string; emailUsuario?: string; origemGravacao?: string }): Promise<{ success: boolean }>;

  /**
   * Stop native recording manually
   */
  stopRecording(): Promise<{ success: boolean }>;

  /**
   * Activate panic mode natively
   */
  activatePanic(options: { protocolNumber: string; activationType: string }): Promise<{ success: boolean }>;

  /**
   * Deactivate panic mode natively
   */
  deactivatePanic(options: { cancelType: string }): Promise<{ success: boolean }>;

  /**
   * Request current status to synchronize UI
   */
  getStatus(): Promise<{ success: boolean }>;

  /**
   * Report monitoring status manually
   */
  reportStatus(options: { status: string; isMonitoring: boolean; motivo: string }): Promise<{ success: boolean }>;

  /**
   * Update native audio trigger configuration dynamically
   */
  updateConfig(options: { config: any }): Promise<{ success: boolean }>;

  /**
   * Get list of pending recordings from disk
   */
  getPendingRecordings(): Promise<{ success: boolean; recordings: PendingNativeRecording[] }>;

  /**
   * Delete a recording file from disk
   */
  deleteRecording(options: { filePath: string }): Promise<{ success: boolean }>;

  /**
   * Manually trigger upload for a specific file
   */
  uploadRecording(options: { filePath: string; segmentIndex: number; sessionId: string; origemGravacao: string }): Promise<{ success: boolean }>;

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

export interface PendingNativeRecording {
  filePath: string;
  fileName: string;
  fileSize: number;
  segmentIndex: number;
  sessionId: string;
  createdAt: number;
}

export interface AudioTriggerEvent {
  event: 'discussionDetected' | 'discussionEnded' | 'nativeRecordingStarted' | 'nativeRecordingStopped' | 'nativeRecordingProgress' | 'nativeUploadProgress' | 'fgsNotEligible' | 'calibrationStatus' | 'panicState' | 'recordingState' | 'panicEnded';
  reason?: string;
  sessionId?: string;
  origemGravacao?: string;
  segmentIndex?: number;
  pending?: number;
  success?: number;
  failure?: number;
  isCalibrated?: boolean;
  isRecording?: boolean;
  isPanicActive?: boolean;
  panicStartTime?: number;
  protocolNumber?: string;
  startedAt?: number;
  timestamp: number;
}

export const AudioTriggerNative = registerPlugin<AudioTriggerNativePlugin>('AudioTriggerNative', {
  web: () => import('./audioTriggerNativeWeb').then(m => new m.AudioTriggerNativeWeb()),
});
