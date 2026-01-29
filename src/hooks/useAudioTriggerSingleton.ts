/**
 * Hook to use AudioTrigger Singleton with React state updates
 * Provides reactive access to the singleton's state
 */

import { useState, useEffect } from 'react';
import { audioTriggerSingleton } from '@/services/audioTriggerSingleton';
import type {
  AudioTriggerConfig,
  AudioTriggerEvent,
  AudioTriggerMetrics,
  TriggerState,
} from '@/types/audioTrigger';

export interface AudioTriggerSingletonReturn {
  // State
  isCapturing: boolean;
  hasPermission: boolean | null;
  error: string | null;
  
  // Streams
  events: AudioTriggerEvent[];
  metrics: AudioTriggerMetrics | null;
  
  // Derived state
  state: TriggerState;
  config: AudioTriggerConfig;
  isRecording: boolean;
  discussionOn: boolean;
  isCalibrated: boolean;
  
  // Actions
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  setProcessingMode: (mode: 'FULL' | 'LIGHT') => void;
  updateConfig: (config: Partial<AudioTriggerConfig>) => void;
  clearEvents: () => void;
  copyEvents: () => void;
}

export function useAudioTriggerSingleton(): AudioTriggerSingletonReturn {
  // Force re-render when singleton state changes
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    const listener = () => forceUpdate({});
    audioTriggerSingleton.addStateListener(listener);
    
    return () => {
      audioTriggerSingleton.removeStateListener(listener);
    };
  }, []);
  
  return {
    // State
    isCapturing: audioTriggerSingleton.getIsCapturing(),
    hasPermission: audioTriggerSingleton.getHasPermission(),
    error: audioTriggerSingleton.getError(),
    
    // Streams
    events: audioTriggerSingleton.getEvents(),
    metrics: audioTriggerSingleton.getMetrics(),
    
    // Derived state
    state: audioTriggerSingleton.getState(),
    config: audioTriggerSingleton.getConfig(),
    isRecording: audioTriggerSingleton.getIsRecording(),
    discussionOn: audioTriggerSingleton.getDiscussionOn(),
    isCalibrated: audioTriggerSingleton.getIsCalibrated(),
    
    // Actions
    start: () => audioTriggerSingleton.start(),
    stop: () => audioTriggerSingleton.stop(),
    reset: () => audioTriggerSingleton.reset(),
    setProcessingMode: (mode) => audioTriggerSingleton.setProcessingMode(mode),
    updateConfig: (config) => audioTriggerSingleton.updateConfig(config),
    clearEvents: () => audioTriggerSingleton.clearEvents(),
    copyEvents: () => audioTriggerSingleton.copyEvents(),
  };
}
