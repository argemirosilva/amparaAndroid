/**
 * Config Converter - Convert server config (snake_case) to client config (camelCase)
 */

import type { AudioTriggerConfig } from '@/types/audioTrigger';
import type { ServerAudioTriggerConfig } from '@/lib/types';
import { DEFAULT_CONFIG } from '@/types/audioTrigger';

/**
 * Convert server config (snake_case) to client config (camelCase)
 */
export function serverToClientConfig(server: ServerAudioTriggerConfig): AudioTriggerConfig {
  return {
    sampleRate: server.sample_rate,
    frameMs: server.frame_ms,
    aggregationMs: server.aggregation_ms,
    discussionWindowSeconds: server.discussion_window_seconds,
    preTriggerSeconds: server.pre_trigger_seconds,
    startHoldSeconds: server.start_hold_seconds,
    endHoldSeconds: server.end_hold_seconds,
    cooldownSeconds: server.cooldown_seconds,
    noiseFloorLearningRate: server.noise_floor_learning_rate,
    loudDeltaDb: server.loud_delta_db,
    vadDeltaDb: server.vad_delta_db,
    speechDensityMin: server.speech_density_min,
    loudDensityMin: server.loud_density_min,
    turnTakingMin: server.turn_taking_min,
    speechDensityEnd: server.speech_density_end,
    loudDensityEnd: server.loud_density_end,
    silenceDecaySeconds: server.silence_decay_seconds,
    silenceDecayRate: server.silence_decay_rate,
    maleBiasEnabled: server.male_bias_enabled,
    f0LowMale: server.f0_low_male,
    f0HighFemale: server.f0_high_female,
    voicingConfidenceMin: server.voicing_confidence_min,
    zcrMinVoice: server.zcr_min_voice,
    zcrMaxVoice: server.zcr_max_voice,
  };
}

/**
 * Convert client config (camelCase) to server config (snake_case)
 */
export function clientToServerConfig(client: AudioTriggerConfig): ServerAudioTriggerConfig {
  return {
    sample_rate: client.sampleRate,
    frame_ms: client.frameMs,
    aggregation_ms: client.aggregationMs,
    discussion_window_seconds: client.discussionWindowSeconds,
    pre_trigger_seconds: client.preTriggerSeconds,
    start_hold_seconds: client.startHoldSeconds,
    end_hold_seconds: client.endHoldSeconds,
    cooldown_seconds: client.cooldownSeconds,
    noise_floor_learning_rate: client.noiseFloorLearningRate,
    loud_delta_db: client.loudDeltaDb,
    vad_delta_db: client.vadDeltaDb,
    speech_density_min: client.speechDensityMin,
    loud_density_min: client.loudDensityMin,
    turn_taking_min: client.turnTakingMin,
    speech_density_end: client.speechDensityEnd,
    loud_density_end: client.loudDensityEnd,
    silence_decay_seconds: client.silenceDecaySeconds,
    silence_decay_rate: client.silenceDecayRate,
    male_bias_enabled: client.maleBiasEnabled,
    f0_low_male: client.f0LowMale,
    f0_high_female: client.f0HighFemale,
    voicing_confidence_min: client.voicingConfidenceMin,
    zcr_min_voice: client.zcrMinVoice,
    zcr_max_voice: client.zcrMaxVoice,
  };
}

/**
 * Get config from server with fallback to defaults
 */
export function getConfigFromServer(
  serverConfig: ServerAudioTriggerConfig | undefined | null
): AudioTriggerConfig {
  if (!serverConfig) {
    return DEFAULT_CONFIG;
  }
  return serverToClientConfig(serverConfig);
}
