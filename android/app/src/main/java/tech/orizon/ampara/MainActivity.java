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
     * Verifica qual alias está realmente habilitado no sistema
     */
    private String getRealEnabledAlias() {
        PackageManager pm = getPackageManager();
        
        for (String alias : ALL_ALIASES) {
            try {
                int state = pm.getComponentEnabledSetting(
                    new ComponentName(getApplicationContext(), alias)
                );
                
                // ENABLED = 1, DEFAULT = 0 (usa o valor do manifest), DISABLED = 2
                // Se for ENABLED ou DEFAULT (e é o padrão no manifest), está ativo
                if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                    Log.d(TAG, "Found enabled alias: " + alias + " (state: ENABLED)");
                    return alias;
                } else if (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && alias.equals(DEFAULT_ALIAS)) {
                    Log.d(TAG, "Found enabled alias: " + alias + " (state: DEFAULT, is default in manifest)");
                    return alias;
                }
            } catch (Exception e) {
                Log.e(TAG, "Error checking alias: " + alias, e);
            }
        }
        
        Log.d(TAG, "No enabled alias found, returning default");
        return DEFAULT_ALIAS;
    }

    /**
     * Interface direta para ser chamada via JavaScript: window.AndroidIconChanger.changeIcon(alias)
     */
    public class IconChangerInterface {
        
        @JavascriptInterface
        public boolean changeIcon(String targetAlias) {
            Log.d(TAG, "changeIcon called with: " + targetAlias);
            
            // Converter alias curto para nome completo se necessário
            String fullTargetAlias = targetAlias.startsWith("tech.orizon.ampara.") 
                ? targetAlias 
                : "tech.orizon.ampara." + targetAlias.replace(".", "");
            
            // Verificar qual alias está REALMENTE habilitado (não confiar no SharedPreferences)
            String currentAlias = getRealEnabledAlias();
            
            Log.d(TAG, "Real current: " + currentAlias + " -> Target: " + fullTargetAlias);
            
            // Se já é o mesmo, não fazer nada
            if (currentAlias.equals(fullTargetAlias)) {
                Log.d(TAG, "Already using this icon, skipping");
                return true;
            }
            
            try {
                PackageManager pm = getPackageManager();
                
                // 1. Desabilitar TODOS os outros aliases primeiro
                for (String alias : ALL_ALIASES) {
                    if (!alias.equals(fullTargetAlias)) {
                        int stateToSet = alias.equals(DEFAULT_ALIAS) 
                            ? PackageManager.COMPONENT_ENABLED_STATE_DEFAULT
                            : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
                        
                        pm.setComponentEnabledSetting(
                            new ComponentName(getApplicationContext(), alias),
                            stateToSet,
                            PackageManager.DONT_KILL_APP
                        );
                        Log.d(TAG, "Disabled: " + alias + " (state: " + stateToSet + ")");
                    }
                }
                
                // 2. Habilitar o novo alias
                pm.setComponentEnabledSetting(
                    new ComponentName(getApplicationContext(), fullTargetAlias),
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
                );
                Log.d(TAG, "Enabled: " + fullTargetAlias);
                
                // 3. Salvar a preferência
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                prefs.edit().putString(PREF_CURRENT_ALIAS, fullTargetAlias).apply();
                
                // 4. Verificar se realmente mudou
                String newCurrent = getRealEnabledAlias();
                Log.d(TAG, "After change, real enabled alias is: " + newCurrent);
                
                if (newCurrent.equals(fullTargetAlias)) {
                    Log.d(TAG, "Icon changed successfully!");
                    return true;
                } else {
                    Log.e(TAG, "Icon change failed! Expected " + fullTargetAlias + " but got " + newCurrent);
                    return false;
                }
                
            } catch (Exception e) {
                Log.e(TAG, "Error changing icon", e);
                return false;
            }
        }

        @JavascriptInterface
        public String getCurrentIcon() {
            // Usar o estado real do sistema, não o SharedPreferences
            String currentAlias = getRealEnabledAlias();
            
            // Retornar apenas a parte final do nome (ex: MainActivityWorkout)
            if (currentAlias.contains(".")) {
                return currentAlias.substring(currentAlias.lastIndexOf(".") + 1);
            }
            return currentAlias;
        }
    }
}
