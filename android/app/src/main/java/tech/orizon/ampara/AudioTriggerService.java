package tech.orizon.ampara;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import android.content.pm.PackageManager;
import android.Manifest;

import org.json.JSONObject;

import tech.orizon.ampara.audio.AudioDSP;
import tech.orizon.ampara.audio.AudioTriggerConfig;
import tech.orizon.ampara.audio.DiscussionDetector;
import tech.orizon.ampara.audio.NativeRecorder;
import tech.orizon.ampara.audio.AudioUploader;
import tech.orizon.ampara.audio.LocationManager;
import tech.orizon.ampara.audio.SilenceDetector;
import tech.orizon.ampara.audio.UploadQueue;

import java.util.ArrayList;
import java.util.List;

/**
 * Native Audio Trigger Service
 * Captures and analyzes audio in background to detect discussions
 */
public class AudioTriggerService extends Service {
    private static final String TAG = "AudioTriggerService";
    private static final String CHANNEL_ID = "AudioTriggerChannel";
    private static final int NOTIFICATION_ID = 1001;
    
    private AudioRecord audioRecord;
    private Thread processingThread;
    private volatile boolean isRunning = false;
    private PowerManager.WakeLock wakeLock;
    
    private AudioTriggerConfig config;
    private DiscussionDetector detector;
    private NativeRecorder recorder;
    private AudioUploader uploader;
    private LocationManager locationManager;
    private SilenceDetector silenceDetector;
    private UploadQueue uploadQueue;
    
    private String sessionToken;
    private String emailUsuario;
    private String currentOrigemGravacao = "automatico";
    
    private short[] frameBuffer;
    private List<DiscussionDetector.AggregationMetrics> aggregationBuffer;
    private int frameCounter = 0;
    private int aggregationCounter = 0;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "AudioTriggerService created");
        
        // Check RECORD_AUDIO permission before starting foreground service
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
                != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "RECORD_AUDIO permission not granted! Cannot start foreground service.");
            stopSelf();
            return;
        }
        
        // DO NOT call startForeground() here - we already have a ForegroundService running
        // This service runs as a background service under the main ForegroundService
        acquireWakeLock();
        
        config = new AudioTriggerConfig();
        detector = new DiscussionDetector(config);
        recorder = new NativeRecorder(this);
        uploader = new AudioUploader(this);
        locationManager = new LocationManager(this);
        silenceDetector = new SilenceDetector();
        uploadQueue = new UploadQueue(this, uploader);
        
        // Setup calibration callback
        detector.setCalibrationCallback(isCalibrated -> {
            notifyCalibrationStatus(isCalibrated);
        });
        
        // Setup recorder callback
        recorder.setSegmentCallback((filePath, segmentIndex, sessionId) -> {
            Log.i(TAG, String.format("Segment complete: %d", segmentIndex));
            
            // Enqueue for upload
            UploadQueue.UploadTask task = new UploadQueue.UploadTask(
                filePath,
                segmentIndex,
                sessionId,
                locationManager.getLatitude(),
                locationManager.getLongitude(),
                currentOrigemGravacao
            );
            uploadQueue.enqueue(task);
            
            // Notify JavaScript
            notifyRecordingProgress(sessionId, segmentIndex);
        });
        
        // Setup upload progress callback
        uploadQueue.setProgressCallback((pending, success, failure) -> {
            Log.d(TAG, String.format("Upload progress: pending=%d, success=%d, failure=%d",
                pending, success, failure));
            notifyUploadProgress(pending, success, failure);
        });
        
        int frameSamples = config.getFrameSamples();
        frameBuffer = new short[frameSamples];
        aggregationBuffer = new ArrayList<>();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "AudioTriggerService started");
        
        // Handle commands
        if (intent != null && intent.getAction() != null) {
            String action = intent.getAction();
            
            if ("START_RECORDING".equals(action)) {
                Log.i(TAG, "Manual recording start requested");
                
                // Get credentials and origem from intent
                if (intent.hasExtra("sessionToken")) {
                    sessionToken = intent.getStringExtra("sessionToken");
                    emailUsuario = intent.getStringExtra("emailUsuario");
                    currentOrigemGravacao = intent.getStringExtra("origemGravacao");
                    
                    uploader.setCredentials(sessionToken, emailUsuario);
                }
                
                // Start recording, location tracking, and upload queue
                String sessionId = recorder.startRecording();
                if (sessionId != null) {
                    locationManager.startTracking();
                    uploadQueue.start();
                    uploadQueue.resetStats();
                    silenceDetector.reset();
                    
                    Log.i(TAG, "Manual recording started: " + sessionId);
                    notifyRecordingStarted(sessionId);
                }
                return START_STICKY;
            }
            
            if ("STOP_RECORDING".equals(action)) {
                Log.i(TAG, "Manual recording stop requested");
                
                String sessionId = recorder.stopRecording();
                if (sessionId != null) {
                    locationManager.stopTracking();
                    
                    Log.i(TAG, "Manual recording stopped: " + sessionId);
                    notifyRecordingStopped(sessionId);
                }
                return START_STICKY;
            }
            
            if ("UPDATE_CONFIG".equals(action)) {
                Log.i(TAG, "Config update requested");
                
                if (intent.hasExtra("config")) {
                    String configJson = intent.getStringExtra("config");
                    applyConfiguration(configJson);
                    Log.i(TAG, "Configuration updated dynamically");
                }
                return START_STICKY;
            }
        }
        
        // Apply configuration if provided
        if (intent != null && intent.hasExtra("config")) {
            String configJson = intent.getStringExtra("config");
            applyConfiguration(configJson);
        }
        
        if (!isRunning) {
            startAudioCapture();
        }
        
        return START_STICKY;
    }
    
    private void applyConfiguration(String configJson) {
        try {
            JSONObject json = new JSONObject(configJson);
            
            Log.d(TAG, "Applying configuration from API: " + configJson);
            
            // Audio capture settings
            if (json.has("sampleRate")) config.sampleRate = json.getInt("sampleRate");
            if (json.has("frameMs")) config.frameMs = json.getInt("frameMs");
            if (json.has("aggregationMs")) config.aggregationMs = json.getInt("aggregationMs");
            
            // Detection thresholds - now using API config
            if (json.has("loudDeltaDb")) config.loudDeltaDb = json.getDouble("loudDeltaDb");
            if (json.has("vadDeltaDb")) config.vadDeltaDb = json.getDouble("vadDeltaDb");
            if (json.has("speechDensityMin")) config.speechDensityMin = json.getDouble("speechDensityMin");
            if (json.has("loudDensityMin")) config.loudDensityMin = json.getDouble("loudDensityMin");
            
            Log.i(TAG, "Detection thresholds applied from API");
            
            // Timing windows
            if (json.has("discussionWindowSeconds")) config.discussionWindowSeconds = json.getInt("discussionWindowSeconds");
            if (json.has("preTriggerSeconds")) config.preTriggerSeconds = json.getInt("preTriggerSeconds");
            if (json.has("startHoldSeconds")) config.startHoldSeconds = json.getInt("startHoldSeconds");
            if (json.has("endHoldSeconds")) config.endHoldSeconds = json.getInt("endHoldSeconds");
            if (json.has("cooldownSeconds")) config.cooldownSeconds = json.getInt("cooldownSeconds");
            
            // Noise floor learning
            if (json.has("noiseFloorLearningRate")) config.noiseFloorLearningRate = json.getDouble("noiseFloorLearningRate");
            
            // Turn-taking detection
            if (json.has("turnTakingMin")) config.turnTakingMin = json.getInt("turnTakingMin");
            
            // End detection
            if (json.has("speechDensityEnd")) config.speechDensityEnd = json.getDouble("speechDensityEnd");
            if (json.has("loudDensityEnd")) config.loudDensityEnd = json.getDouble("loudDensityEnd");
            if (json.has("silenceDecaySeconds")) config.silenceDecaySeconds = json.getInt("silenceDecaySeconds");
            if (json.has("silenceDecayRate")) config.silenceDecayRate = json.getDouble("silenceDecayRate");
            
            // ZCR thresholds
            if (json.has("zcrMinVoice")) config.zcrMinVoice = json.getDouble("zcrMinVoice");
            if (json.has("zcrMaxVoice")) config.zcrMaxVoice = json.getDouble("zcrMaxVoice");
            
            Log.i(TAG, String.format("Configuration applied: speechDensityMin=%.2f, loudDensityMin=%.2f, endHoldSeconds=%d",
                config.speechDensityMin, config.loudDensityMin, config.endHoldSeconds));
            
        } catch (Exception e) {
            Log.e(TAG, "Error parsing configuration JSON", e);
        }
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
                frameCounter++;
                
                // Check if we have enough frames for aggregation
                if (aggregationBuffer.size() >= aggregationFrames) {
                    processAggregation();
                    aggregationBuffer.clear();
                    aggregationCounter++;
                    
                    // Log every 10 aggregations (~10 seconds)
                    if (aggregationCounter % 10 == 0) {
                        Log.d(TAG, String.format("[ALIVE] Processed %d frames, %d aggregations, NoiseFloor: %.1f dB",
                            frameCounter, aggregationCounter, detector.getNoiseFloor()));
                    }
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
        
        // Hybrid threshold: relative (noiseFloor + delta) OR absolute minimum
        // Ensures detection even in very noisy environments
        double relativeLoudThreshold = noiseFloor + config.loudDeltaDb;
        double absoluteLoudThreshold = -20.0; // Absolute minimum for loud detection
        double loudThreshold = Math.max(relativeLoudThreshold, absoluteLoudThreshold);
        boolean isLoud = AudioDSP.isLoud(rmsDb, loudThreshold);
        
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
        
        // Log every aggregation for debugging
        if (aggregationCounter % 5 == 0) {
            Log.d(TAG, String.format("[METRICS] RMS: %.1f dB, ZCR: %.3f, Speech: %b, Loud: %b, State: %s",
                avgRmsDb, avgZcr, isSpeech, isLoud, detector.getState()));
        }
        
        // Log detection
        if (result.shouldStartRecording) {
            Log.i(TAG, String.format("DISCUSSION DETECTED! Reason: %s, Speech: %.2f, Loud: %.2f",
                result.reason, result.speechDensity, result.loudDensity));
            
            // Start native recording with auto mode
            currentOrigemGravacao = "automatico";
            String sessionId = recorder.startRecording();
            if (sessionId != null) {
                locationManager.startTracking();
                uploadQueue.start();
                uploadQueue.resetStats();
                silenceDetector.reset();
                
                Log.i(TAG, "Native recording started: " + sessionId);
                notifyRecordingStarted(sessionId);
            }
            
            notifyJavaScript("discussionDetected", result.reason);
        }
        
        // Check silence detector during recording
        if (recorder.isRecording()) {
            if (silenceDetector.processFrame(avgRmsDb)) {
                Log.i(TAG, "Silence timeout reached, stopping recording");
                
                String sessionId = recorder.stopRecording();
                if (sessionId != null) {
                    locationManager.stopTracking();
                    Log.i(TAG, "Recording stopped due to silence: " + sessionId);
                    notifyRecordingStopped(sessionId);
                }
            }
        }
        
        if (result.shouldStopRecording) {
            Log.i(TAG, String.format("DISCUSSION ENDED! Reason: %s", result.reason));
            
            // Stop native recording
            String sessionId = recorder.stopRecording();
            if (sessionId != null) {
                locationManager.stopTracking();
                Log.i(TAG, "Native recording stopped: " + sessionId);
                notifyRecordingStopped(sessionId);
            }
            
            notifyJavaScript("discussionEnded", result.reason);
        }
    }
    
    private void notifyJavaScript(String event, String reason) {
        // Send explicit broadcast to JavaScript (required for Android 14+)
        Intent intent = new Intent("tech.orizon.ampara.AUDIO_TRIGGER_EVENT");
        intent.setPackage(getPackageName()); // Make it explicit
        intent.putExtra("event", event);
        intent.putExtra("reason", reason);
        intent.putExtra("timestamp", System.currentTimeMillis());
        sendBroadcast(intent);
        
        Log.d(TAG, "Broadcast sent: " + event);
    }
    
    private void notifyRecordingStarted(String sessionId) {
        Intent intent = new Intent("tech.orizon.ampara.AUDIO_TRIGGER_EVENT");
        intent.setPackage(getPackageName());
        intent.putExtra("event", "nativeRecordingStarted");
        intent.putExtra("sessionId", sessionId);
        intent.putExtra("timestamp", System.currentTimeMillis());
        sendBroadcast(intent);
        
        Log.d(TAG, "Recording started broadcast sent: " + sessionId);
    }
    
    private void notifyRecordingStopped(String sessionId) {
        Intent intent = new Intent("tech.orizon.ampara.AUDIO_TRIGGER_EVENT");
        intent.setPackage(getPackageName());
        intent.putExtra("event", "nativeRecordingStopped");
        intent.putExtra("sessionId", sessionId);
        intent.putExtra("timestamp", System.currentTimeMillis());
        sendBroadcast(intent);
        
        Log.d(TAG, "Recording stopped broadcast sent: " + sessionId);
    }
    
    private void notifyRecordingProgress(String sessionId, int segmentIndex) {
        Intent intent = new Intent("tech.orizon.ampara.AUDIO_TRIGGER_EVENT");
        intent.setPackage(getPackageName());
        intent.putExtra("event", "nativeRecordingProgress");
        intent.putExtra("sessionId", sessionId);
        intent.putExtra("segmentIndex", segmentIndex);
        intent.putExtra("timestamp", System.currentTimeMillis());
        sendBroadcast(intent);
        
        Log.d(TAG, String.format("Recording progress broadcast sent: %s segment %d", sessionId, segmentIndex));
    }
    
    private void notifyUploadProgress(int pending, int success, int failure) {
        Intent intent = new Intent("tech.orizon.ampara.AUDIO_TRIGGER_EVENT");
        intent.setPackage(getPackageName());
        intent.putExtra("event", "nativeUploadProgress");
        intent.putExtra("pending", pending);
        intent.putExtra("success", success);
        intent.putExtra("failure", failure);
        intent.putExtra("timestamp", System.currentTimeMillis());
        sendBroadcast(intent);
    }
    
    private void notifyCalibrationStatus(boolean isCalibrated) {
        Intent intent = new Intent("tech.orizon.ampara.AUDIO_TRIGGER_EVENT");
        intent.setPackage(getPackageName());
        intent.putExtra("event", "calibrationStatus");
        intent.putExtra("isCalibrated", isCalibrated);
        intent.putExtra("timestamp", System.currentTimeMillis());
        sendBroadcast(intent);
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Proteção Ativa",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Ampara está monitorando áudio em segundo plano");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
    
    private Notification createNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE
        );
        
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Ampara - Proteção Ativa")
            .setContentText("Monitorando áudio em segundo plano")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
    
    private void acquireWakeLock() {
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "Ampara::AudioTriggerWakeLock"
            );
            wakeLock.acquire();
            Log.d(TAG, "WakeLock acquired");
        }
    }
    
    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            Log.d(TAG, "WakeLock released");
        }
    }
    
    @Override
    public void onDestroy() {
        Log.d(TAG, "AudioTriggerService destroyed");
        
        // Stop recording if active
        if (recorder != null) {
            recorder.destroy();
        }
        
        // Stop location tracking
        if (locationManager != null) {
            locationManager.stopTracking();
        }
        
        // Stop upload queue
        if (uploadQueue != null) {
            uploadQueue.stop();
        }
        
        stopAudioCapture();
        releaseWakeLock();
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
