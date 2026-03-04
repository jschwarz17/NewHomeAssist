/**
 * Picovoice Eagle Speaker Recognition (Android native via Capacitor).
 * Enroll "jesse" and "vanessa", then start recognition to get speakerId from device.
 * No-op on web / non-Android.
 * @see https://picovoice.ai/docs/quick-start/eagle-android/
 */

import type { SpeakerId } from "@/types/voice";

export interface EagleEnrolledSpeakers {
  jesse: boolean;
  vanessa: boolean;
}

export async function isEagleAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string } }).Capacitor;
  return cap?.isNativePlatform?.() === true && cap?.getPlatform?.() === "android";
}

export async function getEnrolledSpeakers(): Promise<EagleEnrolledSpeakers> {
  if (!(await isEagleAvailable())) return { jesse: false, vanessa: false };
  try {
    const { Capacitor } = await import("@capacitor/core");
    const plugins = (Capacitor as unknown as { Plugins?: { Eagle?: { getEnrolledSpeakers: () => Promise<EagleEnrolledSpeakers> } } }).Plugins;
    if (plugins?.Eagle?.getEnrolledSpeakers) {
      return await plugins.Eagle.getEnrolledSpeakers();
    }
  } catch {
    // ignore
  }
  return { jesse: false, vanessa: false };
}

export async function enrollSpeaker(
  speakerId: "jesse" | "vanessa",
  accessKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await isEagleAvailable())) {
    return { success: false, error: "Eagle is only available on Android" };
  }
  try {
    const { Capacitor } = await import("@capacitor/core");
    const plugins = (Capacitor as unknown as { Plugins?: { Eagle?: { enrollSpeaker: (opts: { speakerId: string; accessKey: string }) => Promise<{ success: boolean }> } } }).Plugins;
    if (!plugins?.Eagle?.enrollSpeaker) return { success: false, error: "Eagle plugin not registered" };
    await plugins.Eagle.enrollSpeaker({ speakerId, accessKey });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function startEagleRecognition(
  accessKey: string,
  onSpeaker: (speakerId: SpeakerId) => void
): Promise<{ started: boolean; error?: string }> {
  if (!(await isEagleAvailable())) return { started: false };
  try {
    const { Capacitor } = await import("@capacitor/core");
    const plugins = (Capacitor as unknown as { Plugins?: { Eagle?: { startRecognition: (opts: { accessKey: string }) => Promise<{ started: boolean }>; addListener: (event: string, cb: (e: { speakerId: string }) => void) => Promise<{ remove: () => Promise<void> }> } } }).Plugins;
    if (!plugins?.Eagle?.startRecognition) return { started: false };
    const Eagle = plugins.Eagle as { addListener: (event: string, cb: (e: { speakerId: string }) => void) => Promise<{ remove: () => Promise<void> }> };
    const { remove } = await Eagle.addListener("speaker", (e) => {
      const id = e.speakerId === "jesse" || e.speakerId === "vanessa" ? e.speakerId : null;
      onSpeaker(id);
    });
    (window as unknown as { __eagleRemoveListener?: () => Promise<void> }).__eagleRemoveListener = remove;
    await plugins.Eagle.startRecognition({ accessKey });
    return { started: true };
  } catch (e) {
    return { started: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function stopEagleRecognition(): Promise<void> {
  if (!(await isEagleAvailable())) return;
  try {
    const remove = (window as unknown as { __eagleRemoveListener?: () => Promise<void> }).__eagleRemoveListener;
    if (remove) await remove();
    (window as unknown as { __eagleRemoveListener?: undefined }).__eagleRemoveListener = undefined;
    const { Capacitor } = await import("@capacitor/core");
    const plugins = (Capacitor as unknown as { Plugins?: { Eagle?: { stopRecognition: () => Promise<void> } } }).Plugins;
    if (plugins?.Eagle?.stopRecognition) await plugins.Eagle.stopRecognition();
  } catch {
    // ignore
  }
}
