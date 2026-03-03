package com.homeassist.app;

import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Sends commands to Tasker via broadcast Intent.
 * Action: com.jesse.assistant.COMMAND
 * Extras: task (String), value (String)
 */
@CapacitorPlugin(name = "Tasker")
public class TaskerPlugin extends Plugin {

    public static final String INTENT_ACTION = "com.jesse.assistant.COMMAND";
    public static final String EXTRA_TASK = "task";
    public static final String EXTRA_VALUE = "value";

    @PluginMethod
    public void sendCommand(PluginCall call) {
        String task = call.getString("task", "");
        String value = call.getString("value", "");

        Intent intent = new Intent(INTENT_ACTION);
        intent.putExtra(EXTRA_TASK, task);
        intent.putExtra(EXTRA_VALUE, value);

        getContext().sendBroadcast(intent);
        call.resolve();
    }
}
