package com.homeassist.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Base64;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import ai.picovoice.eagle.Eagle;
import ai.picovoice.eagle.EagleException;
import ai.picovoice.eagle.EagleProfiler;
import ai.picovoice.eagle.EagleProfilerEnrollResult;
import ai.picovoice.eagle.EagleProfile;

/**
 * Capacitor plugin for Picovoice Eagle Speaker Recognition.
 * Enrolls "jesse" and "vanessa" and identifies the current speaker during recognition.
 * See: https://picovoice.ai/docs/quick-start/eagle-android/
 */
@CapacitorPlugin(name = "Eagle")
@Permission(Manifest.permission.RECORD_AUDIO)
public class EaglePlugin extends Plugin {

    private static final String TAG = "EaglePlugin";
    private static final String PREFS_NAME = "EagleProfiles";
    private static final String KEY_PROFILE_JESSE = "eagle_profile_jesse";
    private static final String KEY_PROFILE_VANESSA = "eagle_profile_vanessa";

    private static final String[] SPEAKER_IDS = {"jesse", "vanessa"};

    private Eagle eagle;
    private AudioRecord audioRecord;
    private Thread recognitionThread;
    private volatile boolean recognitionRunning;

    private String getAccessKey(PluginCall call) {
        String key = call.getString("accessKey");
        if (key != null && !key.isEmpty()) return key;
        return null;
    }

    private void saveProfileByKey(String prefsKey, byte[] profileBytes) {
        Context ctx = getContext();
        if (ctx == null) return;
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(prefsKey, Base64.encodeToString(profileBytes, Base64.NO_WRAP))
                .apply();
    }

    private byte[] loadProfileBytes(String prefsKey) {
        Context ctx = getContext();
        if (ctx == null) return null;
        String b64 = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(prefsKey, null);
        if (b64 == null) return null;
        return Base64.decode(b64, Base64.NO_WRAP);
    }

    @PluginMethod
    public void enrollSpeaker(PluginCall call) {
        String speakerId = call.getString("speakerId");
        String accessKey = getAccessKey(call);
        if (accessKey == null || accessKey.isEmpty()) {
            call.reject("Missing accessKey (use PICOVOICE_API_KEY or pass accessKey)");
            return;
        }
        if (speakerId == null || (!speakerId.equals("jesse") && !speakerId.equals("vanessa"))) {
            call.reject("speakerId must be 'jesse' or 'vanessa'");
            return;
        }

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("RECORD_AUDIO permission required");
            return;
        }

        new Thread(() -> {
            EagleProfiler profiler = null;
            AudioRecord rec = null;
            try {
                profiler = new EagleProfiler.Builder()
                        .setAccessKey(accessKey)
                        .build(getContext());

                int sampleRate = profiler.getSampleRate();
                int minSamples = profiler.getMinEnrollSamples();
                int bufferSize = Math.max(minSamples * 2, AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT));

                rec = new AudioRecord(MediaRecorder.AudioSource.MIC, sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize);
                if (rec.getState() != AudioRecord.STATE_INITIALIZED) {
                    getActivity().runOnUiThread(() -> call.reject("AudioRecord failed to initialize"));
                    return;
                }

                rec.startRecording();
                short[] buffer = new short[Math.min(minSamples, bufferSize / 2)];
                float percentage = 0;
                int totalRead = 0;
                final int maxSamples = sampleRate * 5;
                while (percentage < 100.0f && totalRead < maxSamples) {
                    int read = rec.read(buffer, 0, buffer.length);
                    if (read <= 0) continue;
                    totalRead += read;
                    EagleProfilerEnrollResult result = profiler.enroll(buffer);
                    percentage = result.getPercentage();
                }

                if (percentage < 100.0f) {
                    getActivity().runOnUiThread(() -> call.reject("Enrollment did not reach 100%. Speak longer in a quiet environment."));
                    return;
                }

                EagleProfile profile = profiler.export();
                byte[] bytes = profile.getBytes();
                String prefsKey = speakerId.equals("jesse") ? KEY_PROFILE_JESSE : KEY_PROFILE_VANESSA;
                saveProfileByKey(prefsKey, bytes);
                profile.delete();

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("speakerId", speakerId);
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (EagleException e) {
                Log.e(TAG, "Eagle enrollment error", e);
                getActivity().runOnUiThread(() -> call.reject("Eagle: " + e.getMessage()));
            } catch (Exception e) {
                Log.e(TAG, "Enrollment error", e);
                getActivity().runOnUiThread(() -> call.reject(e.getMessage()));
            } finally {
                if (profiler != null) try { profiler.delete(); } catch (Exception ignored) {}
                if (rec != null) {
                    try { rec.stop(); rec.release(); } catch (Exception ignored) {}
                }
            }
        }).start();
    }

    @PluginMethod
    public void startRecognition(PluginCall call) {
        String accessKey = getAccessKey(call);
        if (accessKey == null || accessKey.isEmpty()) {
            call.reject("Missing accessKey");
            return;
        }

        byte[] jesseBytes = loadProfileBytes(KEY_PROFILE_JESSE);
        byte[] vanessaBytes = loadProfileBytes(KEY_PROFILE_VANESSA);
        if (jesseBytes == null || vanessaBytes == null) {
            call.reject("Enroll both jesse and vanessa first (call enrollSpeaker for each)");
            return;
        }

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("RECORD_AUDIO permission required");
            return;
        }

        try {
            EagleProfile jesseProfile = new EagleProfile(jesseBytes);
            EagleProfile vanessaProfile = new EagleProfile(vanessaBytes);
            eagle = new Eagle.Builder()
                    .setAccessKey(accessKey)
                    .setSpeakerProfiles(new EagleProfile[]{jesseProfile, vanessaProfile})
                    .build(getContext());

            jesseProfile.delete();
            vanessaProfile.delete();

            int sampleRate = eagle.getSampleRate();
            int frameLength = eagle.getFrameLength();
            int bufferSize = frameLength * 2;
            audioRecord = new AudioRecord(MediaRecorder.AudioSource.MIC, sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize * 2);
            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                eagle.delete();
                eagle = null;
                call.reject("AudioRecord failed to initialize");
                return;
            }

            recognitionRunning = true;
            audioRecord.startRecording();
            recognitionThread = new Thread(() -> {
                short[] frame = new short[frameLength];
                String lastSpeaker = null;
                while (recognitionRunning && audioRecord != null && eagle != null) {
                    int read = audioRecord.read(frame, 0, frame.length);
                    if (read != frame.length) continue;
                    try {
                        float[] scores = eagle.process(frame);
                        if (scores != null && scores.length >= 2) {
                            int idx = scores[0] >= scores[1] ? 0 : 1;
                            String speaker = SPEAKER_IDS[idx];
                            if (!speaker.equals(lastSpeaker)) {
                                lastSpeaker = speaker;
                                JSObject data = new JSObject();
                                data.put("speakerId", speaker);
                                data.put("score", scores[idx]);
                                notifyListeners("speaker", data);
                            }
                        }
                    } catch (EagleException e) {
                        Log.e(TAG, "Eagle process error", e);
                    }
                }
            });
            recognitionThread.start();

            call.resolve(new JSObject().put("started", true));
        } catch (EagleException e) {
            Log.e(TAG, "Eagle start error", e);
            call.reject("Eagle: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopRecognition(PluginCall call) {
        recognitionRunning = false;
        if (recognitionThread != null) {
            try { recognitionThread.join(500); } catch (InterruptedException ignored) {}
            recognitionThread = null;
        }
        if (audioRecord != null) {
            try {
                audioRecord.stop();
                audioRecord.release();
            } catch (Exception ignored) {}
            audioRecord = null;
        }
        if (eagle != null) {
            try { eagle.delete(); } catch (Exception ignored) {}
            eagle = null;
        }
        call.resolve(new JSObject().put("stopped", true));
    }

    @PluginMethod
    public void getEnrolledSpeakers(PluginCall call) {
        boolean hasJesse = loadProfileBytes(KEY_PROFILE_JESSE) != null;
        boolean hasVanessa = loadProfileBytes(KEY_PROFILE_VANESSA) != null;
        JSObject ret = new JSObject();
        ret.put("jesse", hasJesse);
        ret.put("vanessa", hasVanessa);
        call.resolve(ret);
    }
}
