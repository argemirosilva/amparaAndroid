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

    private static final String MAIN_ACTIVITY = ".MainActivity";
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
        String targetAlias = call.getString("alias");
        if (targetAlias == null) {
            call.reject("Alias is required");
            return;
        }

        try {
            PackageManager packageManager = getContext().getPackageManager();
            String packageName = getContext().getPackageName();

            // Se o alvo for o original (Ampara), habilitamos a MainActivity e desabilitamos todos os aliases
            if (targetAlias.equals(".MainActivityAmpara")) {
                // Habilitar MainActivity principal
                packageManager.setComponentEnabledSetting(
                    new ComponentName(packageName, packageName + MAIN_ACTIVITY),
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
                );
                // Desabilitar todos os aliases
                for (String alias : ICON_ALIASES) {
                    packageManager.setComponentEnabledSetting(
                        new ComponentName(packageName, packageName + alias),
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP
                    );
                }
            } else {
                // Se for um disfarce, desabilitamos a MainActivity principal
                packageManager.setComponentEnabledSetting(
                    new ComponentName(packageName, packageName + MAIN_ACTIVITY),
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                );
                // Habilitamos apenas o alias alvo e desabilitamos os outros
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
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error changing icon: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getCurrentIcon(PluginCall call) {
        try {
            PackageManager packageManager = getContext().getPackageManager();
            String packageName = getContext().getPackageName();

            String activeAlias = ".MainActivityAmpara"; // Default

            // Verificar se a MainActivity principal está ativa
            int mainState = packageManager.getComponentEnabledSetting(new ComponentName(packageName, packageName + MAIN_ACTIVITY));
            if (mainState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED || mainState == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT) {
                activeAlias = ".MainActivityAmpara";
            } else {
                // Se não, procurar qual alias está ativo
                for (String alias : ICON_ALIASES) {
                    int state = packageManager.getComponentEnabledSetting(new ComponentName(packageName, packageName + alias));
                    if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                        activeAlias = alias;
                        break;
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("alias", activeAlias);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error getting current icon: " + e.getMessage());
        }
    }
}
