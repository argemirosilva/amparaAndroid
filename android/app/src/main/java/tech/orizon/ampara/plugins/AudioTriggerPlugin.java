package tech.orizon.ampara.plugins;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import tech.orizon.ampara.AudioTriggerService;

/**
 * Capacitor plugin to control native AudioTrigger service
 */
@CapacitorPlugin(name = "AudioTriggerNative")
public class AudioTriggerPlugin extends Plugin {
    private static final String TAG = "AudioTriggerPlugin";
    
    private BroadcastReceiver eventReceiver;
    private static boolean serviceRunning = false;
    
    @Override
    public void load() {
        super.load();
        
        // Register broadcast receiver for events from native service
        eventReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String event = intent.getStringExtra("event");
                
                Log.d(TAG, "Received event from native: " + event);
                
                // Notify JavaScript
                JSObject ret = new JSObject();
                ret.put("event", event);
                ret.put("timestamp", intent.getLongExtra("timestamp", 0));
                
                // Add event-specific fields
                if (intent.hasExtra("reason")) {
                    ret.put("reason", intent.getStringExtra("reason"));
                }
                if (intent.hasExtra("sessionId")) {
                    ret.put("sessionId", intent.getStringExtra("sessionId"));
                }
                if (intent.hasExtra("segmentIndex")) {
                    ret.put("segmentIndex", intent.getIntExtra("segmentIndex", 0));
                }
                if (intent.hasExtra("pending")) {
                    ret.put("pending", intent.getIntExtra("pending", 0));
                }
                if (intent.hasExtra("success")) {
                    ret.put("success", intent.getIntExtra("success", 0));
                }
                if (intent.hasExtra("failure")) {
                    ret.put("failure", intent.getIntExtra("failure", 0));
                }
                if (intent.hasExtra("isCalibrated")) {
                    ret.put("isCalibrated", intent.getBooleanExtra("isCalibrated", false));
                }
                if (intent.hasExtra("status")) {
                    ret.put("status", intent.getStringExtra("status"));
                }
                if (intent.hasExtra("noiseFloorDb")) {
                    ret.put("noiseFloorDb", intent.getDoubleExtra("noiseFloorDb", 0.0));
                }
                // Audio metrics fields
                if (intent.hasExtra("rmsDb")) {
                    ret.put("rmsDb", intent.getDoubleExtra("rmsDb", 0.0));
                }
                if (intent.hasExtra("zcr")) {
                    ret.put("zcr", intent.getDoubleExtra("zcr", 0.0));
                }
                if (intent.hasExtra("isSpeech")) {
                    ret.put("isSpeech", intent.getBooleanExtra("isSpeech", false));
                }
                if (intent.hasExtra("isLoud")) {
                    ret.put("isLoud", intent.getBooleanExtra("isLoud", false));
                }
                if (intent.hasExtra("state")) {
                    ret.put("state", intent.getStringExtra("state"));
                }
                if (intent.hasExtra("score")) {
                    ret.put("score", intent.getDoubleExtra("score", 0.0));
                }
                
                notifyListeners("audioTriggerEvent", ret);
            }
        };
        
        IntentFilter filter = new IntentFilter("tech.orizon.ampara.AUDIO_TRIGGER_EVENT");
        getContext().registerReceiver(eventReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        
        Log.d(TAG, "AudioTriggerPlugin loaded and receiver registered");
    }
    
    @PluginMethod
    public void start(PluginCall call) {
        try {
            // IDEMPOTENT: If service already running, just return success
            if (serviceRunning) {
                Log.d(TAG, "AudioTrigger service already running, skipping start (idempotent)");
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("alreadyRunning", true);
                call.resolve(ret);
                return;
            }
            
            Intent intent = new Intent(getContext(), AudioTriggerService.class);
            
            // Pass configuration if provided
            JSObject config = call.getObject("config");
            if (config != null) {
                intent.putExtra("config", config.toString());
                Log.d(TAG, "Starting AudioTrigger service with config: " + config.toString());
            }
            
            // Use startForegroundService on Android 8+ to ensure service runs in background
            // IMPORTANT: This must be called while app is in FOREGROUND (eligible state)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                Log.i(TAG, "NATIVE_START_REQUEST: Starting foreground service (Android 8+)");
                getContext().startForegroundService(intent);
                Log.i(TAG, "NATIVE_START_SENT: startForegroundService called");
            } else {
                getContext().startService(intent);
                Log.d(TAG, "AudioTrigger service started");
            }
            
            serviceRunning = true;
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("alreadyRunning", false);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "NATIVE_START_ERROR: " + e.getMessage(), e);
            call.reject("Failed to start AudioTrigger service: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void updateConfig(PluginCall call) {
        try {
            JSObject config = call.getObject("config");
            if (config == null) {
                call.reject("Config is required");
                return;
            }
            
            Intent intent = new Intent(getContext(), AudioTriggerService.class);
            intent.setAction("UPDATE_CONFIG");
            intent.putExtra("config", config.toString());
            
            getContext().startService(intent);
            
            Log.d(TAG, "AudioTrigger config updated: " + config.toString());
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error updating AudioTrigger config", e);
            call.reject("Failed to update config: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), AudioTriggerService.class);
            getContext().stopService(intent);
            
            serviceRunning = false;
            Log.d(TAG, "AudioTrigger service stopped");
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error stopping AudioTrigger service", e);
            call.reject("Failed to stop AudioTrigger service: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isRunning", serviceRunning);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void startRecording(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), AudioTriggerService.class);
            intent.setAction("START_RECORDING");
            
            // Pass credentials and origem from call
            String sessionToken = call.getString("sessionToken");
            String emailUsuario = call.getString("emailUsuario");
            String origemGravacao = call.getString("origemGravacao", "manual");
            
            if (sessionToken != null && emailUsuario != null) {
                intent.putExtra("sessionToken", sessionToken);
                intent.putExtra("emailUsuario", emailUsuario);
                intent.putExtra("origemGravacao", origemGravacao);
                
                Log.d(TAG, "Start recording with credentials: " + emailUsuario + ", origem: " + origemGravacao);
            } else {
                Log.w(TAG, "Start recording without credentials");
            }
            
            getContext().startService(intent);
            
            Log.d(TAG, "Start recording command sent");
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error sending start recording command", e);
            call.reject("Failed to start recording: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void stopRecording(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), AudioTriggerService.class);
            intent.setAction("STOP_RECORDING");
            getContext().startService(intent);
            
            Log.d(TAG, "Stop recording command sent");
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error sending stop recording command", e);
            call.reject("Failed to stop recording: " + e.getMessage());
        }
    }
    
    @Override
    protected void handleOnDestroy() {
        if (eventReceiver != null) {
            try {
                getContext().unregisterReceiver(eventReceiver);
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering receiver", e);
            }
        }
        super.handleOnDestroy();
    }
}
