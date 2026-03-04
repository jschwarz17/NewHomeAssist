/**
 * Main entry: route user request to Grok (chat) or Claude (task), return response + optional tasker commands.
 */

import { classifyIntent } from "./intent-classifier";
import { handleChatWithGrok } from "./grok-handler";
import { executeTaskWithClaudeAgent } from "./claude-agent";
import { storeInteractionLearning } from "./learning-engine";

export type SpeakerId = "jesse" | "vanessa" | null;

export interface ProcessUserRequestResult {
  response: string;
  type: "task" | "chat";
  model: "claude" | "grok";
  metadata?: Record<string, unknown>;
  taskerCommands?: Array<{ task: string; value: string }>;
}

export async function processUserRequest(
  transcript: string,
  speakerId?: SpeakerId
): Promise<ProcessUserRequestResult> {
  const enableGrok = process.env.ENABLE_GROK_FOR_CHAT !== "false";
  const enableClaude = process.env.ENABLE_CLAUDE_FOR_TASKS !== "false";

  try {
    const { type: intentType, confidence } = await classifyIntent(transcript);

    if (intentType === "chat" && enableGrok) {
      const grokResult = await handleChatWithGrok(transcript, speakerId ?? null);
      if (speakerId && process.env.ENABLE_LEARNING !== "false") {
        try {
          await storeInteractionLearning(speakerId, {
            userInput: transcript,
            intentType: "chat",
            apiUsed: "grok",
            resultType: "success",
            actionsTaken: [],
            tokenUsage: grokResult.tokenUsage ?? 0,
            duration: 0,
          });
        } catch {
          // ignore
        }
      }
      return {
        response: grokResult.response,
        type: "chat",
        model: "grok",
        metadata: { confidence, tokenUsage: grokResult.tokenUsage },
      };
    }

    if (intentType === "task" && enableClaude) {
      const agentResult = await executeTaskWithClaudeAgent(
        transcript,
        speakerId ?? null
      );

      const taskerCommands: Array<{ task: string; value: string }> = agentResult.tasksExecuted
        .filter((t) => t.success && t.task)
        .map((t) => ({ task: t.task!, value: t.value ?? "" }));

      return {
        response: agentResult.response,
        type: "task",
        model: "claude",
        metadata: {
          success: agentResult.success,
          tasksExecuted: agentResult.tasksExecuted,
          totalTokens: agentResult.totalTokens,
        },
        taskerCommands: taskerCommands.length ? taskerCommands : undefined,
      };
    }

    if (intentType === "task" && !enableClaude) {
      return {
        response: "Task handling is disabled. Enable Claude for tasks.",
        type: "task",
        model: "grok",
      };
    }

    return handleChatWithGrok(transcript, speakerId ?? null).then((r) => ({
      response: r.response,
      type: "chat" as const,
      model: "grok" as const,
      metadata: { confidence },
    }));
  } catch (e) {
    console.error("[voice-orchestrator] processUserRequest:", e);
    if (speakerId && process.env.ENABLE_LEARNING !== "false") {
      try {
        await storeInteractionLearning(speakerId, {
          userInput: transcript,
          intentType: "task",
          apiUsed: "claude",
          resultType: "failure",
          actionsTaken: [],
          tokenUsage: 0,
          duration: 0,
        });
      } catch {
        // ignore
      }
    }
    return {
      response: "Something went wrong. Please try again.",
      type: "chat",
      model: "grok",
      metadata: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}
