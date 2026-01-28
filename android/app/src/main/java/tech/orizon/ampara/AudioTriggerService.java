package tech.orizon.ampara;

import android.app.Service;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.IBinder;
import android.util.Log;

import tech.orizon.ampara.audio.AudioDSP;
import tech.orizon.ampara.audio.AudioTriggerConfig;
import tech.orizon.ampara.audio.DiscussionDetector;

import java.util.ArrayList;
import java.util.List;

/**
 * Native Audio Trigger Service
 * Captures and analyzes audio in background to detect discussions
 */
public class AudioTriggerService extends Service {
    private static final String TAG = "AudioTriggerService";
    
    private AudioRecord audioRecord;
    private Thread processingThread;
    private volatile boolean isRunning = false;
    
    private AudioTriggerConfig config;
    private DiscussionDetector detector;
    
    private short[] frameBuffer;
    private List<DiscussionDetector.AggregationMetrics> aggregationBuffer;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "AudioTriggerService created");
        
        config = new AudioTriggerConfig();
        detector = new DiscussionDetector(config);
        
        int frameSamples = config.getFrameSamples();
        frameBuffer = new short[frameSamples];
        aggregationBuffer = new ArrayList<>();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "AudioTriggerService started");
        
        if (!isRunning) {
            startAudioCapture();
        }
        
        return START_STICKY;
    }
    
    private void startAudioCapture() {
        try {
            int bufferSize = AudioRecord.getMinBufferSize(
                config.sampleRate,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            );
            
            if (bufferSize == AudioRecord.ERROR || bufferSize == AudioRecord.ERROR_BAD_VALUE) {
                Log.e(TAG, "Invalid buffer size: " + bufferSize);
                return;
            }
            
            // Use larger buffer for stability
            bufferSize = Math.max(bufferSize, config.getFrameSamples() * 4);
            
            audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.MIC,
                config.sampleRate,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            );
            
            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord not initialized");
                return;
            }
            
            audioRecord.startRecording();
            isRunning = true;
            
            processingThread = new Thread(this::processAudioLoop);
            processingThread.start();
            
            Log.d(TAG, "Audio capture started successfully");
            
        } catch (SecurityException e) {
            Log.e(TAG, "Microphone permission not granted", e);
        } catch (Exception e) {
            Log.e(TAG, "Error starting audio capture", e);
        }
    }
    
    private void processAudioLoop() {
        Log.d(TAG, "Audio processing loop started");
        
        int frameSamples = config.getFrameSamples();
        int aggregationFrames = config.getAggregationFrames();
        
        while (isRunning && audioRecord != null) {
            try {
                // Read one frame
                int samplesRead = audioRecord.read(frameBuffer, 0, frameSamples);
                
                if (samplesRead < 0) {
                    Log.e(TAG, "Error reading audio: " + samplesRead);
                    break;
                }
                
                if (samplesRead != frameSamples) {
                    continue; // Skip incomplete frames
                }
                
                // Process frame
                processFrame(frameBuffer, frameSamples);
                
                // Check if we have enough frames for aggregation
                if (aggregationBuffer.size() >= aggregationFrames) {
                    processAggregation();
                    aggregationBuffer.clear();
                }
                
            } catch (Exception e) {
                Log.e(TAG, "Error in audio processing loop", e);
                break;
            }
        }
        
        Log.d(TAG, "Audio processing loop ended");
    }
    
    private void processFrame(short[] samples, int length) {
        // Calculate metrics
        double rmsDb = AudioDSP.calculateRMS(samples, length);
        double zcr = AudioDSP.calculateZCR(samples, length);
        
        // Detect speech and loudness
        double noiseFloor = detector.getNoiseFloor();
        boolean isSpeech = AudioDSP.isSpeechLike(rmsDb, zcr);
        boolean isLoud = AudioDSP.isLoud(rmsDb, noiseFloor + config.loudDeltaDb);
        
        // Add to aggregation buffer
        DiscussionDetector.AggregationMetrics metrics = 
            new DiscussionDetector.AggregationMetrics(rmsDb, zcr, isSpeech, isLoud);
        aggregationBuffer.add(metrics);
    }
    
    private void processAggregation() {
        // Calculate aggregated metrics
        double avgRmsDb = 0;
        double avgZcr = 0;
        int speechCount = 0;
        int loudCount = 0;
        
        for (DiscussionDetector.AggregationMetrics m : aggregationBuffer) {
            avgRmsDb += m.rmsDb;
            avgZcr += m.zcr;
            if (m.isSpeech) speechCount++;
            if (m.isLoud) loudCount++;
        }
        
        int count = aggregationBuffer.size();
        avgRmsDb /= count;
        avgZcr /= count;
        
        boolean isSpeech = speechCount > (count / 2);
        boolean isLoud = loudCount > (count / 2);
        
        // Process with detector
        DiscussionDetector.AggregationMetrics aggregated = 
            new DiscussionDetector.AggregationMetrics(avgRmsDb, avgZcr, isSpeech, isLoud);
        
        DiscussionDetector.DetectionResult result = detector.process(aggregated);
        
        // Log detection
        if (result.shouldStartRecording) {
            Log.i(TAG, String.format("DISCUSSION DETECTED! Reason: %s, Speech: %.2f, Loud: %.2f",
                result.reason, result.speechDensity, result.loudDensity));
            notifyJavaScript("discussionDetected", result.reason);
        }
        
        if (result.shouldStopRecording) {
            Log.i(TAG, String.format("DISCUSSION ENDED! Reason: %s", result.reason));
            notifyJavaScript("discussionEnded", result.reason);
        }
    }
    
    private void notifyJavaScript(String event, String reason) {
        // Send broadcast to JavaScript
        Intent intent = new Intent("tech.orizon.ampara.AUDIO_TRIGGER_EVENT");
        intent.putExtra("event", event);
        intent.putExtra("reason", reason);
        intent.putExtra("timestamp", System.currentTimeMillis());
        sendBroadcast(intent);
        
        Log.d(TAG, "Broadcast sent: " + event);
    }
    
    @Override
    public void onDestroy() {
        Log.d(TAG, "AudioTriggerService destroyed");
        stopAudioCapture();
        super.onDestroy();
    }
    
    private void stopAudioCapture() {
        isRunning = false;
        
        if (audioRecord != null) {
            try {
                if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    audioRecord.stop();
                }
                audioRecord.release();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping audio record", e);
            }
            audioRecord = null;
        }
        
        if (processingThread != null) {
            try {
                processingThread.join(1000);
            } catch (InterruptedException e) {
                Log.e(TAG, "Error joining processing thread", e);
            }
            processingThread = null;
        }
        
        Log.d(TAG, "Audio capture stopped");
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
