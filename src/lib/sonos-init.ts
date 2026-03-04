/**
 * Ensures the SonosManager is initialized before use.
 * Uses SONOS_DEVICE_IP env var for fast init from a known device,
 * or falls back to network discovery.
 */
import { sonosManager } from "./sonos-manager";

let initPromise: Promise<void> | null = null;

export async function ensureSonosReady(): Promise<void> {
  if (sonosManager.isInitialized) return;

  if (!initPromise) {
    const knownIp = process.env.SONOS_DEVICE_IP;
    initPromise = knownIp
      ? sonosManager.initializeFromDevice(knownIp)
      : sonosManager.initialize(10);

    initPromise.catch(() => {
      initPromise = null;
    });
  }

  await initPromise;
}
