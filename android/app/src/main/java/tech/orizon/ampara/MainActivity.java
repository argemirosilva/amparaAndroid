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

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "IconChanger";
    private static final String PREFS_NAME = "IconChangerPrefs";
    private static final String PREF_CURRENT_ALIAS = "currentAlias";
    
    // Lista de todos os aliases disponíveis (nomes completos)
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
    
    // Alias padrão
    private static final String DEFAULT_ALIAS = "tech.orizon.ampara.MainActivityAmpara";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(SecureStoragePlugin.class);
        
        // Injetar a interface JavaScript diretamente na WebView do Capacitor
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new IconChangerInterface(), "AndroidIconChanger");
        }
    }

    /**
     * Interface direta para ser chamada via JavaScript: window.AndroidIconChanger.changeIcon(alias)
     */
    public class IconChangerInterface {
        
        @JavascriptInterface
        public boolean changeIcon(String targetAlias) {
            Log.d(TAG, "changeIcon called with: " + targetAlias);
            
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String currentAlias = prefs.getString(PREF_CURRENT_ALIAS, DEFAULT_ALIAS);
            
            // Converter alias curto para nome completo se necessário
            String fullTargetAlias = targetAlias.startsWith("tech.orizon.ampara.") 
                ? targetAlias 
                : "tech.orizon.ampara." + targetAlias.replace(".", "");
            
            Log.d(TAG, "Current: " + currentAlias + " -> Target: " + fullTargetAlias);
            
            // Se já é o mesmo, não fazer nada
            if (currentAlias.equals(fullTargetAlias)) {
                Log.d(TAG, "Already using this icon, skipping");
                return true;
            }
            
            try {
                PackageManager pm = getPackageManager();
                
                // 1. Desabilitar o alias atual (usar DEFAULT para resetar ao estado do manifest)
                pm.setComponentEnabledSetting(
                    new ComponentName(getApplicationContext(), currentAlias),
                    PackageManager.COMPONENT_ENABLED_STATE_DEFAULT,
                    PackageManager.DONT_KILL_APP
                );
                Log.d(TAG, "Disabled: " + currentAlias);
                
                // 2. Habilitar o novo alias
                pm.setComponentEnabledSetting(
                    new ComponentName(getApplicationContext(), fullTargetAlias),
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
                );
                Log.d(TAG, "Enabled: " + fullTargetAlias);
                
                // 3. Salvar a preferência
                prefs.edit().putString(PREF_CURRENT_ALIAS, fullTargetAlias).apply();
                
                Log.d(TAG, "Icon changed successfully!");
                return true;
                
            } catch (Exception e) {
                Log.e(TAG, "Error changing icon", e);
                return false;
            }
        }

        @JavascriptInterface
        public String getCurrentIcon() {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String currentAlias = prefs.getString(PREF_CURRENT_ALIAS, DEFAULT_ALIAS);
            
            // Retornar apenas a parte final do nome (ex: MainActivityWorkout)
            if (currentAlias.contains(".")) {
                return currentAlias.substring(currentAlias.lastIndexOf(".") + 1);
            }
            return currentAlias;
        }
    }
}
