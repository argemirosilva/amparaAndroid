package tech.orizon.ampara;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import tech.orizon.ampara.plugins.SecureStoragePlugin;
import tech.orizon.ampara.IconChangerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecureStoragePlugin.class);
        registerPlugin(IconChangerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

