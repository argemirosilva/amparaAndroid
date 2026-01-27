package tech.orizon.ampara;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import tech.orizon.ampara.plugins.SecureStoragePlugin;

public class MainActivity extends BridgeActivity {
    
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
        private static final String MAIN_ACTIVITY = ".MainActivity";
        private static final String[] ICON_ALIASES = {
            ".MainActivityAmpara", ".MainActivityWorkout", ".MainActivitySteps", 
            ".MainActivityYoga", ".MainActivityCycle", ".MainActivityBeauty", 
            ".MainActivityFashion", ".MainActivityPuzzle", ".MainActivityCards", 
            ".MainActivityCasual"
        };

        @JavascriptInterface
        public boolean changeIcon(String targetAlias) {
            try {
                PackageManager packageManager = getPackageManager();
                String packageName = getPackageName();

                // 1. Gerenciar MainActivity principal
                int mainState = targetAlias.equals(".MainActivityAmpara") 
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED 
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
                
                packageManager.setComponentEnabledSetting(
                    new ComponentName(packageName, packageName + MAIN_ACTIVITY),
                    mainState,
                    PackageManager.DONT_KILL_APP
                );

                // 2. Gerenciar Aliases
                for (String alias : ICON_ALIASES) {
                    int state = alias.equals(targetAlias) 
                        ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                        : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
                    
                    packageManager.setComponentEnabledSetting(
                        new ComponentName(packageName, packageName + alias),
                        state,
                        PackageManager.DONT_KILL_APP
                    );
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String getCurrentIcon() {
            try {
                PackageManager packageManager = getPackageManager();
                String packageName = getPackageName();

                int mainState = packageManager.getComponentEnabledSetting(new ComponentName(packageName, packageName + MAIN_ACTIVITY));
                if (mainState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED || mainState == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT) {
                    return ".MainActivityAmpara";
                } else {
                    for (String alias : ICON_ALIASES) {
                        int state = packageManager.getComponentEnabledSetting(new ComponentName(packageName, packageName + alias));
                        if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                            return alias;
                        }
                    }
                }
            } catch (Exception e) {}
            return ".MainActivityAmpara";
        }
    }
}
