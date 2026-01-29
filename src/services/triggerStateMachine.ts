/**
 * Trigger State Machine
 * Manages states: IDLE -> PRE_TRIGGER -> RECORDING -> COOLDOWN -> IDLE
 */

import type { TriggerState, AudioTriggerConfig, AudioTriggerEvent } from '@/types/audioTrigger';

export interface StateMachineState {
  state: TriggerState;
  stateStartTime: number;
  recordingStartTime: number | null;
  recordingDuration: number;
  preTriggerStartTime: number | null;
  cooldownStartTime: number | null;
  lastSpeechTime: number | null;
}

const INITIAL_STATE: StateMachineState = {
  state: 'IDLE',
  stateStartTime: Date.now(),
  recordingStartTime: null,
  recordingDuration: 0,
  preTriggerStartTime: null,
  cooldownStartTime: null,
  lastSpeechTime: null,
};

class TriggerStateMachine {
  private _state: StateMachineState = { ...INITIAL_STATE };
  private eventCallback: ((event: AudioTriggerEvent) => void) | null = null;

  /**
   * Set callback for state change events
   */
  setEventCallback(callback: (event: AudioTriggerEvent) => void): void {
    this.eventCallback = callback;
  }

  /**
   * Get current state
   */
  get state(): TriggerState {
    return this._state.state;
  }

  /**
   * Get full state object
   */
  get fullState(): StateMachineState {
    return { ...this._state };
  }

  /**
   * Get recording duration in seconds
   */
  getRecordingDuration(): number {
    if (this._state.state === 'RECORDING' && this._state.recordingStartTime) {
      return (Date.now() - this._state.recordingStartTime) / 1000;
    }
    return this._state.recordingDuration;
  }

  /**
   * Emit a state change event
   */
  private emitEvent(type: AudioTriggerEvent['type'], message?: string, payload?: Record<string, unknown>): void {
    if (this.eventCallback) {
      this.eventCallback({
        type,
        timestamp: Date.now(),
        message,
        payload,
      });
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: TriggerState): void {
    const oldState = this._state.state;
    if (oldState === newState) return;

    const now = Date.now();

    // Handle exit actions
    if (oldState === 'RECORDING' && this._state.recordingStartTime) {
      this._state.recordingDuration = (now - this._state.recordingStartTime) / 1000;
      this.emitEvent('recordingStopped', `Gravação parada após ${this._state.recordingDuration.toFixed(1)}s`, {
        duration: this._state.recordingDuration,
      });
    }

    // Update state
    this._state.state = newState;
    this._state.stateStartTime = now;

    // Handle entry actions
    switch (newState) {
      case 'IDLE':
        this._state.preTriggerStartTime = null;
        this._state.cooldownStartTime = null;
        break;

      case 'PRE_TRIGGER':
        this._state.preTriggerStartTime = now;
        break;

      case 'RECORDING':
        this._state.recordingStartTime = now;
        this._state.recordingDuration = 0;
        this.emitEvent('recordingStarted', 'Gravação iniciada');
        break;

      case 'COOLDOWN':
        this._state.cooldownStartTime = now;
        this._state.recordingStartTime = null;
        break;
    }

    this.emitEvent('stateChanged', `Estado: ${oldState} -> ${newState}`, {
      from: oldState,
      to: newState,
    });
  }

  /**
   * Process state machine transitions
   */
  process(
    speechRatio: number,
    discussionOn: boolean,
    config: AudioTriggerConfig
  ): void {
    const now = Date.now();
    const currentState = this._state.state;

    // Track last speech time
    if (speechRatio > 0.1) {
      this._state.lastSpeechTime = now;
    }

    switch (currentState) {
      case 'IDLE':
        // IDLE -> PRE_TRIGGER: speechRatio > 0.30 por preTriggerSeconds
        if (speechRatio > 0.30) {
          if (!this._state.preTriggerStartTime) {
            this._state.preTriggerStartTime = now;
            console.log(`[StateMachine] IDLE: speechRatio > 0.30 detected, starting preTrigger timer`);
          }
          const duration = (now - this._state.preTriggerStartTime) / 1000;
          console.log(`[StateMachine] IDLE: speechRatio=${speechRatio.toFixed(2)}, preTrigger duration=${duration.toFixed(1)}s / ${config.preTriggerSeconds}s`);
          if (duration >= config.preTriggerSeconds) {
            console.log(`[StateMachine] IDLE -> PRE_TRIGGER: preTrigger duration reached`);
            this.transitionTo('PRE_TRIGGER');
          }
        } else {
          if (this._state.preTriggerStartTime) {
            console.log(`[StateMachine] IDLE: speechRatio dropped to ${speechRatio.toFixed(2)}, resetting preTrigger timer`);
          }
          this._state.preTriggerStartTime = null;
        }
        break;

      case 'PRE_TRIGGER':
        // PRE_TRIGGER -> RECORDING: Discussion ON
        console.log(`[StateMachine] PRE_TRIGGER: discussionOn=${discussionOn}, speechRatio=${speechRatio.toFixed(2)}`);
        if (discussionOn) {
          console.log(`[StateMachine] PRE_TRIGGER -> RECORDING: discussion detected!`);
          this.transitionTo('RECORDING');
        }
        // PRE_TRIGGER -> IDLE: sem fala por 5s
        else if (this._state.lastSpeechTime && (now - this._state.lastSpeechTime) > 5000) {
          console.log(`[StateMachine] PRE_TRIGGER -> IDLE: no speech for 5s`);
          this.transitionTo('IDLE');
        }
        break;

      case 'RECORDING':
        // Update recording duration
        if (this._state.recordingStartTime) {
          this._state.recordingDuration = (now - this._state.recordingStartTime) / 1000;
        }
        // RECORDING -> COOLDOWN: Discussion OFF
        if (!discussionOn) {
          this.transitionTo('COOLDOWN');
        }
        break;

      case 'COOLDOWN':
        // COOLDOWN -> RECORDING: Discussion ON volta durante cooldown
        if (discussionOn) {
          this.transitionTo('RECORDING');
        }
        // COOLDOWN -> IDLE: após cooldownSeconds
        else if (this._state.cooldownStartTime) {
          const cooldownDuration = (now - this._state.cooldownStartTime) / 1000;
          if (cooldownDuration >= config.cooldownSeconds) {
            this.transitionTo('IDLE');
          }
        }
        break;
    }
  }

  /**
   * Reset the state machine
   */
  reset(): void {
    const wasRecording = this._state.state === 'RECORDING';
    if (wasRecording) {
      this.emitEvent('recordingStopped', 'Gravação interrompida (reset)');
    }
    this._state = { ...INITIAL_STATE, stateStartTime: Date.now() };
    this.emitEvent('stateChanged', 'Estado resetado para IDLE', { to: 'IDLE' });
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this._state.state === 'RECORDING';
  }
}

// Singleton instance
export const triggerStateMachine = new TriggerStateMachine();
