package tech.orizon.ampara.audio;

import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Native Audio Recorder with 30-second segmentation
 * Records audio in background using AudioRecord and saves as WAV
 */
public class NativeRecorder {
    private static final String TAG = "NativeRecorder";
    private static final int SEGMENT_DURATION_MS = 30000; // 30 seconds
    private static final int SAMPLE_RATE = 16000; // 16 kHz
    private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    private static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;
    
    private AudioRecord audioRecord;
    private String currentFilePath;
    private String sessionId;
    private int segmentIndex = 0;
    private boolean isRecording = false;
    private Context context;
    private Handler handler;
    private Runnable segmentRunnable;
    private SegmentCallback segmentCallback;
    private Thread recordingThread;
    private int bufferSize;
    
    public interface SegmentCallback {
        void onSegmentComplete(String filePath, int segmentIndex, String sessionId);
    }
    
    public NativeRecorder(Context context) {
        this.context = context;
        this.handler = new Handler(Looper.getMainLooper());
        this.bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT);
    }
    
    /**
     * Set callback for segment completion
     */
    public void setSegmentCallback(SegmentCallback callback) {
        this.segmentCallback = callback;
    }
    
    /**
     * Start recording audio with automatic segmentation
     * @return Session ID, or null if failed
     */
    public String startRecording() {
        if (isRecording) {
            Log.w(TAG, "Already recording");
            return sessionId;
        }
        
        // Generate session ID
        sessionId = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        segmentIndex = 0;
        isRecording = true;
        
        Log.i(TAG, "Starting recording session: " + sessionId);
        
        // Start first segment
        startSegment();
        
        return sessionId;
    }
    
    /**
     * Start a new segment
     */
    private void startSegment() {
        if (!isRecording) return;
        
        try {
            // Create recordings directory
            File recordingsDir = new File(context.getFilesDir(), "recordings");
            if (!recordingsDir.exists()) {
                recordingsDir.mkdirs();
            }
            
            // Generate filename: session_segment.wav
            String filename = String.format(Locale.US, "%s_%03d.wav", sessionId, segmentIndex);
            File outputFile = new File(recordingsDir, filename);
            currentFilePath = outputFile.getAbsolutePath();
            
            // Initialize AudioRecord
            audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize
            );
            
            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord initialization failed");
                isRecording = false;
                return;
            }
            
            audioRecord.startRecording();
            
            Log.i(TAG, String.format("Segment %d started: %s", segmentIndex, currentFilePath));
            
            // Start recording thread
            final String segmentFilePath = currentFilePath;
            recordingThread = new Thread(() -> {
                writeWavFile(segmentFilePath);
            });
            recordingThread.start();
            
            // Schedule next segment
            segmentRunnable = new Runnable() {
                @Override
                public void run() {
                    if (isRecording) {
                        stopSegment();
                        segmentIndex++;
                        startSegment();
                    }
                }
            };
            handler.postDelayed(segmentRunnable, SEGMENT_DURATION_MS);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to start segment", e);
            releaseRecorder();
            isRecording = false;
        }
    }
    
    /**
     * Write PCM data to WAV file
     */
    private void writeWavFile(String filePath) {
        FileOutputStream fos = null;
        try {
            fos = new FileOutputStream(filePath);
            
            // Write WAV header (will be updated later with actual size)
            writeWavHeader(fos, 0);
            
            byte[] buffer = new byte[bufferSize];
            int totalBytesWritten = 0;
            
            while (isRecording && audioRecord != null && audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                int bytesRead = audioRecord.read(buffer, 0, buffer.length);
                if (bytesRead > 0) {
                    fos.write(buffer, 0, bytesRead);
                    totalBytesWritten += bytesRead;
                }
            }
            
            fos.close();
            
            // Update WAV header with actual file size
            updateWavHeader(filePath, totalBytesWritten);
            
            Log.i(TAG, String.format("Segment written: %d bytes", totalBytesWritten));
            
        } catch (IOException e) {
            Log.e(TAG, "Error writing WAV file", e);
        } finally {
            try {
                if (fos != null) fos.close();
            } catch (IOException e) {
                Log.e(TAG, "Error closing file", e);
            }
        }
    }
    
    /**
     * Write WAV file header
     */
    private void writeWavHeader(FileOutputStream fos, int dataSize) throws IOException {
        int byteRate = SAMPLE_RATE * 1 * 16 / 8; // SampleRate * Channels * BitsPerSample / 8
        int blockAlign = 1 * 16 / 8; // Channels * BitsPerSample / 8
        
        fos.write(new byte[]{'R', 'I', 'F', 'F'}); // ChunkID
        fos.write(intToByteArray(36 + dataSize), 0, 4); // ChunkSize
        fos.write(new byte[]{'W', 'A', 'V', 'E'}); // Format
        fos.write(new byte[]{'f', 'm', 't', ' '}); // Subchunk1ID
        fos.write(intToByteArray(16), 0, 4); // Subchunk1Size (16 for PCM)
        fos.write(shortToByteArray((short) 1), 0, 2); // AudioFormat (1 = PCM)
        fos.write(shortToByteArray((short) 1), 0, 2); // NumChannels (1 = Mono)
        fos.write(intToByteArray(SAMPLE_RATE), 0, 4); // SampleRate
        fos.write(intToByteArray(byteRate), 0, 4); // ByteRate
        fos.write(shortToByteArray((short) blockAlign), 0, 2); // BlockAlign
        fos.write(shortToByteArray((short) 16), 0, 2); // BitsPerSample
        fos.write(new byte[]{'d', 'a', 't', 'a'}); // Subchunk2ID
        fos.write(intToByteArray(dataSize), 0, 4); // Subchunk2Size
    }
    
    /**
     * Update WAV header with actual file size
     */
    private void updateWavHeader(String filePath, int dataSize) {
        try {
            RandomAccessFile raf = new RandomAccessFile(filePath, "rw");
            raf.seek(4); // ChunkSize position
            raf.write(intToByteArray(36 + dataSize), 0, 4);
            raf.seek(40); // Subchunk2Size position
            raf.write(intToByteArray(dataSize), 0, 4);
            raf.close();
        } catch (IOException e) {
            Log.e(TAG, "Error updating WAV header", e);
        }
    }
    
    /**
     * Convert int to byte array (little-endian)
     */
    private byte[] intToByteArray(int value) {
        return new byte[]{
            (byte) (value & 0xff),
            (byte) ((value >> 8) & 0xff),
            (byte) ((value >> 16) & 0xff),
            (byte) ((value >> 24) & 0xff)
        };
    }
    
    /**
     * Convert short to byte array (little-endian)
     */
    private byte[] shortToByteArray(short value) {
        return new byte[]{
            (byte) (value & 0xff),
            (byte) ((value >> 8) & 0xff)
        };
    }
    
    /**
     * Stop current segment
     */
    private void stopSegment() {
        if (audioRecord == null) return;
        
        try {
            if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                audioRecord.stop();
            }
            
            // Wait for recording thread to finish
            if (recordingThread != null) {
                recordingThread.join(1000);
            }
            
            String filePath = currentFilePath;
            int index = segmentIndex;
            
            releaseRecorder();
            
            // Verify file exists and has content
            File file = new File(filePath);
            if (file.exists() && file.length() > 0) {
                Log.i(TAG, String.format("Segment %d stopped: %s (%d bytes)", 
                    index, filePath, file.length()));
                
                // Notify callback
                if (segmentCallback != null) {
                    segmentCallback.onSegmentComplete(filePath, index, sessionId);
                }
            } else {
                Log.e(TAG, "Segment file is empty or doesn't exist");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop segment", e);
            releaseRecorder();
        }
    }
    
    /**
     * Stop recording completely
     * @return Session ID, or null if not recording
     */
    public String stopRecording() {
        if (!isRecording) {
            Log.w(TAG, "Not recording");
            return null;
        }
        
        Log.i(TAG, "Stopping recording session: " + sessionId);
        
        // Cancel scheduled segment
        if (segmentRunnable != null) {
            handler.removeCallbacks(segmentRunnable);
            segmentRunnable = null;
        }
        
        // Stop current segment
        stopSegment();
        
        isRecording = false;
        String completedSessionId = sessionId;
        sessionId = null;
        segmentIndex = 0;
        
        return completedSessionId;
    }
    
    /**
     * Check if currently recording
     */
    public boolean isRecording() {
        return isRecording;
    }
    
    /**
     * Get current session ID
     */
    public String getSessionId() {
        return sessionId;
    }
    
    /**
     * Get current segment index
     */
    public int getSegmentIndex() {
        return segmentIndex;
    }
    
    /**
     * Release AudioRecord resources
     */
    private void releaseRecorder() {
        if (audioRecord != null) {
            try {
                if (audioRecord.getState() == AudioRecord.STATE_INITIALIZED) {
                    audioRecord.release();
                }
            } catch (Exception e) {
                Log.e(TAG, "Error releasing AudioRecord", e);
            }
            audioRecord = null;
        }
    }
    
    /**
     * Cleanup on destroy
     */
    public void destroy() {
        if (isRecording) {
            stopRecording();
        }
        releaseRecorder();
    }
}
