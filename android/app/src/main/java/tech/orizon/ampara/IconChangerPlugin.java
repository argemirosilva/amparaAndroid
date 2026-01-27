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
        String targetAlias = call.getString("alias");
        if (targetAlias == null) {
            call.reject("Alias is required");
            return;
        }

        try {
            PackageManager packageManager = getContext().getPackageManager();
            String packageName = getContext().getPackageName();

            // Desabilitar todos os outros aliases e habilitar o alvo
            for (String alias : ICON_ALIASES) {
                // ComponentName(packageName, packageName + alias) é o padrão mais seguro
                ComponentName componentName = new ComponentName(packageName, packageName + alias);
                
                int state = alias.equals(targetAlias) 
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
                
                packageManager.setComponentEnabledSetting(
                    componentName,
                    state,
                    PackageManager.DONT_KILL_APP // Evita que o Android mate o processo imediatamente
                );
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

            for (String alias : ICON_ALIASES) {
                ComponentName componentName = new ComponentName(packageName, packageName + alias);
                int state = packageManager.getComponentEnabledSetting(componentName);
                
                if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                    activeAlias = alias;
                    break;
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
