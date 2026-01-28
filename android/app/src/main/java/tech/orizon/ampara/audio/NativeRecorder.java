package tech.orizon.ampara.audio;

import android.content.Context;
import android.media.MediaRecorder;
import android.util.Log;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Native Audio Recorder
 * Records audio in background using MediaRecorder
 */
public class NativeRecorder {
    private static final String TAG = "NativeRecorder";
    
    private MediaRecorder mediaRecorder;
    private String currentFilePath;
    private boolean isRecording = false;
    private Context context;
    
    public NativeRecorder(Context context) {
        this.context = context;
    }
    
    /**
     * Start recording audio
     * @return File path of the recording, or null if failed
     */
    public String startRecording() {
        if (isRecording) {
            Log.w(TAG, "Already recording");
            return currentFilePath;
        }
        
        try {
            // Create recordings directory
            File recordingsDir = new File(context.getFilesDir(), "recordings");
            if (!recordingsDir.exists()) {
                recordingsDir.mkdirs();
            }
            
            // Generate filename with timestamp
            String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
            String filename = "native_" + timestamp + ".m4a";
            File outputFile = new File(recordingsDir, filename);
            currentFilePath = outputFile.getAbsolutePath();
            
            // Initialize MediaRecorder
            mediaRecorder = new MediaRecorder();
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setAudioEncodingBitRate(128000);
            mediaRecorder.setAudioSamplingRate(44100);
            mediaRecorder.setOutputFile(currentFilePath);
            
            mediaRecorder.prepare();
            mediaRecorder.start();
            
            isRecording = true;
            Log.i(TAG, "Recording started: " + currentFilePath);
            
            return currentFilePath;
            
        } catch (IOException e) {
            Log.e(TAG, "Failed to start recording", e);
            releaseRecorder();
            return null;
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error starting recording", e);
            releaseRecorder();
            return null;
        }
    }
    
    /**
     * Stop recording audio
     * @return File path of the recording, or null if failed
     */
    public String stopRecording() {
        if (!isRecording) {
            Log.w(TAG, "Not recording");
            return null;
        }
        
        try {
            mediaRecorder.stop();
            String filePath = currentFilePath;
            
            releaseRecorder();
            isRecording = false;
            
            // Verify file exists and has content
            File file = new File(filePath);
            if (file.exists() && file.length() > 0) {
                Log.i(TAG, "Recording stopped: " + filePath + " (" + file.length() + " bytes)");
                return filePath;
            } else {
                Log.e(TAG, "Recording file is empty or doesn't exist");
                return null;
            }
            
        } catch (RuntimeException e) {
            Log.e(TAG, "Failed to stop recording", e);
            releaseRecorder();
            return null;
        }
    }
    
    /**
     * Check if currently recording
     */
    public boolean isRecording() {
        return isRecording;
    }
    
    /**
     * Get current recording file path
     */
    public String getCurrentFilePath() {
        return currentFilePath;
    }
    
    /**
     * Release MediaRecorder resources
     */
    private void releaseRecorder() {
        if (mediaRecorder != null) {
            try {
                mediaRecorder.release();
            } catch (Exception e) {
                Log.e(TAG, "Error releasing MediaRecorder", e);
            }
            mediaRecorder = null;
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
