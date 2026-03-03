# Tasker setup: connect the app to Tasker on Android

The app sends commands to **Tasker** via an Android broadcast Intent. When Ara (or the assistant API) returns a home control command (e.g. “dim the lights”, “play Sonos”), the app calls the **Tasker** Capacitor plugin, which broadcasts an intent that Tasker can receive.

## What’s in place

- **Intent action:** `com.jesse.assistant.COMMAND`  
- **Intent extras:** `task` (string), `value` (string)  
- **App side:** `src/lib/tasker.ts` → `sendTaskerCommand(task, value)`  
- **Android:** `TaskerPlugin.java` in the project broadcasts this intent; `MainActivity` registers the plugin.

## On the tablet: Tasker profile

1. Install **Tasker** (and optionally **Tasker App Factory** or **AutoRemote** if you need more than local profiles).
2. Create a **Profile** → **Event** → **Intent Received**.
3. Set:
   - **Action:** `com.jesse.assistant.COMMAND`
   - Leave **Sender** blank (any app).
4. Link a **Task** to this profile.
5. In the Task, use the Intent’s extra variables:
   - `%task` – command name (e.g. `dim_lights`, `lights`, `sonos_play`).
   - `%value` – value (e.g. `50`, `on`/`off`, or what to play).

### Example Tasker task (dim lights)

- **If** `%task` ~ `dim_lights`
  - Use `%value` as the dimming level (e.g. send to your smart home or HTTP).
- **If** `%task` ~ `lights`
  - **If** `%value` ~ `on` → turn lights on.
  - **If** `%value` ~ `off` → turn lights off.
- **If** `%task` ~ `sonos_play`
  - Start Sonos (or a playlist) according to `%value`.

## Flow end‑to‑end

1. User says something like “Dim the lights to 50%” (after “Hi Ara” and speaker ID).
2. App sends the transcript to the Vercel API (`/api/assistant`).
3. Grok returns a response; the API parses it and returns e.g. `taskerCommand: { task: "dim_lights", value: "50" }`.
4. The app calls `sendTaskerCommand("dim_lights", "50")`.
5. On Android, `TaskerPlugin` broadcasts `com.jesse.assistant.COMMAND` with extras `task=dim_lights`, `value=50`.
6. Tasker’s “Intent Received” profile fires; your Task reads `%task` and `%value` and runs your automations.

## Rebuild the app after changing the plugin

If you change `TaskerPlugin.java` or `MainActivity.java`, rebuild and reinstall the app (e.g. run from Android Studio again, or build a new APK).
