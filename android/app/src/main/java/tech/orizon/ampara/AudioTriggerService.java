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
import tech.orizon.ampara.audio.AudioTriggerDefaults;
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
    
    // Microphone state machine for mutual exclusion
    private enum MicrophoneState {
        IDLE,           // Service not started
        MONITORING,     // AudioRecord active (detection)
        RECORDING       // MediaRecorder active (recording)
    }
    
    private MicrophoneState currentMicState = MicrophoneState.IDLE;
    
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
    private long lastDiagnosticLog = 0;
    
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
        
        // Prepare notification channel (but don't start foreground yet)
        createNotificationChannel();
        
        acquireWakeLock();
        
        // Use fixed local defaults (NEVER from API)
        config = AudioTriggerDefaults.getDefaultConfig();
        AudioTriggerDefaults.logConfigSource(TAG);
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
        Log.d(TAG, "AudioTriggerService onStartCommand");
        Log.i(TAG, "FGS_MICROPHONE_START_REQUEST");
        
        // Start as Foreground Service IMMEDIATELY on first command
        // This ensures we're in "eligible state" (app recently interacted)
        // CRITICAL: Must call startForeground() within 5 seconds of service start
        try {
            Notification notification = createNotification();
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ requires foregroundServiceType
                // Android 14/15 requires app to be in eligible state
                startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            
            Log.i(TAG, "FGS_MICROPHONE_STARTED_OK");
            Log.d(TAG, "[MicState] Foreground Service started with microphone type");
        } catch (SecurityException se) {
            // Android 14/15: App not in eligible state to start microphone FGS
            Log.e(TAG, "FGS_MICROPHONE_SECURITY_EXCEPTION: " + se.getMessage());
            Log.e(TAG, "FGS_MIC_NOT_ELIGIBLE: App must be in foreground to start microphone service");
            
            // Notify JavaScript about the failure
            notifyFgsNotEligible();
            
            // Stop gracefully without crashing
            stopSelf();
            return START_NOT_STICKY;
        } catch (Exception e) {
            Log.e(TAG, "FGS_MICROPHONE_START_FAILED: " + e.getMessage(), e);
            // If we can't start foreground, stop the service
            stopSelf();
            return START_NOT_STICKY;
        }
        
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
                
                // Pause monitoring to release microphone (only if already monitoring)
                if (currentMicState == MicrophoneState.MONITORING) {
                    pauseMonitoring();
                }
                currentMicState = MicrophoneState.RECORDING;
                
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
                
                // Resume monitoring after recording stops
                resumeMonitoring();
                
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
        // REGRA MESTRE: IGNORAR audio_trigger_config da API
        // Thresholds são SEMPRE os defaults locais (AudioTriggerDefaults)
        Log.w(TAG, "[AudioTriggerService] Remote audio_trigger_config received -> IGNORED BY DESIGN");
        Log.i(TAG, "[AudioTriggerService] Thresholds source = LOCAL DEFAULTS (AudioTriggerDefaults)");
        
        // API pode enviar apenas monitoringEnabled + monitoringPeriods (não implementado aqui)
        // Thresholds NÃO mudam
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
            currentMicState = MicrophoneState.MONITORING;
            
            processingThread = new Thread(this::processAudioLoop);
            processingThread.start();
            
            Log.i(TAG, "[MicState] IDLE -> MONITORING: AudioRecord started");
            
        } catch (SecurityException e) {
            Log.e(TAG, "Microphone permission not granted", e);
        } catch (Exception e) {
            Log.e(TAG, "Error starting audio capture", e);
        }
    }
    
    private void processAudioLoop() {
        Log.d(TAG, "Audio processing loop started");
        Log.i(TAG, String.format("[CONFIG] ZCR range: %.2f-%.2f, VAD delta: %.1f dB, Loud delta: %.1f dB",
            config.zcrMinVoice, config.zcrMaxVoice, config.vadDeltaDb, config.loudDeltaDb));
        
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
        boolean isSpeech = AudioDSP.isSpeechLike(rmsDb, zcr, config, noiseFloor);
        
        // Diagnostic: log when RMS is high but speech is not detected
        if (rmsDb > -55 && !isSpeech && System.currentTimeMillis() - lastDiagnosticLog > 3000) {
            double vadThreshold = noiseFloor + config.vadDeltaDb;
            boolean hasEnergy = rmsDb > vadThreshold;
            boolean hasVoiceZCR = zcr >= config.zcrMinVoice && zcr <= config.zcrMaxVoice;
            String reason = !hasEnergy ? String.format("RMS too low (%.1f < %.1f)", rmsDb, vadThreshold) : 
                           !hasVoiceZCR ? "ZCR out of range" : "unknown";
            Log.w(TAG, String.format("[DIAGNOSTIC] Speech=false: RMS=%.1f dB (threshold=%.1f), ZCR=%.3f (range: %.2f-%.2f), NoiseFloor=%.1f, Reason: %s",
                rmsDb, vadThreshold, zcr, config.zcrMinVoice, config.zcrMaxVoice, noiseFloor, reason));
            lastDiagnosticLog = System.currentTimeMillis();
        }
        
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
        
        // Send metrics to JS for UI updates (every aggregation = ~1s)
        // Calculate discussion score normalized to thresholds (0.5 speech, 0.3 loud)
        // Score reaches 1.0 when both thresholds are met
        double speechNorm = Math.min(result.speechDensity / 0.5, 1.0);
        double loudNorm = Math.min(result.loudDensity / 0.3, 1.0);
        double discussionScore = (speechNorm + loudNorm) / 2.0;
        notifyMetrics(avgRmsDb, avgZcr, isSpeech, isLoud, detector.getStateString(), discussionScore);
        
        // Log detection
        if (result.shouldStartRecording) {
            Log.i(TAG, String.format("DISCUSSION DETECTED! Reason: %s, Speech: %.2f, Loud: %.2f",
                result.reason, result.speechDensity, result.loudDensity));
            
            // Pause monitoring to release microphone (only if already monitoring)
            if (currentMicState == MicrophoneState.MONITORING) {
                pauseMonitoring();
            }
            currentMicState = MicrophoneState.RECORDING;
            
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
                
                // Resume monitoring after recording stops
                resumeMonitoring();
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
            
            // Resume monitoring after recording stops
            resumeMonitoring();
            
            notifyJavaScript("discussionEnded", result.reason);
        }
    }
    
    private void notifyMetrics(double rmsDb, double zcr, boolean isSpeech, boolean isLoud, String state, double score) {
        Intent intent = new Intent("tech.orizon.ampara.AUDIO_TRIGGER_EVENT");
        intent.setPackage(getPackageName());
        intent.putExtra("event", "audioMetrics");
        intent.putExtra("rmsDb", rmsDb);
        intent.putExtra("zcr", zcr);
        intent.putExtra("isSpeech", isSpeech);
        intent.putExtra("isLoud", isLoud);
        intent.putExtra("state", state);
        intent.putExtra("score", score);
        intent.putExtra("timestamp", System.currentTimeMillis());
        sendBroadcast(intent);
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
    
    private void notifyFgsNotEligible() {
        Intent intent = new Intent("tech.orizon.ampara.AUDIO_TRIGGER_EVENT");
        intent.setPackage(getPackageName());
        intent.putExtra("event", "fgsNotEligible");
        intent.putExtra("reason", "App must be in foreground to start microphone service on Android 14+");
        intent.putExtra("timestamp", System.currentTimeMillis());
        sendBroadcast(intent);
        
        Log.d(TAG, "FGS not eligible broadcast sent");
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
        currentMicState = MicrophoneState.IDLE;
    }
    
    /**
     * Pause monitoring (stop AudioRecord) to allow MediaRecorder to access microphone
     * Transition: MONITORING -> (paused)
     */
    private void pauseMonitoring() {
        if (currentMicState != MicrophoneState.MONITORING) {
            Log.w(TAG, "[MicState] Cannot pause monitoring, current state: " + currentMicState);
            return;
        }
        
        Log.i(TAG, "[MicState] MONITORING -> (paused): Stopping AudioRecord for recording");
        
        isRunning = false;
        
        if (audioRecord != null) {
            try {
                if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    audioRecord.stop();
                }
                audioRecord.release();
                audioRecord = null;
                Log.d(TAG, "[MicState] AudioRecord stopped and released");
            } catch (Exception e) {
                Log.e(TAG, "[MicState] Error stopping AudioRecord", e);
            }
        }
        
        if (processingThread != null) {
            try {
                processingThread.join(1000);
            } catch (InterruptedException e) {
                Log.e(TAG, "[MicState] Error joining processing thread", e);
            }
            processingThread = null;
        }
    }
    
    /**
     * Resume monitoring (restart AudioRecord) after MediaRecorder finishes
     * Transition: (paused) -> MONITORING
     */
    private void resumeMonitoring() {
        if (currentMicState == MicrophoneState.MONITORING) {
            Log.w(TAG, "[MicState] Already in MONITORING state");
            return;
        }
        
        Log.i(TAG, "[MicState] (paused) -> MONITORING: Restarting AudioRecord after recording");
        startAudioCapture();
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
