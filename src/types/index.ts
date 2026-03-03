/**
 * Home Assist – shared types for the home assistant brain.
 * Extend these as you add devices, integrations, and automations.
 */

export type DeviceKind =
  | "light"
  | "switch"
  | "thermostat"
  | "lock"
  | "sensor"
  | "media"
  | "cover"
  | "other";

export interface Device {
  id: string;
  name: string;
  kind: DeviceKind;
  roomId: string;
  state?: string;
  attributes?: Record<string, unknown>;
}

export interface Room {
  id: string;
  name: string;
  deviceIds: string[];
}

export interface Routine {
  id: string;
  name: string;
  trigger: "schedule" | "manual" | "device";
  schedule?: string; // cron or simple time
  actions: { deviceId: string; command: string; payload?: unknown }[];
}
