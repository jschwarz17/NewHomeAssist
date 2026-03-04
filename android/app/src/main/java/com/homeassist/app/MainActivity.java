package com.homeassist.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(TaskerPlugin.class);
        registerPlugin(EaglePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
