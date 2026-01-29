/**
 * Adaptive Noise Floor Manager (TypeScript)
 * 
 * Continuously learns the ambient noise level and adapts the noise floor threshold.
 * Uses a rolling window of RMS values to calculate the median (robust to outliers).
 * 
 * Key features:
 * - Fast adaptation (10-30 seconds)
 * - Continuous calibration (never stops)
 * - Only updates during non-discussion periods
 * - Uses median (robust to spikes)
 * 
 * This is the JavaScript/TypeScript version that mirrors the native Java implementation.
 */

export type CalibrationCallback = (isCalibrated: boolean) => void;

export class AdaptiveNoiseFloor {
  private static readonly WINDOW_SIZE = 30; // 30 aggregations = 30 seconds
  private static readonly MIN_SAMPLES = 60; // Minimum samples before calibrated (60 aggregations × 500ms = 30s)
  
  private rmsBuffer: number[] = [];
  private noiseFloor: number;
  private initialNoiseFloor: number;
  private learningRate: number;
  private totalSamples = 0;
  private lastLogTime = 0;
  private wasCalibrated = false;
  private callback: CalibrationCallback | null = null;
  
  constructor(initialNoiseFloor: number, learningRate: number) {
    this.initialNoiseFloor = initialNoiseFloor;
    this.noiseFloor = initialNoiseFloor;
    this.learningRate = learningRate;
    
    console.log(`[AdaptiveNoiseFloor] Initialized with initial noise floor: ${initialNoiseFloor.toFixed(1)} dB, learning rate: ${learningRate.toFixed(3)}`);
  }
  
  setCalibrationCallback(callback: CalibrationCallback): void {
    this.callback = callback;
  }
  
  /**
   * Add a new RMS sample (only during non-discussion periods)
   */
  addSample(rmsDb: number): void {
    // Add to buffer
    this.rmsBuffer.push(rmsDb);
    this.totalSamples++;
    
    // Keep buffer size limited
    if (this.rmsBuffer.length > AdaptiveNoiseFloor.WINDOW_SIZE) {
      this.rmsBuffer.shift();
    }
    
    // Update noise floor if we have enough samples
    if (this.rmsBuffer.length >= AdaptiveNoiseFloor.MIN_SAMPLES) {
      this.updateNoiseFloor();
    }
    
    // Check calibration status change
    const isNowCalibrated = this.isCalibrated();
    if (isNowCalibrated !== this.wasCalibrated) {
      this.wasCalibrated = isNowCalibrated;
      if (this.callback) {
        this.callback(isNowCalibrated);
      }
      console.log(`[AdaptiveNoiseFloor] Calibration status changed: ${isNowCalibrated ? 'CALIBRATED' : 'CALIBRATING'}`);
    }
    
    // Log periodically (every 30 samples = ~30 seconds)
    const now = Date.now();
    if (now - this.lastLogTime > 30000) {
      this.logStatistics();
      this.lastLogTime = now;
    }
  }
  
  /**
   * Calculate and update the adaptive noise floor
   * Uses median of the rolling window (robust to outliers)
   */
  private updateNoiseFloor(): void {
    // Sort to find median
    const sorted = [...this.rmsBuffer].sort((a, b) => a - b);
    
    // Calculate median
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2.0
      : sorted[mid];
    
    // Apply learning rate for smooth transition
    const oldNoiseFloor = this.noiseFloor;
    this.noiseFloor = this.noiseFloor * (1.0 - this.learningRate) + median * this.learningRate;
    
    // Log significant changes
    if (Math.abs(this.noiseFloor - oldNoiseFloor) > 3.0) {
      console.log(`[AdaptiveNoiseFloor] Noise floor adapted: ${oldNoiseFloor.toFixed(1)} dB → ${this.noiseFloor.toFixed(1)} dB (median: ${median.toFixed(1)} dB)`);
    }
  }
  
  /**
   * Get the current adaptive noise floor
   */
  getNoiseFloor(): number {
    return this.noiseFloor;
  }
  
  /**
   * Reset the adaptive noise floor (e.g., when environment changes drastically)
   */
  reset(): void {
    this.rmsBuffer = [];
    this.noiseFloor = this.initialNoiseFloor;
    this.totalSamples = 0;
    console.log('[AdaptiveNoiseFloor] Adaptive noise floor reset');
  }
  
  /**
   * Check if the noise floor is well-calibrated
   */
  isCalibrated(): boolean {
    return this.totalSamples >= AdaptiveNoiseFloor.MIN_SAMPLES;
  }
  
  /**
   * Log current statistics
   */
  private logStatistics(): void {
    if (this.rmsBuffer.length === 0) return;
    
    const min = Math.min(...this.rmsBuffer);
    const max = Math.max(...this.rmsBuffer);
    const sum = this.rmsBuffer.reduce((a, b) => a + b, 0);
    const avg = sum / this.rmsBuffer.length;
    
    console.log(`[AdaptiveNoiseFloor] [ADAPTIVE] NoiseFloor: ${this.noiseFloor.toFixed(1)} dB | Window: ${this.rmsBuffer.length} samples | Min: ${min.toFixed(1)} dB | Avg: ${avg.toFixed(1)} dB | Max: ${max.toFixed(1)} dB | Total: ${this.totalSamples} samples`);
  }
  
  /**
   * Get statistics for debugging
   */
  getStatistics(): string {
    if (this.rmsBuffer.length === 0) {
      return `NoiseFloor: ${this.noiseFloor.toFixed(1)} dB (not calibrated)`;
    }
    
    return `NoiseFloor: ${this.noiseFloor.toFixed(1)} dB (calibrated with ${this.rmsBuffer.length} samples)`;
  }
}
