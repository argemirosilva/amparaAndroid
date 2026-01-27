package tech.orizon.ampara.plugins;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

/**
 * Plugin para gerenciar otimização de bateria do Android
 */
@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {
    
    private static final String TAG = "BatteryOptimization";
    
    /**
     * Verifica se o app está na whitelist de otimização de bateria
     */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                String packageName = getContext().getPackageName();
                
                boolean isIgnoring = pm.isIgnoringBatteryOptimizations(packageName);
                
                JSObject ret = new JSObject();
                ret.put("isIgnoring", isIgnoring);
                call.resolve(ret);
            } else {
                // Versões antigas não têm Doze Mode
                JSObject ret = new JSObject();
                ret.put("isIgnoring", true);
                call.resolve(ret);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking battery optimization", e);
            call.reject("Failed to check battery optimization: " + e.getMessage());
        }
    }
    
    /**
     * Abre as configurações do sistema para o usuário desativar a otimização de bateria
     */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent();
                intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                
                getActivity().startActivity(intent);
                
                Log.d(TAG, "Opened battery optimization settings");
                call.resolve();
            } else {
                // Versões antigas não precisam
                call.resolve();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error requesting battery optimization exemption", e);
            call.reject("Failed to open battery settings: " + e.getMessage());
        }
    }
}
