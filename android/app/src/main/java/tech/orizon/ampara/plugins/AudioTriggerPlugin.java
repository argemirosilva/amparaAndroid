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
    
    @Override
    public void load() {
        super.load();
        
        // Register broadcast receiver for events from native service
        eventReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String event = intent.getStringExtra("event");
                String reason = intent.getStringExtra("reason");
                long timestamp = intent.getLongExtra("timestamp", 0);
                
                Log.d(TAG, "Received event from native: " + event);
                
                // Notify JavaScript
                JSObject ret = new JSObject();
                ret.put("event", event);
                ret.put("reason", reason);
                ret.put("timestamp", timestamp);
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
            Intent intent = new Intent(getContext(), AudioTriggerService.class);
            
            // Pass configuration if provided
            JSObject config = call.getObject("config");
            if (config != null) {
                intent.putExtra("config", config.toString());
                Log.d(TAG, "Starting AudioTrigger service with config: " + config.toString());
            }
            
            getContext().startService(intent);
            
            Log.d(TAG, "AudioTrigger service started");
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error starting AudioTrigger service", e);
            call.reject("Failed to start AudioTrigger service: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), AudioTriggerService.class);
            getContext().stopService(intent);
            
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
        // TODO: Implement service status check
        JSObject ret = new JSObject();
        ret.put("isRunning", false);
        call.resolve(ret);
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
