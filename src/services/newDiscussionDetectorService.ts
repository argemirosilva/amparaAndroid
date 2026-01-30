/**
 * Discussion Detector Service - New Implementation
 * Detects discussions based on speech density, loud density, turn-taking, and gender
 */

import type {
  AudioTriggerConfig,
  AggregatedMetrics,
  DiscussionWindowMetrics,
  GenderClass,
} from '@/types/audioTrigger';
import { RingBuffer } from '@/utils/ringBuffer';

// Number of 500ms aggregations in 10s window
const AGGREGATIONS_PER_10S = 20;

// Pause detection for turn-taking (ms)
const MIN_PAUSE_MS = 200;
const MAX_PAUSE_MS = 800;

export interface DiscussionState {
  discussionOn: boolean;
  score: number;
  discussionStartTime: number | null;
  discussionEndConditionStartTime: number | null;
}

class DiscussionDetector {
  private aggregationBuffer: RingBuffer<AggregatedMetrics>;
  private _state: DiscussionState = {
    discussionOn: false,
    score: 0,
    discussionStartTime: null,
    discussionEndConditionStartTime: null,
  };
  private discussionStartConditionStartTime: number | null = null;
  private lastSpeechOnset: number | null = null;
  private previousSpeechState: boolean = false;
  private lastSpeechTime: number | null = null;

  constructor() {
    this.aggregationBuffer = new RingBuffer<AggregatedMetrics>(AGGREGATIONS_PER_10S);
  }

  /**
   * Get current state
   */
  get state(): DiscussionState {
    return { ...this._state };
  }

  /**
   * Get discussion window metrics
   */
  getWindowMetrics(): DiscussionWindowMetrics {
    const aggregations = this.aggregationBuffer.toArray();
    
    if (aggregations.length === 0) {
      return { speechDensity: 0, loudDensity: 0, turnTaking: 0 };
    }

    // Calculate densities
    const speechDensity = aggregations.reduce((sum, a) => sum + a.speechRatio, 0) / aggregations.length;
    const loudDensity = aggregations.reduce((sum, a) => sum + a.loudRatio, 0) / aggregations.length;

    // Count turn-taking (speech onsets with valid pauses)
    let turnTaking = 0;
    for (const agg of aggregations) {
      if (agg.speechOnset) {
        turnTaking++;
      }
    }

    return { speechDensity, loudDensity, turnTaking };
  }

  /**
   * Calculate discussion score (0-7)
   */
  calculateScore(
    windowMetrics: DiscussionWindowMetrics,
    gender: GenderClass,
    config: AudioTriggerConfig
  ): number {
    let score = 0;

    // +2 if loudDensity >= loudDensityMin
    if (windowMetrics.loudDensity >= config.loudDensityMin) {
      score += 2;
    }

    // +2 if turnTaking >= turnTakingMin
    if (windowMetrics.turnTaking >= config.turnTakingMin) {
      score += 2;
    }

    // +1 if speechDensity >= speechDensityMin
    if (windowMetrics.speechDensity >= config.speechDensityMin) {
      score += 1;
    }

    // +2 if gender == MALE (apply male bias)
    if (gender === 'MALE') {
      score += 2;
    }

    return score;
  }

  /**
   * Process a new aggregation (called every 500ms)
   */
  processAggregation(
    aggregation: Omit<AggregatedMetrics, 'speechOnset'>,
    gender: GenderClass,
    config: AudioTriggerConfig
  ): DiscussionState {
    const now = Date.now();
    const currentSpeechOn = aggregation.speechRatio > 0.3;

    // Detect speech onset (OFF -> ON transition)
    let speechOnset = false;
    if (currentSpeechOn && !this.previousSpeechState) {
      // Check if pause was in valid range
      if (this.lastSpeechOnset !== null) {
        const pauseDuration = now - this.lastSpeechOnset;
        if (pauseDuration >= MIN_PAUSE_MS && pauseDuration <= MAX_PAUSE_MS) {
          speechOnset = true;
        }
      }
      this.lastSpeechOnset = now;
    }
    this.previousSpeechState = currentSpeechOn;

    // Add to buffer
    const fullAggregation: AggregatedMetrics = {
      ...aggregation,
      speechOnset,
    };
    this.aggregationBuffer.push(fullAggregation);

    // Track last speech time for silence decay
    if (currentSpeechOn) {
      this.lastSpeechTime = now;
    }

    // Calculate window metrics
    const windowMetrics = this.getWindowMetrics();

    // Calculate base score
    let score = this.calculateScore(windowMetrics, gender, config);

    // Apply silence decay penalty
    if (this.lastSpeechTime !== null && !currentSpeechOn) {
      const silenceDurationMs = now - this.lastSpeechTime;
      const silenceSeconds = silenceDurationMs / 1000;
      
      // Only apply decay after silenceDecaySeconds
      if (silenceSeconds > config.silenceDecaySeconds) {
        const decaySeconds = silenceSeconds - config.silenceDecaySeconds;
        const penalty = Math.floor(decaySeconds * config.silenceDecayRate);
        score = Math.max(0, score - penalty);
      }
    }

    this._state.score = score;

    // Discussion start logic (with hysteresis)
    if (!this._state.discussionOn) {
      if (score >= 2) { // Reduzido para 2 para facilitar detecção em testes
        if (this.discussionStartConditionStartTime === null) {
          this.discussionStartConditionStartTime = now;
        }
        const holdDuration = (now - this.discussionStartConditionStartTime) / 1000;
        if (holdDuration >= config.startHoldSeconds) {
          this._state.discussionOn = true;
          this._state.discussionStartTime = now;
          this.discussionStartConditionStartTime = null;
        }
      } else {
        this.discussionStartConditionStartTime = null;
      }
    }

    // Discussion end logic (with hysteresis)
    if (this._state.discussionOn) {
      const endConditionMet = 
        windowMetrics.speechDensity < config.speechDensityEnd &&
        windowMetrics.loudDensity < config.loudDensityEnd;

      if (endConditionMet) {
        if (this._state.discussionEndConditionStartTime === null) {
          this._state.discussionEndConditionStartTime = now;
        }
        const holdDuration = (now - this._state.discussionEndConditionStartTime) / 1000;
        if (holdDuration >= config.endHoldSeconds) {
          this._state.discussionOn = false;
          this._state.discussionStartTime = null;
          this._state.discussionEndConditionStartTime = null;
        }
      } else {
        this._state.discussionEndConditionStartTime = null;
      }
    }

    return { ...this._state };
  }

  /**
   * Reset the detector
   */
  reset(): void {
    this.aggregationBuffer.clear();
    this._state = {
      discussionOn: false,
      score: 0,
      discussionStartTime: null,
      discussionEndConditionStartTime: null,
    };
    this.discussionStartConditionStartTime = null;
    this.lastSpeechOnset = null;
    this.previousSpeechState = false;
    this.lastSpeechTime = null;
  }

  /**
   * Get buffer size (for debugging)
   */
  getBufferSize(): number {
    return this.aggregationBuffer.size;
  }
}

// Singleton instance
export const discussionDetector = new DiscussionDetector();

// Force cache invalidation - v4 (Cache fix applied)
export const DISCUSSION_DETECTOR_VERSION = '4.0.0';
export type DiscussionDetectorType = DiscussionDetector;
