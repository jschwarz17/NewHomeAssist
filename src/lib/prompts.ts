/**
 * Dynamic system prompts for Grok (chat) and Claude (task agent).
 */

import type { UserContext } from "./learning-engine";
import type { TaskerConfig } from "@/types";
import { formatCapabilitiesForClaude } from "./config-loader";

const JESSE_STATIC = `
- Interests: fintech metrics, GitHub updates, developer workflow.
- Dietary: no cheese, no dairy. When suggesting food or recipes, avoid dairy and cheese.
`.trim();

const VANESSA_STATIC = `
- Calendar and schedule preferences.
- Music preferences (e.g. Sonos, playlists).
- General home and lifestyle.
`.trim();

function getUserTone(userId: string | undefined, context?: UserContext | null): string {
  const style = context?.communicationStyle ?? "casual";
  if (style === "formal") return "Use a polite, slightly formal tone.";
  return "Use a warm, casual tone.";
}

function getResponseLength(context?: UserContext | null): string {
  return "Keep responses brief and voice-friendly (1-3 sentences when possible).";
}

export function buildGrokSystemPrompt(
  userId?: string | null,
  context?: UserContext | null
): string {
  const parts: string[] = [
    "You are Ara, a warm and friendly home assistant. You are having a conversation only—no home automation or device control in this chat.",
    getUserTone(userId ?? undefined, context),
    getResponseLength(context),
  ];

  if (userId === "jesse") parts.push("\nUser context (Jesse):\n" + JESSE_STATIC);
  else if (userId === "vanessa") parts.push("\nUser context (Vanessa):\n" + VANESSA_STATIC);
  else parts.push("\nThe user has not been identified. Be friendly and concise.");

  if (context?.preferences && Object.keys(context.preferences).length) {
    parts.push("\nLearned preferences (conversation only): " + JSON.stringify(context.preferences));
  }

  return parts.join("\n");
}

export function buildClaudeSystemPrompt(
  userId?: string | null,
  userContext?: UserContext | null,
  taskerConfig?: TaskerConfig | null
): string {
  const parts: string[] = [
    "You are Ara, a voice-first home assistant. Your job is to fulfill home automation and task requests. Use the tools provided to execute Tasker commands, open apps, or speak to the user.",
    "When the user asks for a home control action (lights, music, thermostat, etc.), use execute_tasker_task with the appropriate task name and value. You may call get_app_capabilities to see available tasks.",
    "Ask clarifying questions only when necessary (e.g. which room, which device). If you have learned preferences or context, use them to avoid asking.",
    getUserTone(userId ?? undefined, userContext ?? null),
    getResponseLength(userContext ?? null),
  ];

  if (userId === "jesse") parts.push("\nUser context (Jesse):\n" + JESSE_STATIC);
  else if (userId === "vanessa") parts.push("\nUser context (Vanessa):\n" + VANESSA_STATIC);

  if (userContext?.devicePreferences && Object.keys(userContext.devicePreferences).length) {
    parts.push(
      "\nDevice preferences: " + JSON.stringify(userContext.devicePreferences)
    );
  }
  if (userContext?.failedApproaches?.length) {
    parts.push(
      "\nAvoid these approaches (they failed before): " +
        userContext.failedApproaches.slice(0, 5).join("; ")
    );
  }
  if (userContext?.learningPatterns && Object.keys(userContext.learningPatterns).length) {
    parts.push(
      "\nLearned patterns (use when relevant): " +
        JSON.stringify(userContext.learningPatterns).slice(0, 500)
    );
  }

  if (taskerConfig?.domains && Object.keys(taskerConfig.domains).length) {
    parts.push("\n\n" + formatCapabilitiesForClaude(taskerConfig));
  }

  parts.push(
    "\n\nAfter executing a task, confirm briefly to the user (e.g. 'Done, the lights are on.'). If a tool fails, explain and suggest an alternative if possible. Maximum 5 tool-use turns per request."
  );

  return parts.join("\n");
}
