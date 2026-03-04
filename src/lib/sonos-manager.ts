/**
 * Singleton service for local Sonos speaker control via UPnP.
 * Uses @svrooij/sonos for discovery and control — no cloud API needed.
 *
 * Important: This only works when the Node.js server runs on the same
 * local network as the Sonos speakers (e.g. `npm run dev` at home,
 * NOT on Vercel).
 */

import { SonosManager as SonosManagerLib, SonosDevice } from "@svrooij/sonos";

export interface ZoneInfo {
  name: string;
  ip: string;
  uuid: string;
  groupName: string;
  volume?: number;
  muted?: boolean;
}

class SonosManagerSingleton {
  private manager: SonosManagerLib | null = null;
  private initialized = false;
  private initializing = false;
  private devices: SonosDevice[] = [];

  async initialize(timeoutSeconds = 10): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) {
      await this.waitForInit();
      return;
    }

    this.initializing = true;
    try {
      this.manager = new SonosManagerLib();
      await this.manager.InitializeWithDiscovery(timeoutSeconds);
      this.devices = this.manager.Devices;
      this.initialized = true;
    } catch (e) {
      this.manager = null;
      throw new Error(`Sonos discovery failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.initializing = false;
    }
  }

  async initializeFromDevice(ip: string): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) {
      await this.waitForInit();
      return;
    }

    this.initializing = true;
    try {
      this.manager = new SonosManagerLib();
      await this.manager.InitializeFromDevice(ip);
      this.devices = this.manager.Devices;
      this.initialized = true;
    } catch (e) {
      this.manager = null;
      throw new Error(`Sonos init from ${ip} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.initializing = false;
    }
  }

  private async waitForInit(): Promise<void> {
    const start = Date.now();
    while (this.initializing && Date.now() - start < 15000) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.manager) {
      throw new Error("SonosManager not initialized. Call initialize() first.");
    }
  }

  /**
   * Find a device by room name (case-insensitive partial match).
   * Falls back to the first device if no match.
   */
  findDevice(roomName?: string): SonosDevice | undefined {
    this.ensureInitialized();
    if (!roomName) return this.devices[0];

    const lower = roomName.toLowerCase();
    return (
      this.devices.find((d) => d.Name.toLowerCase() === lower) ??
      this.devices.find((d) => d.Name.toLowerCase().includes(lower)) ??
      this.devices[0]
    );
  }

  async play(roomName?: string): Promise<string> {
    const device = this.findDevice(roomName);
    if (!device) throw new Error("No Sonos speakers found");
    await device.Play();
    return `Playing on ${device.Name}`;
  }

  async pause(roomName?: string): Promise<string> {
    const device = this.findDevice(roomName);
    if (!device) throw new Error("No Sonos speakers found");
    await device.Pause();
    return `Paused ${device.Name}`;
  }

  async togglePlayback(roomName?: string): Promise<string> {
    const device = this.findDevice(roomName);
    if (!device) throw new Error("No Sonos speakers found");
    await device.TogglePlayback();
    return `Toggled playback on ${device.Name}`;
  }

  async setVolume(volume: number, roomName?: string): Promise<string> {
    const device = this.findDevice(roomName);
    if (!device) throw new Error("No Sonos speakers found");
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    await device.SetVolume(clamped);
    return `Volume set to ${clamped} on ${device.Name}`;
  }

  /**
   * Play a URI (Spotify, HTTP stream, etc.) on a specific speaker.
   */
  async playUri(uri: string, roomName?: string): Promise<string> {
    const device = this.findDevice(roomName);
    if (!device) throw new Error("No Sonos speakers found");
    await device.SetAVTransportURI(uri);
    await device.Play();
    return `Playing on ${device.Name}`;
  }

  async getZoneInfo(): Promise<ZoneInfo[]> {
    this.ensureInitialized();
    const zones: ZoneInfo[] = [];
    for (const device of this.devices) {
      try {
        zones.push({
          name: device.Name,
          ip: device.Host,
          uuid: device.Uuid,
          groupName: device.GroupName ?? device.Name,
          volume: device.Volume,
          muted: device.Muted,
        });
      } catch {
        zones.push({
          name: device.Name ?? "Unknown",
          ip: device.Host,
          uuid: device.Uuid,
          groupName: device.GroupName ?? "Unknown",
        });
      }
    }
    return zones;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get deviceCount(): number {
    return this.devices.length;
  }

  getDeviceNames(): string[] {
    return this.devices.map((d) => d.Name);
  }
}

export const sonosManager = new SonosManagerSingleton();
