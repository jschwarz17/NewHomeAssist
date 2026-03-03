/**
 * Tasker integration: send Android Intents so Gemini-identified commands
 * can be executed by Tasker on the device.
 *
 * Intent action: com.jesse.assistant.COMMAND
 * Extras: { task: string, value: string }
 */

const INTENT_ACTION = "com.jesse.assistant.COMMAND";

export interface TaskerCommand {
  task: string;
  value: string;
}

/**
 * Sends a command to Tasker via Android Intent.
 * On web / non-Android: no-op (returns without error).
 * On Capacitor Android: requires a native plugin that broadcasts the intent.
 */
export async function sendTaskerCommand(task: string, value: string): Promise<void> {
  if (typeof window === "undefined") return;

  const cap = (window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Tasker] (web) would send:", { task, value });
    }
    return;
  }

  try {
    // Use dynamic import so Capacitor is only loaded in native context
    const { Capacitor } = await import("@capacitor/core");
    const platform = Capacitor.getPlatform();
    if (platform !== "android") return;

    // Option A: Use a community plugin if available, e.g.:
    // const { Intent } = await import('@capgo/capacitor-intent');
    // await Intent.sendBroadcast({ action: INTENT_ACTION, extras: { task, value } });

    // Option B: Custom Capacitor plugin that broadcasts:
    // PluginRegistry.get('TaskerPlugin').sendCommand({ task, value });
    const plugins = (Capacitor as unknown as { Plugins?: { Tasker?: { sendCommand: (c: TaskerCommand) => Promise<void> } } }).Plugins;
    if (plugins?.Tasker?.sendCommand) {
      await plugins.Tasker.sendCommand({ task, value });
      return;
    }

    // Fallback: log so you can implement the native plugin
    console.warn(
      "[Tasker] No Tasker plugin registered. Implement a Capacitor plugin that broadcasts:",
      INTENT_ACTION,
      { task, value }
    );
  } catch (e) {
    console.warn("[Tasker] sendTaskerCommand failed:", e);
  }
}
