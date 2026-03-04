/**
 * Learning engine: user context, interaction logging, preference storage, pattern analysis.
 * Stub implementation: buildUserContext returns static context; DB writes when available.
 */

import { getDatabase, isDatabaseAvailable } from "./database";

export type UserId = "jesse" | "vanessa" | null;

export interface UserContext {
  preferences: Record<string, unknown>;
  routines: Record<string, unknown>;
  devicePreferences: Record<string, unknown>;
  learningPatterns: Record<string, unknown>;
  failedApproaches: string[];
  communicationStyle: string;
}

const STATIC_CONTEXT: Record<string, Partial<UserContext>> = {
  jesse: {
    communicationStyle: "casual",
    preferences: {},
    routines: {},
    devicePreferences: {},
    learningPatterns: {},
    failedApproaches: [],
  },
  vanessa: {
    communicationStyle: "casual",
    preferences: {},
    routines: {},
    devicePreferences: {},
    learningPatterns: {},
    failedApproaches: [],
  },
};

export async function buildUserContext(userId: string | null): Promise<UserContext> {
  const fallback: Partial<UserContext> = {
    communicationStyle: "casual",
    preferences: {},
    routines: {},
    devicePreferences: {},
    learningPatterns: {},
    failedApproaches: [],
  };
  const base =
    userId === "jesse" || userId === "vanessa"
      ? STATIC_CONTEXT[userId]
      : fallback;

  if (!userId || !isDatabaseAvailable()) {
    return { ...base } as UserContext;
  }

  try {
    const db = getDatabase();

    const prefs = db
      .prepare(
        "SELECT category, subcategory, key, value, confidence FROM preferences WHERE user_id = ?"
      )
      .all(userId) as Array<{ category: string; subcategory: string; key: string; value: string; confidence: number }>;
    const preferences: Record<string, unknown> = {};
    for (const p of prefs) {
      const k = p.subcategory ? `${p.category}.${p.subcategory}` : p.category;
      if (!preferences[k]) (preferences[k] as Record<string, unknown>) = {};
      (preferences[k] as Record<string, unknown>)[p.key] = {
        value: p.value,
        confidence: p.confidence,
      };
    }

    const devPrefs = db
      .prepare(
        "SELECT device_type, preferred_device, rank FROM device_preferences WHERE user_id = ? ORDER BY rank"
      )
      .all(userId) as Array<{ device_type: string; preferred_device: string; rank: number }>;
    const devicePreferences: Record<string, unknown> = {};
    for (const d of devPrefs) {
      devicePreferences[d.device_type] = d.preferred_device;
    }

    const patterns = db
      .prepare(
        "SELECT pattern_type, pattern_data, confidence FROM learned_patterns WHERE user_id = ?"
      )
      .all(userId) as Array<{ pattern_type: string; pattern_data: string; confidence: number }>;
    const learningPatterns: Record<string, unknown> = {};
    for (const p of patterns) {
      try {
        learningPatterns[p.pattern_type] = JSON.parse(p.pattern_data);
      } catch {
        learningPatterns[p.pattern_type] = p.pattern_data;
      }
    }

    const failed = db
      .prepare(
        "SELECT task_name, reason FROM failed_automations WHERE user_id = ? ORDER BY last_failed_at DESC LIMIT 20"
      )
      .all(userId) as Array<{ task_name: string; reason: string }>;
    const failedApproaches = failed.map((f) => `${f.task_name}: ${f.reason}`);

    const row = db.prepare("SELECT communication_style FROM users WHERE id = ?").get(userId) as
      | { communication_style: string }
      | undefined;
    const communicationStyle = row?.communication_style ?? base?.communicationStyle ?? "casual";

    return {
      preferences: Object.keys(preferences).length ? preferences : (base.preferences ?? {}),
      routines: base.routines ?? {},
      devicePreferences: Object.keys(devicePreferences).length ? devicePreferences : (base.devicePreferences ?? {}),
      learningPatterns: Object.keys(learningPatterns).length ? learningPatterns : (base.learningPatterns ?? {}),
      failedApproaches: failedApproaches.length ? failedApproaches : (base.failedApproaches ?? []),
      communicationStyle,
    };
  } catch (e) {
    console.error("[learning-engine] buildUserContext:", e);
    return { ...base } as UserContext;
  }
}

export interface InteractionInput {
  userInput: string;
  intentType: "task" | "chat";
  apiUsed: "claude" | "grok";
  resultType: "success" | "failure" | "partial";
  actionsTaken: unknown[];
  tokenUsage: number;
  duration: number;
}

export async function storeInteractionLearning(
  userId: string,
  interaction: InteractionInput
): Promise<void> {
  if (!isDatabaseAvailable()) return;
  try {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO interactions (user_id, user_input, intent_type, api_used, result_type, actions_taken, tokens_used, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      interaction.userInput,
      interaction.intentType,
      interaction.apiUsed,
      interaction.resultType,
      JSON.stringify(interaction.actionsTaken),
      interaction.tokenUsage,
      interaction.duration
    );
  } catch (e) {
    console.error("[learning-engine] storeInteractionLearning:", e);
  }
}

export async function storeLearnedPattern(
  userId: string,
  pattern: {
    type: "time_based" | "context_based" | "sequence";
    data: unknown;
    confidence: number;
  }
): Promise<void> {
  if (!isDatabaseAvailable()) return;
  try {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO learned_patterns (user_id, pattern_type, pattern_data, confidence, times_observed)
       VALUES (?, ?, ?, ?, 1)`
    ).run(userId, pattern.type, JSON.stringify(pattern.data), pattern.confidence);
  } catch (e) {
    console.error("[learning-engine] storeLearnedPattern:", e);
  }
}

export async function analyzeAndLearnPatterns(userId: string): Promise<{
  newRoutines: unknown[];
  updatedPreferences: unknown[];
  patterns: unknown[];
}> {
  if (!isDatabaseAvailable()) return { newRoutines: [], updatedPreferences: [], patterns: [] };
  try {
    const db = getDatabase();
    const recent = db
      .prepare(
        `SELECT user_input, intent_type, result_type, actions_taken FROM interactions
         WHERE user_id = ? AND intent_type = 'task' AND result_type = 'success'
         ORDER BY timestamp DESC LIMIT 50`
      )
      .all(userId) as Array<{
        user_input: string;
        intent_type: string;
        result_type: string;
        actions_taken: string;
      }>;

    const taskCounts: Record<string, number> = {};
    const patterns: unknown[] = [];
    for (const row of recent) {
      let actions: Array<{ task?: string; value?: string }> = [];
      try {
        actions = JSON.parse(row.actions_taken) as Array<{ task?: string; value?: string }>;
      } catch {
        continue;
      }
      for (const a of actions) {
        if (a.task) {
          taskCounts[a.task] = (taskCounts[a.task] ?? 0) + 1;
        }
      }
    }
    const topTasks = Object.entries(taskCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([task, count]) => ({ task, count }));
    if (topTasks.length) {
      patterns.push({ type: "frequent_tasks", tasks: topTasks });
    }
    return { newRoutines: [], updatedPreferences: [], patterns };
  } catch (e) {
    console.error("[learning-engine] analyzeAndLearnPatterns:", e);
    return { newRoutines: [], updatedPreferences: [], patterns: [] };
  }
}

export async function recordFailedAutomation(
  userId: string,
  taskName: string,
  reason: string
): Promise<void> {
  if (!isDatabaseAvailable()) return;
  try {
    const db = getDatabase();
    const existing = db
      .prepare(
        "SELECT id, failure_count FROM failed_automations WHERE user_id = ? AND task_name = ?"
      )
      .get(userId, taskName) as { id: number; failure_count: number } | undefined;
    if (existing) {
      db.prepare(
        "UPDATE failed_automations SET reason = ?, last_failed_at = CURRENT_TIMESTAMP, failure_count = failure_count + 1 WHERE id = ?"
      ).run(reason, existing.id);
    } else {
      db.prepare(
        "INSERT INTO failed_automations (user_id, task_name, reason, failure_count) VALUES (?, ?, ?, 1)"
      ).run(userId, taskName, reason);
    }
  } catch (e) {
    console.error("[learning-engine] recordFailedAutomation:", e);
  }
}

export async function recordSuccessfulTask(
  userId: string,
  task: string,
  value: string
): Promise<void> {
  if (!isDatabaseAvailable()) return;
  try {
    const db = getDatabase();
    const deviceType = inferDeviceType(task);
    if (deviceType) {
      const existing = db
        .prepare(
          "SELECT id FROM device_preferences WHERE user_id = ? AND device_type = ? AND preferred_device = ?"
        )
        .get(userId, deviceType, task) as { id: number } | undefined;
      if (!existing) {
        const maxRank = db
          .prepare(
            "SELECT COALESCE(MAX(rank), 0) + 1 AS r FROM device_preferences WHERE user_id = ?"
          )
          .get(userId) as { r: number };
        db.prepare(
          "INSERT INTO device_preferences (user_id, device_type, preferred_device, rank, confidence) VALUES (?, ?, ?, ?, 0.5)"
        ).run(userId, deviceType, task, maxRank.r);
      }
    }
  } catch (e) {
    console.error("[learning-engine] recordSuccessfulTask:", e);
  }
}

function inferDeviceType(task: string): string | null {
  const lower = task.toLowerCase();
  if (lower.includes("light") || lower.includes("dim")) return "lights";
  if (lower.includes("sonos") || lower.includes("music") || lower.includes("play")) return "music";
  if (lower.includes("thermostat") || lower.includes("temp")) return "climate";
  return null;
}

export async function getPreferencesForCategory(
  userId: string,
  category: string
): Promise<Record<string, unknown>> {
  if (!isDatabaseAvailable()) return {};
  try {
    const db = getDatabase();
    const rows = db
      .prepare(
        "SELECT subcategory, key, value, confidence FROM preferences WHERE user_id = ? AND category = ?"
      )
      .all(userId, category) as Array<{ subcategory: string; key: string; value: string; confidence: number }>;
    const out: Record<string, unknown> = {};
    for (const r of rows) {
      const k = r.subcategory || r.key;
      out[k] = { value: r.value, confidence: r.confidence };
    }
    return out;
  } catch (e) {
    console.error("[learning-engine] getPreferencesForCategory:", e);
    return {};
  }
}

export async function updatePreference(
  userId: string,
  category: string,
  subcategory: string,
  value: unknown,
  source: "explicit" | "learned"
): Promise<void> {
  if (!isDatabaseAvailable()) return;
  try {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO preferences (user_id, category, subcategory, key, value, confidence, source)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    ).run(userId, category, subcategory, "value", String(value), source);
  } catch (e) {
    console.error("[learning-engine] updatePreference:", e);
  }
}
