package tech.orizon.ampara.audio;

import android.util.Log;
import java.util.LinkedList;
import java.util.Queue;

/**
 * Detects discussions/arguments based on audio characteristics
 */
public class DiscussionDetector {
    private static final String TAG = "DiscussionDetector";
    
    private final AudioTriggerConfig config;
    private final Queue<AggregationMetrics> window;
    private double noiseFloor = -50.0;
    
    private enum State {
        IDLE,
        DISCUSSION_DETECTED,
        RECORDING_STARTED,
        COOLDOWN
    }
    
    private State state = State.IDLE;
    private long stateStartTime = 0;
    
    public static class AggregationMetrics {
        public double rmsDb;
        public double zcr;
        public boolean isSpeech;
        public boolean isLoud;
        public long timestamp;
        
        public AggregationMetrics(double rmsDb, double zcr, boolean isSpeech, boolean isLoud) {
            this.rmsDb = rmsDb;
            this.zcr = zcr;
            this.isSpeech = isSpeech;
            this.isLoud = isLoud;
            this.timestamp = System.currentTimeMillis();
        }
    }
    
    public static class DetectionResult {
        public boolean shouldStartRecording = false;
        public boolean shouldStopRecording = false;
        public String reason = "";
        public double speechDensity = 0.0;
        public double loudDensity = 0.0;
    }
    
    public DiscussionDetector(AudioTriggerConfig config) {
        this.config = config;
        this.window = new LinkedList<>();
    }
    
    /**
     * Process aggregated metrics and detect discussion
     */
    public DetectionResult process(AggregationMetrics metrics) {
        DetectionResult result = new DetectionResult();
        
        // Update noise floor
        if (!metrics.isSpeech && !metrics.isLoud) {
            noiseFloor = AudioDSP.updateNoiseFloor(noiseFloor, metrics.rmsDb, config.noiseFloorLearningRate);
        }
        
        // Add to window
        window.add(metrics);
        
        // Keep window size
        int maxWindowSize = config.getDiscussionWindowAggregations();
        while (window.size() > maxWindowSize) {
            window.poll();
        }
        
        // Calculate densities
        double speechDensity = calculateSpeechDensity();
        double loudDensity = calculateLoudDensity();
        
        result.speechDensity = speechDensity;
        result.loudDensity = loudDensity;
        
        long now = System.currentTimeMillis();
        long timeInState = now - stateStartTime;
        
        // State machine
        switch (state) {
            case IDLE:
                // Check if discussion started
                if (speechDensity >= config.speechDensityMin && 
                    loudDensity >= config.loudDensityMin) {
                    Log.d(TAG, String.format("Discussion detected! Speech: %.2f, Loud: %.2f", 
                        speechDensity, loudDensity));
                    state = State.DISCUSSION_DETECTED;
                    stateStartTime = now;
                }
                break;
                
            case DISCUSSION_DETECTED:
                // Wait for start hold period
                if (timeInState >= config.startHoldSeconds * 1000) {
                    // Still discussing after hold period - start recording
                    if (speechDensity >= config.speechDensityMin && 
                        loudDensity >= config.loudDensityMin) {
                        Log.d(TAG, "Discussion confirmed after hold period - starting recording");
                        result.shouldStartRecording = true;
                        result.reason = "discussion_confirmed";
                        state = State.RECORDING_STARTED;
                        stateStartTime = now;
                    } else {
                        // False alarm - back to idle
                        Log.d(TAG, "Discussion ended before hold period - false alarm");
                        state = State.IDLE;
                        stateStartTime = now;
                    }
                } else {
                    // Check if discussion ended prematurely
                    if (speechDensity < config.speechDensityEnd && 
                        loudDensity < config.loudDensityEnd) {
                        Log.d(TAG, "Discussion ended during hold period");
                        state = State.IDLE;
                        stateStartTime = now;
                    }
                }
                break;
                
            case RECORDING_STARTED:
                // Check if discussion ended
                if (speechDensity < config.speechDensityEnd && 
                    loudDensity < config.loudDensityEnd) {
                    // Wait for end hold period
                    if (timeInState >= config.endHoldSeconds * 1000) {
                        Log.d(TAG, "Discussion ended - stopping recording");
                        result.shouldStopRecording = true;
                        result.reason = "discussion_ended";
                        state = State.COOLDOWN;
                        stateStartTime = now;
                    }
                } else {
                    // Discussion still ongoing - reset timer
                    stateStartTime = now;
                }
                break;
                
            case COOLDOWN:
                // Wait for cooldown period
                if (timeInState >= config.cooldownSeconds * 1000) {
                    Log.d(TAG, "Cooldown period ended - ready for new detection");
                    state = State.IDLE;
                    stateStartTime = now;
                }
                break;
        }
        
        return result;
    }
    
    private double calculateSpeechDensity() {
        if (window.isEmpty()) return 0.0;
        
        int speechCount = 0;
        for (AggregationMetrics m : window) {
            if (m.isSpeech) speechCount++;
        }
        
        return (double) speechCount / window.size();
    }
    
    private double calculateLoudDensity() {
        if (window.isEmpty()) return 0.0;
        
        int loudCount = 0;
        for (AggregationMetrics m : window) {
            if (m.isLoud) loudCount++;
        }
        
        return (double) loudCount / window.size();
    }
    
    public void reset() {
        window.clear();
        state = State.IDLE;
        stateStartTime = System.currentTimeMillis();
        noiseFloor = -50.0;
    }
    
    public State getState() {
        return state;
    }
    
    public double getNoiseFloor() {
        return noiseFloor;
    }
}
