/**
 * Pitch Service - F0 Estimation using Autocorrelation
 * Detects fundamental frequency for voice gender classification
 */

import { RingBuffer, calculateMedian } from '@/utils/ringBuffer';

// F0 detection range (Hz)
const MIN_F0 = 60;
const MAX_F0 = 350;

// Buffer for F0 median calculation (2 seconds at ~20Hz rate = 40 samples)
const F0_HISTORY_SIZE = 40;

class PitchEstimator {
  private f0History: RingBuffer<number>;
  private lastValidF0: number | null = null;

  constructor() {
    this.f0History = new RingBuffer<number>(F0_HISTORY_SIZE);
  }

  /**
   * Estimate F0 using Autocorrelation (ACF) method
   * Simplified but effective for voice detection
   */
  estimateF0(
    samples: Float32Array,
    sampleRate: number
  ): { f0: number | null; confidence: number } {
    if (samples.length < 2) {
      return { f0: null, confidence: 0 };
    }

    // Calculate min and max lag based on F0 range
    const minLag = Math.floor(sampleRate / MAX_F0);
    const maxLag = Math.ceil(sampleRate / MIN_F0);

    // Limit maxLag to half the sample length
    const effectiveMaxLag = Math.min(maxLag, Math.floor(samples.length / 2));

    if (minLag >= effectiveMaxLag) {
      return { f0: null, confidence: 0 };
    }

    // Calculate autocorrelation at lag 0 (for normalization)
    let acf0 = 0;
    for (let i = 0; i < samples.length; i++) {
      acf0 += samples[i] * samples[i];
    }

    if (acf0 === 0) {
      return { f0: null, confidence: 0 };
    }

    // Find the peak in autocorrelation within the F0 range
    let maxAcf = -Infinity;
    let bestLag = 0;

    for (let lag = minLag; lag <= effectiveMaxLag; lag++) {
      let acf = 0;
      const windowSize = samples.length - lag;

      for (let i = 0; i < windowSize; i++) {
        acf += samples[i] * samples[i + lag];
      }

      // Normalize by window size and acf0
      const normalizedAcf = acf / Math.sqrt(acf0 * windowSize);

      if (normalizedAcf > maxAcf) {
        maxAcf = normalizedAcf;
        bestLag = lag;
      }
    }

    // Calculate confidence (normalized peak value)
    const confidence = Math.max(0, Math.min(1, maxAcf));

    // If confidence is too low, no valid pitch
    if (confidence < 0.3 || bestLag === 0) {
      return { f0: null, confidence };
    }

    // Calculate F0 from lag
    const f0 = sampleRate / bestLag;

    // Validate F0 range
    if (f0 < MIN_F0 || f0 > MAX_F0) {
      return { f0: null, confidence };
    }

    // Store valid F0 in history
    this.f0History.push(f0);
    this.lastValidF0 = f0;

    return { f0, confidence };
  }

  /**
   * Get median F0 over last 2 seconds
   */
  getF0Median2s(): number | null {
    if (this.f0History.size < 5) {
      return this.lastValidF0;
    }

    const values = this.f0History.toArray();
    return calculateMedian(values);
  }

  /**
   * Reset the estimator state
   */
  reset(): void {
    this.f0History.clear();
    this.lastValidF0 = null;
  }

  /**
   * Get the history size
   */
  getHistorySize(): number {
    return this.f0History.size;
  }
}

// Singleton instance
export const pitchEstimator = new PitchEstimator();

/**
 * Estimate pitch from audio samples
 */
export function estimateF0(
  samples: Float32Array,
  sampleRate: number
): { f0: number | null; confidence: number } {
  return pitchEstimator.estimateF0(samples, sampleRate);
}

/**
 * Get the median F0 over the last 2 seconds
 */
export function getF0Median2s(): number | null {
  return pitchEstimator.getF0Median2s();
}

/**
 * Reset pitch estimator
 */
export function resetPitchEstimator(): void {
  pitchEstimator.reset();
}
