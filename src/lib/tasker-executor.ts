/**
 * Server-side Tasker command validation and formatting.
 * Does not execute on device; returns validated task/value for the client to send via Capacitor.
 */

import { getTaskerConfig, getActionConfigByTaskName } from "./config-loader";

export interface TaskerCommandResult {
  success: boolean;
  result: string;
  error?: string;
  executionTime: number;
  /** Resolved task name for intent */
  task?: string;
  /** Resolved value for intent */
  value?: string;
}

export async function executeTaskerCommand(
  taskerTask: string,
  params?: Record<string, unknown>,
  _userId?: string
): Promise<TaskerCommandResult> {
  const start = Date.now();

  try {
    const config = await getTaskerConfig();
    const actionInfo = getActionConfigByTaskName(taskerTask, config);

    if (!actionInfo) {
      return {
        success: false,
        result: "unknown_task",
        error: `Task "${taskerTask}" not found in config`,
        executionTime: Date.now() - start,
      };
    }

    const { config: actionConfig } = actionInfo;
    const taskName = actionConfig.task ?? taskerTask;
    let value = actionConfig.value ?? "";

    if (actionConfig.params && Object.keys(actionConfig.params).length && params) {
      const validated: string[] = [];
      for (const [key, schema] of Object.entries(actionConfig.params)) {
        const v = params[key];
        if (v === undefined || v === null) continue;
        const num = typeof v === "number" ? v : Number(v);
        if (schema.type === "number" && !Number.isNaN(num)) {
          const min = schema.min ?? 0;
          const max = schema.max ?? 100;
          const clamped = Math.min(max, Math.max(min, num));
          validated.push(String(clamped));
        } else {
          validated.push(String(v));
        }
      }
      if (validated.length) value = validated.join(",");
    } else if (params?.value !== undefined) {
      value = String(params.value);
    } else if (params && typeof params === "object" && Object.keys(params).length) {
      value = JSON.stringify(params);
    }

    return {
      success: true,
      result: "validated",
      executionTime: Date.now() - start,
      task: taskName,
      value,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      result: "error",
      error: err,
      executionTime: Date.now() - start,
    };
  }
}
