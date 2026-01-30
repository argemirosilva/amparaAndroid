package tech.orizon.ampara.audio

/**
 * Default configuration for Audio Trigger Detection
 * 
 * REGRA MESTRE: Estes valores são a ÚNICA fonte de thresholds.
 * NUNCA usar audio_trigger_config da API.
 * API só controla: monitoringEnabled + monitoringPeriods.
 */
object AudioTriggerDefaults {
    
    /**
     * Get default AudioTriggerConfig with fixed thresholds
     * These values are hardcoded and NEVER change based on API response
     */
    fun getDefaultConfig(): AudioTriggerConfig {
        return AudioTriggerConfig().apply {
            // Audio capture settings
            sampleRate = 16000
            frameMs = 25
            aggregationMs = 1000
            
            // Detection thresholds (FIXED - never from API)
            loudDeltaDb = 18.0
            vadDeltaDb = 7.0
            speechDensityMin = 0.65
            loudDensityMin = 0.4
            
            // Timing windows
            discussionWindowSeconds = 10
            preTriggerSeconds = 3
            startHoldSeconds = 7
            endHoldSeconds = 30
            cooldownSeconds = 45
            
            // Noise floor learning
            noiseFloorLearningRate = 0.029
            
            // Turn-taking detection
            turnTakingMin = 7
            
            // End detection
            speechDensityEnd = 0.2
            loudDensityEnd = 0.09
            silenceDecaySeconds = 6
            silenceDecayRate = 0.5
            
            // ZCR thresholds for voice detection
            zcrMinVoice = 0.02
            zcrMaxVoice = 0.35
        }
    }
    
    /**
     * Log current configuration source
     */
    fun logConfigSource(tag: String) {
        android.util.Log.i(tag, "[AudioTriggerDefaults] Thresholds source = LOCAL DEFAULTS (hardcoded)")
        android.util.Log.i(tag, "[AudioTriggerDefaults] vadDeltaDb=${getDefaultConfig().vadDeltaDb}, loudDeltaDb=${getDefaultConfig().loudDeltaDb}")
        android.util.Log.i(tag, "[AudioTriggerDefaults] speechDensityMin=${getDefaultConfig().speechDensityMin}, loudDensityMin=${getDefaultConfig().loudDensityMin}")
    }
}
