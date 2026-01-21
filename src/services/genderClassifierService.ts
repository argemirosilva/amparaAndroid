/**
 * Gender Classifier Service
 * Classifies voice gender based on F0 with STRONG MALE BIAS
 */

import type { AudioTriggerConfig, GenderClass } from '@/types/audioTrigger';

/**
 * Classify voice gender based on F0 median
 * 
 * Rules (with male bias):
 * - F0 < f0LowMale (170 Hz) => MALE
 * - F0 > f0HighFemale (210 Hz) AND confidence > min => FEMALE
 * - F0 in ambiguous zone (170-210 Hz) => MALE if maleBiasEnabled
 * - F0 is null => MALE if maleBiasEnabled and speech detected
 */
export function classifyGender(
  f0Median: number | null,
  voicingConfidence: number,
  isSpeech: boolean,
  config: AudioTriggerConfig
): GenderClass {
  // No F0 detected
  if (f0Median === null) {
    // If speech is detected but no F0, apply male bias
    if (isSpeech && config.maleBiasEnabled) {
      return 'MALE';
    }
    return 'UNKNOWN';
  }

  // Clear male zone (low frequency)
  if (f0Median < config.f0LowMale) {
    return 'MALE';
  }

  // Clear female zone (high frequency with good confidence)
  if (f0Median > config.f0HighFemale && voicingConfidence >= config.voicingConfidenceMin) {
    return 'FEMALE';
  }

  // Ambiguous zone (170-210 Hz) or low confidence female
  if (config.maleBiasEnabled) {
    return 'MALE';
  }

  return 'UNKNOWN';
}

/**
 * Get display label for gender
 */
export function getGenderLabel(gender: GenderClass): string {
  switch (gender) {
    case 'MALE':
      return 'Masculino';
    case 'FEMALE':
      return 'Feminino';
    case 'UNKNOWN':
      return 'Indefinido';
  }
}

/**
 * Get icon for gender
 */
export function getGenderIcon(gender: GenderClass): string {
  switch (gender) {
    case 'MALE':
      return '♂️';
    case 'FEMALE':
      return '♀️';
    case 'UNKNOWN':
      return '❓';
  }
}

/**
 * Get color class for gender
 */
export function getGenderColor(gender: GenderClass): string {
  switch (gender) {
    case 'MALE':
      return 'text-blue-500';
    case 'FEMALE':
      return 'text-pink-500';
    case 'UNKNOWN':
      return 'text-muted-foreground';
  }
}

/**
 * Get background color class for gender
 */
export function getGenderBgColor(gender: GenderClass): string {
  switch (gender) {
    case 'MALE':
      return 'bg-blue-500/10';
    case 'FEMALE':
      return 'bg-pink-500/10';
    case 'UNKNOWN':
      return 'bg-muted';
  }
}
