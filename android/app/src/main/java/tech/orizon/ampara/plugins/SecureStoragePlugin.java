package tech.orizon.ampara.plugins;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SecureStorage")
public class SecureStoragePlugin extends Plugin {
    
    private static final String PREFS_NAME = "AmparaSecureStorage";
    
    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }
    
    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        
        if (key == null || value == null) {
            call.reject("Key and value are required");
            return;
        }
        
        SharedPreferences.Editor editor = getPrefs().edit();
        editor.putString(key, value);
        editor.apply();
        
        call.resolve();
    }
    
    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key");
        
        if (key == null) {
            call.reject("Key is required");
            return;
        }
        
        String value = getPrefs().getString(key, null);
        
        JSObject ret = new JSObject();
        ret.put("value", value);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key");
        
        if (key == null) {
            call.reject("Key is required");
            return;
        }
        
        SharedPreferences.Editor editor = getPrefs().edit();
        editor.remove(key);
        editor.apply();
        
        call.resolve();
    }
    
    @PluginMethod
    public void clear(PluginCall call) {
        SharedPreferences.Editor editor = getPrefs().edit();
        editor.clear();
        editor.apply();
        
        call.resolve();
    }
}
