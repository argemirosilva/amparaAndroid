/**
 * DSP Service - Digital Signal Processing
 * Handles RMS, dBFS, ZCR, VAD, and Loud detection
 */

import type { AudioTriggerConfig } from '@/types/audioTrigger';

/**
 * Calculate RMS (Root Mean Square) of audio samples
 * RMS represents the "energy" or power of the signal
 */
export function calculateRMS(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Convert RMS to dBFS (decibels relative to full scale)
 * 0 dBFS = maximum possible level (amplitude 1.0)
 * Negative values = quieter signals
 */
export function calculateDbfs(rms: number): number {
  if (rms <= 0) return -100;
  const dbfs = 20 * Math.log10(rms);
  return Math.max(dbfs, -100);
}

/**
 * Calculate Zero Crossing Rate (ZCR)
 * Measures how often the signal crosses zero
 * Voice typically has ZCR in range 0.02-0.25
 * Noise tends to have higher ZCR
 */
export function calculateZCR(samples: Float32Array): number {
  if (samples.length < 2) return 0;
  
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) ||
        (samples[i] < 0 && samples[i - 1] >= 0)) {
      crossings++;
    }
  }
  
  // Normalize by number of samples
  return crossings / (samples.length - 1);
}

/**
 * Voice Activity Detection (VAD)
 * Combines energy (dBFS) and ZCR heuristics
 */
export function detectVAD(
  dbfs: number,
  zcr: number,
  noiseFloorDb: number,
  config: AudioTriggerConfig
): boolean {
  // Energy must be above noise floor + threshold
  const energyThreshold = noiseFloorDb + config.vadDeltaDb;
  const hasEnergy = dbfs > energyThreshold;
  
  // ZCR must be in voice range (not too high like noise)
  const hasVoiceZCR = zcr >= config.zcrMinVoice && zcr <= config.zcrMaxVoice;
  
  // Both conditions must be met
  return hasEnergy && hasVoiceZCR;
}

/**
 * Loud Detection
 * Signal is considered loud if above noise floor + loud delta
 * Uses hybrid threshold: relative OR absolute minimum
 * Ensures detection even in very noisy environments
 */
export function detectLoud(
  dbfs: number,
  noiseFloorDb: number,
  config: AudioTriggerConfig
): boolean {
  // Hybrid threshold: relative (noiseFloor + delta) OR absolute minimum
  const relativeLoudThreshold = noiseFloorDb + config.loudDeltaDb;
  const absoluteLoudThreshold = -20.0; // Absolute minimum for loud detection
  const loudThreshold = Math.max(relativeLoudThreshold, absoluteLoudThreshold);
  return dbfs > loudThreshold;
}

/**
 * Update noise floor using LERP (linear interpolation)
 * Only update when speech is not detected
 */
export function updateNoiseFloor(
  currentNoiseFloor: number,
  dbfs: number,
  isSpeech: boolean,
  config: AudioTriggerConfig
): number {
  // Only update noise floor during silence
  if (isSpeech) {
    return currentNoiseFloor;
  }
  
  // LERP: noiseFloor = lerp(current, dbfs, learningRate)
  const newNoiseFloor = currentNoiseFloor + 
    config.noiseFloorLearningRate * (dbfs - currentNoiseFloor);
  
  // Clamp to reasonable range
  return Math.max(Math.min(newNoiseFloor, -20), -80);
}

/**
 * Process a single frame of audio
 * Returns frame metrics
 */
export function processFrame(
  samples: Float32Array,
  noiseFloorDb: number,
  config: AudioTriggerConfig
): {
  rms: number;
  dbfs: number;
  zcr: number;
  isSpeech: boolean;
  isLoud: boolean;
} {
  const rms = calculateRMS(samples);
  const dbfs = calculateDbfs(rms);
  const zcr = calculateZCR(samples);
  const isSpeech = detectVAD(dbfs, zcr, noiseFloorDb, config);
  const isLoud = detectLoud(dbfs, noiseFloorDb, config);
  
  return { rms, dbfs, zcr, isSpeech, isLoud };
}
