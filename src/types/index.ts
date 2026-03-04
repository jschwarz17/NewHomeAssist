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

/** Tasker config from GitHub: domains and actions. */
export interface TaskerActionConfig {
  name?: string;
  task?: string;
  value?: string;
  params?: Record<string, { type?: string; min?: number; max?: number }>;
  examples?: string[];
  device?: string;
}

export interface TaskerDomainConfig {
  actions: Record<string, TaskerActionConfig>;
  examples?: string[];
}

export interface TaskerConfig {
  domains: Record<string, TaskerDomainConfig>;
}
