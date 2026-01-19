/**
 * WAV Encoder - Converts raw audio samples to WAV format
 */

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function floatTo16BitPCM(view: DataView, offset: number, samples: Float32Array): void {
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

/**
 * Encodes Float32Array audio samples to WAV format
 * @param samples - Audio samples as Float32Array
 * @param sampleRate - Sample rate (e.g., 44100)
 * @returns ArrayBuffer containing WAV data
 */
export function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // mono channel
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * channels * bytesPerSample)
  view.setUint16(32, 2, true);  // block align (channels * bytesPerSample)
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // PCM samples
  floatTo16BitPCM(view, 44, samples);

  return buffer;
}

/**
 * Merges multiple Float32Array buffers into a single Float32Array
 * @param buffers - Array of Float32Array audio buffers
 * @returns Merged Float32Array
 */
export function mergeBuffers(buffers: Float32Array[]): Float32Array {
  const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
  const result = new Float32Array(totalLength);
  
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  
  return result;
}
