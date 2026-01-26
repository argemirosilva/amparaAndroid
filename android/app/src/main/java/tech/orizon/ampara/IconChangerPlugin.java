package tech.orizon.ampara;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "IconChanger")
public class IconChangerPlugin extends Plugin {

    private static final String[] ICON_ALIASES = {
        ".MainActivityAmpara",
        ".MainActivityWorkout",
        ".MainActivitySteps",
        ".MainActivityYoga",
        ".MainActivityCycle",
        ".MainActivityBeauty",
        ".MainActivityFashion",
        ".MainActivityPuzzle",
        ".MainActivityCards",
        ".MainActivityCasual"
    };

    @PluginMethod
    public void changeIcon(PluginCall call) {
        String iconName = call.getString("iconName");
        
        if (iconName == null || iconName.isEmpty()) {
            call.reject("Icon name is required");
            return;
        }

        String targetAlias = ".MainActivity" + capitalize(iconName);
        
        // Verificar se o alias existe
        boolean aliasExists = false;
        for (String alias : ICON_ALIASES) {
            if (alias.equals(targetAlias)) {
                aliasExists = true;
                break;
            }
        }

        if (!aliasExists) {
            call.reject("Invalid icon name: " + iconName);
            return;
        }

        try {
            PackageManager packageManager = getContext().getPackageManager();
            String packageName = getContext().getPackageName();

            // Desabilitar todos os outros aliases
            for (String alias : ICON_ALIASES) {
                ComponentName componentName = new ComponentName(packageName, packageName + alias);
                int state = alias.equals(targetAlias) 
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
                
                packageManager.setComponentEnabledSetting(
                    componentName,
                    state,
                    PackageManager.DONT_KILL_APP
                );
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("iconName", iconName);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to change icon: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getCurrentIcon(PluginCall call) {
        try {
            PackageManager packageManager = getContext().getPackageManager();
            String packageName = getContext().getPackageName();

            // Encontrar qual alias está ativo
            for (String alias : ICON_ALIASES) {
                ComponentName componentName = new ComponentName(packageName, packageName + alias);
                int state = packageManager.getComponentEnabledSetting(componentName);
                
                if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED || 
                    (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && alias.equals(".MainActivityAmpara"))) {
                    
                    String iconName = alias.replace(".MainActivity", "").toLowerCase();
                    
                    JSObject result = new JSObject();
                    result.put("iconName", iconName);
                    call.resolve(result);
                    return;
                }
            }

            // Default
            JSObject result = new JSObject();
            result.put("iconName", "ampara");
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to get current icon: " + e.getMessage());
        }
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) {
            return str;
        }
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }
}
