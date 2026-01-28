package tech.orizon.ampara;

import android.content.ComponentName;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import tech.orizon.ampara.plugins.SecureStoragePlugin;
import tech.orizon.ampara.plugins.KeepAlivePlugin;
import tech.orizon.ampara.plugins.BatteryOptimizationPlugin;
import tech.orizon.ampara.plugins.SessionExpiredListenerPlugin;
import tech.orizon.ampara.plugins.DeviceInfoExtendedPlugin;
import tech.orizon.ampara.plugins.AudioTriggerPlugin;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "IconChanger";
    private static final String PREFS_NAME = "IconChangerPrefs";
    private static final String PREF_CURRENT_ALIAS = "currentAlias";
    
    private static final String[] ALL_ALIASES = {
        "tech.orizon.ampara.MainActivityAmpara",
        "tech.orizon.ampara.MainActivityWorkout",
        "tech.orizon.ampara.MainActivitySteps",
        "tech.orizon.ampara.MainActivityYoga",
        "tech.orizon.ampara.MainActivityCycle",
        "tech.orizon.ampara.MainActivityBeauty",
        "tech.orizon.ampara.MainActivityFashion",
        "tech.orizon.ampara.MainActivityPuzzle",
        "tech.orizon.ampara.MainActivityCards",
        "tech.orizon.ampara.MainActivityCasual"
    };
    
    private static final String DEFAULT_ALIAS = "tech.orizon.ampara.MainActivityAmpara";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        Log.d("AmparaPlugins", "========== REGISTERING CUSTOM PLUGINS ==========");
        
        try {
            registerPlugin(SecureStoragePlugin.class);
            Log.d("AmparaPlugins", "✅ SecureStoragePlugin registered");
        } catch (Exception e) {
            Log.e("AmparaPlugins", "❌ Failed to register SecureStoragePlugin", e);
        }
        
        try {
            registerPlugin(KeepAlivePlugin.class);
            Log.d("AmparaPlugins", "✅ KeepAlivePlugin registered");
        } catch (Exception e) {
            Log.e("AmparaPlugins", "❌ Failed to register KeepAlivePlugin", e);
        }
        
        try {
            registerPlugin(BatteryOptimizationPlugin.class);
            Log.d("AmparaPlugins", "✅ BatteryOptimizationPlugin registered");
        } catch (Exception e) {
            Log.e("AmparaPlugins", "❌ Failed to register BatteryOptimizationPlugin", e);
        }
        
        try {
            registerPlugin(SessionExpiredListenerPlugin.class);
            Log.d("AmparaPlugins", "✅ SessionExpiredListenerPlugin registered");
        } catch (Exception e) {
            Log.e("AmparaPlugins", "❌ Failed to register SessionExpiredListenerPlugin", e);
        }
        
        try {
            registerPlugin(DeviceInfoExtendedPlugin.class);
            Log.d("AmparaPlugins", "✅ DeviceInfoExtendedPlugin registered");
        } catch (Exception e) {
            Log.e("AmparaPlugins", "❌ Failed to register DeviceInfoExtendedPlugin", e);
        }
        
        try {
            registerPlugin(AudioTriggerPlugin.class);
            Log.d("AmparaPlugins", "✅ AudioTriggerPlugin registered");
        } catch (Exception e) {
            Log.e("AmparaPlugins", "❌ Failed to register AudioTriggerPlugin", e);
        }
        
        Log.d("AmparaPlugins", "========== CUSTOM PLUGINS REGISTRATION COMPLETE ==========");
        
        super.onCreate(savedInstanceState);
        
        // No Android 14+, evitamos mexer nos aliases durante o onCreate para evitar crash de Secure Settings
        // Apenas garantimos que a interface JS seja injetada
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new IconChangerInterface(), "AndroidIconChanger");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error injecting JS interface", e);
        }
    }
    
    private String getRealEnabledAlias() {
        try {
            PackageManager pm = getPackageManager();
            for (String alias : ALL_ALIASES) {
                int state = pm.getComponentEnabledSetting(new ComponentName(getApplicationContext(), alias));
                if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                    return alias;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking real enabled alias", e);
        }
        return DEFAULT_ALIAS;
    }

    public class IconChangerInterface {
        
        @JavascriptInterface
        public boolean changeIcon(String targetAlias) {
            Log.d(TAG, "changeIcon called with: " + targetAlias);
            
            String fullTargetAlias = targetAlias.startsWith("tech.orizon.ampara.") 
                ? targetAlias 
                : "tech.orizon.ampara." + targetAlias.replace(".", "");
            
            try {
                PackageManager pm = getPackageManager();
                
                // Desabilitar outros e habilitar o novo em um bloco try-catch robusto
                for (String alias : ALL_ALIASES) {
                    int newState = alias.equals(fullTargetAlias) 
                        ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED 
                        : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
                    
                    try {
                        pm.setComponentEnabledSetting(
                            new ComponentName(getApplicationContext(), alias),
                            newState,
                            PackageManager.DONT_KILL_APP
                        );
                    } catch (Exception e) {
                        Log.w(TAG, "Could not set state for " + alias + ": " + e.getMessage());
                    }
                }
                
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                prefs.edit().putString(PREF_CURRENT_ALIAS, fullTargetAlias).apply();
                return true;
                
            } catch (Exception e) {
                Log.e(TAG, "Fatal error changing icon", e);
                return false;
            }
        }

        @JavascriptInterface
        public String getCurrentIcon() {
            return getRealEnabledAlias();
        }
    }
}
