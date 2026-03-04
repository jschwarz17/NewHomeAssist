/**
 * Load and cache Tasker configuration from GitHub.
 * Used by Claude system prompt and tasker-executor for validation.
 */

import type { TaskerConfig, TaskerDomainConfig, TaskerActionConfig } from "@/types";

const CONFIG_URL =
  "https://raw.githubusercontent.com/jschwarz17/NewHomeAssist-Config/main/tasker-config.json";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cached: { config: TaskerConfig; expires: number } | null = null;

function isValidConfig(config: unknown): config is TaskerConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  if (!c.domains || typeof c.domains !== "object") return false;
  for (const domain of Object.values(c.domains as Record<string, unknown>)) {
    if (!domain || typeof domain !== "object") return false;
    const d = domain as Record<string, unknown>;
    if (!d.actions || typeof d.actions !== "object") return false;
    for (const action of Object.values(d.actions as Record<string, unknown>)) {
      if (!action || typeof action !== "object") return false;
    }
  }
  return true;
}

export async function getTaskerConfig(): Promise<TaskerConfig> {
  if (cached && Date.now() < cached.expires) return cached.config;

  try {
    const headers: HeadersInit = {
      "Cache-Control": "no-cache",
      Accept: "application/json",
    };
    if (process.env.GITHUB_TOKEN) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(CONFIG_URL, { headers, next: { revalidate: 0 } });
    if (!res.ok) {
      if (cached) return cached.config;
      throw new Error(`Config fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as unknown;
    if (!isValidConfig(data)) {
      if (cached) return cached.config;
      throw new Error("Invalid config structure");
    }
    cached = { config: data, expires: Date.now() + CACHE_TTL_MS };
    return data;
  } catch (e) {
    if (cached) return cached.config;
    console.error("[config-loader] getTaskerConfig:", e);
    return { domains: {} };
  }
}

export function formatCapabilitiesForClaude(config: TaskerConfig): string {
  const lines: string[] = ["Available Tasker capabilities (domain -> action -> task/value or params):"];
  for (const [domainName, domain] of Object.entries(config.domains)) {
    if (!domain?.actions) continue;
    lines.push(`\n## ${domainName}`);
    for (const [actionName, action] of Object.entries(domain.actions)) {
      if (!action || typeof action !== "object") continue;
      const task = (action as TaskerActionConfig).task ?? actionName;
      const value = (action as TaskerActionConfig).value ?? "";
      const params = (action as TaskerActionConfig).params;
      const ex = (action as TaskerActionConfig).examples;
      let desc = `  - ${actionName}: task="${task}"${value ? ` value="${value}"` : ""}`;
      if (params && Object.keys(params).length) desc += ` params: ${JSON.stringify(params)}`;
      if (ex?.length) desc += ` examples: ${ex.slice(0, 3).join(", ")}`;
      lines.push(desc);
    }
  }
  return lines.join("\n");
}

export function getAllExamples(config: TaskerConfig): string[] {
  const examples: string[] = [];
  for (const domain of Object.values(config.domains)) {
    if ((domain as TaskerDomainConfig).examples) {
      examples.push(...((domain as TaskerDomainConfig).examples ?? []));
    }
    if (!(domain as TaskerDomainConfig).actions) continue;
    for (const action of Object.values((domain as TaskerDomainConfig).actions)) {
      if ((action as TaskerActionConfig).examples) {
        examples.push(...((action as TaskerActionConfig).examples ?? []));
      }
    }
  }
  return [...new Set(examples)];
}

export function isValidCommand(
  domain: string,
  action: string,
  config: TaskerConfig
): boolean {
  const d = config.domains[domain];
  if (!d?.actions) return false;
  return Object.prototype.hasOwnProperty.call(d.actions, action);
}

/** Resolve task name for intent. May be domain.action or action task field. */
export function getTaskForAction(
  domain: string,
  action: string,
  config: TaskerConfig
): string | null {
  const d = config.domains[domain];
  if (!d?.actions) return null;
  const a = d.actions[action] as TaskerActionConfig | undefined;
  if (!a) return null;
  return a.task ?? action;
}

export function getDeviceForAction(
  domain: string,
  action: string,
  config: TaskerConfig
): string | null {
  const d = config.domains[domain];
  if (!d?.actions) return null;
  const a = d.actions[action] as TaskerActionConfig | undefined;
  if (!a) return null;
  return a.device ?? null;
}

/** Find action config by Tasker task name (e.g. "dim_lights", "sonos_play"). */
export function getActionConfigByTaskName(
  taskName: string,
  config: TaskerConfig
): { domain: string; action: string; config: TaskerActionConfig } | null {
  for (const [domainName, domain] of Object.entries(config.domains)) {
    if (!domain?.actions) continue;
    for (const [actionName, action] of Object.entries(domain.actions)) {
      const task = (action as TaskerActionConfig).task ?? actionName;
      if (task === taskName) return { domain: domainName, action: actionName, config: action as TaskerActionConfig };
    }
  }
  return null;
}
