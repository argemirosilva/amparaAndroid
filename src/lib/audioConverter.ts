/**
 * Audio Converter - Converts audio files to 16kHz WAV mono
 */

import { encodeWAV } from './wavEncoder';

export const TARGET_SAMPLE_RATE = 16000;

/**
 * Checks if the file is a supported audio file
 */
export function isAudioFile(file: File): boolean {
  const audioTypes = [
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/ogg',
    'audio/m4a',
    'audio/mp4',
    'audio/aac',
    'audio/webm',
    'audio/flac',
  ];
  
  return (
    audioTypes.includes(file.type) ||
    /\.(wav|mp3|ogg|m4a|aac|webm|flac|opus)$/i.test(file.name)
  );
}

/**
 * Converts any audio file to WAV 16kHz mono
 * @param file - The audio file to convert
 * @returns A Blob containing the converted WAV audio
 */
export async function convertAudioTo16kWav(file: File): Promise<Blob> {
  // Decode the original audio
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    await audioContext.close();
    throw new Error('Não foi possível decodificar o arquivo de áudio');
  }
  
  // Calculate output length for target sample rate
  const outputLength = Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE);
  
  // Create OfflineAudioContext for resampling
  const offlineCtx = new OfflineAudioContext(
    1, // mono output
    outputLength,
    TARGET_SAMPLE_RATE
  );
  
  // Create buffer source and connect
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  
  // Render the resampled audio
  const resampled = await offlineCtx.startRendering();
  const samples = resampled.getChannelData(0);
  
  // Encode as WAV
  const wavBuffer = encodeWAV(samples, TARGET_SAMPLE_RATE);
  
  // Cleanup
  await audioContext.close();
  
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Gets file extension for the converted file
 */
export function getConvertedFileName(originalName: string): string {
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  return `${baseName}_16k.wav`;
}
