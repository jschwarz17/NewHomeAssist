/**
 * Claude agent loop for home automation tasks: multi-turn with tool use.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  buildUserContext,
  storeInteractionLearning,
  recordFailedAutomation,
  recordSuccessfulTask,
} from "./learning-engine";
import { buildClaudeSystemPrompt } from "./prompts";
import { getTaskerConfig, formatCapabilitiesForClaude } from "./config-loader";
import { executeTaskerCommand } from "./tasker-executor";

const MAX_TURNS = 5;
const MODEL = "claude-3-5-haiku-latest";

export type SpeakerId = "jesse" | "vanessa" | null;

export interface TaskExecuted {
  task: string;
  result: string;
  success: boolean;
  value?: string;
}

export interface ExecuteTaskResult {
  success: boolean;
  response: string;
  tasksExecuted: TaskExecuted[];
  learningsStored?: unknown[];
  type: "task";
  model: "claude";
  totalTokens?: number;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "execute_tasker_task",
    description:
      "Execute a Tasker automation. Use the task name from capabilities (e.g. dim_lights, lights, sonos_play, sonos_pause). Pass params like value (e.g. on, off, 50). For Sonos: sonos_play value = 'query' or 'query|device' (e.g. 'Billie Ray Cyrus|Downstairs') to play only on that room; sonos_pause value = room name (e.g. 'Living Room', 'Downstairs') to stop/pause that speaker.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: { type: "string", description: "Task name (e.g. dim_lights, lights, sonos_play, sonos_pause)" },
        value: { type: "string", description: "Value for the task. For sonos_play use 'query' or 'query|device'; for sonos_pause use room name." },
        params: { type: "object", description: "Additional params if needed" },
      },
      required: ["task"],
    },
  },
  {
    name: "open_app",
    description: "Open an app via deep link. Use for launching specific apps.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Deep link or app URL" },
      },
      required: ["url"],
    },
  },
  {
    name: "speak_to_user",
    description: "Speak a message to the user (confirmation or question).",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "What to say" },
        wait_for_response: { type: "boolean", description: "Whether to wait for user reply" },
      },
      required: ["message"],
    },
  },
  {
    name: "query_device_state",
    description: "Check device state (time, battery, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "What to query (e.g. time, battery)" },
      },
    },
  },
  {
    name: "get_app_capabilities",
    description: "Get the list of available Tasker tasks and capabilities.",
    input_schema: { type: "object" as const, properties: {} },
  },
];

type MessageParam = Anthropic.MessageParam;
type ContentBlock = Anthropic.ContentBlock;
type ToolUseBlock = Extract<ContentBlock, { type: "tool_use" }>;

function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === "tool_use";
}

export async function executeTaskWithClaudeAgent(
  transcript: string,
  speakerId?: SpeakerId,
  maxTurns: number = MAX_TURNS
): Promise<ExecuteTaskResult> {
  const startTime = Date.now();
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      response: "Claude is not configured (CLAUDE_API_KEY).",
      tasksExecuted: [],
      type: "task",
      model: "claude",
    };
  }

  const enableLearning =
    process.env.ENABLE_LEARNING !== "false" && process.env.ENABLE_CLAUDE_FOR_TASKS !== "false";

  let userContext = null;
  if (speakerId) {
    try {
      userContext = await buildUserContext(speakerId);
    } catch (e) {
      console.error("[claude-agent] buildUserContext:", e);
    }
  }

  let taskerConfig = null;
  try {
    taskerConfig = await getTaskerConfig();
  } catch (e) {
    console.error("[claude-agent] getTaskerConfig:", e);
  }

  const systemPrompt = buildClaudeSystemPrompt(speakerId ?? null, userContext, taskerConfig);

  const client = new Anthropic({ apiKey });
  const messages: MessageParam[] = [{ role: "user", content: transcript }];

  const tasksExecuted: TaskExecuted[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let turn = 0;
  let lastTextResponse = "";

  while (turn < maxTurns) {
    turn++;
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: TOOLS,
      tool_choice: { type: "auto" },
    });

    const usage = res.usage;
    if (usage) {
      totalInputTokens += usage.input_tokens ?? 0;
      totalOutputTokens += usage.output_tokens ?? 0;
    }

    const content = res.content;
    const textParts: string[] = [];
    const toolUses: ToolUseBlock[] = [];

    for (const block of content) {
      if (block.type === "text") textParts.push(block.text);
      if (isToolUseBlock(block)) toolUses.push(block);
    }
    lastTextResponse = textParts.join("").trim();

    if (res.stop_reason !== "tool_use" || toolUses.length === 0) {
      if (enableLearning && speakerId) {
        await storeInteractionLearning(speakerId, {
          userInput: transcript,
          intentType: "task",
          apiUsed: "claude",
          resultType: tasksExecuted.length ? "success" : "partial",
          actionsTaken: tasksExecuted,
          tokenUsage: totalInputTokens + totalOutputTokens,
          duration: Date.now() - startTime,
        });
      }
      return {
        success: tasksExecuted.length > 0,
        response: lastTextResponse || "I couldn't complete that. Try rephrasing.",
        tasksExecuted,
        type: "task",
        model: "claude",
        totalTokens: totalInputTokens + totalOutputTokens,
      };
    }

    const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

    for (const use of toolUses) {
      const name = use.name;
      const input = use.input as Record<string, unknown>;
      const id = use.id;

      let resultText = "";

      if (name === "execute_tasker_task") {
        const task = (input?.task as string) ?? "";
        const value = (input?.value as string) ?? "";
        const params = (input?.params as Record<string, unknown>) ?? {};
        const exec = await executeTaskerCommand(
          task,
          value ? { ...params, value } : params,
          speakerId ?? undefined
        );
        resultText = exec.success
          ? `Success: task=${exec.task} value=${exec.value}`
          : `Failed: ${exec.error ?? exec.result}`;
        tasksExecuted.push({
          task: exec.task ?? task,
          result: resultText,
          success: exec.success,
          value: exec.value,
        });
        if (speakerId && enableLearning) {
          if (exec.success && exec.task) {
            recordSuccessfulTask(speakerId, exec.task, exec.value ?? "").catch(() => {});
          } else {
            recordFailedAutomation(
              speakerId,
              exec.task ?? task,
              exec.error ?? exec.result
            ).catch(() => {});
          }
        }
      } else if (name === "get_app_capabilities") {
        resultText = taskerConfig
          ? formatCapabilitiesForClaude(taskerConfig)
          : "No config loaded. Check GitHub tasker-config.";
      } else if (name === "speak_to_user") {
        const msg = (input?.message as string) ?? "";
        resultText = `Message would be spoken: ${msg}`;
      } else if (name === "open_app") {
        const url = (input?.url as string) ?? "";
        resultText = `Open app / deep link: ${url}`;
      } else if (name === "query_device_state") {
        const q = (input?.query as string) ?? "time";
        resultText = `Device state query "${q}": (stub) use current time and generic state.`;
      } else {
        resultText = `Unknown tool: ${name}`;
      }

      toolResults.push({ type: "tool_result", tool_use_id: id, content: resultText });
    }

    messages.push({
      role: "assistant",
      content,
    });
    messages.push({
      role: "user",
      content: toolResults,
    });
  }

  if (enableLearning && speakerId) {
    await storeInteractionLearning(speakerId, {
      userInput: transcript,
      intentType: "task",
      apiUsed: "claude",
      resultType: "partial",
      actionsTaken: tasksExecuted,
      tokenUsage: totalInputTokens + totalOutputTokens,
      duration: Date.now() - startTime,
    });
  }

  return {
    success: tasksExecuted.length > 0,
    response:
      lastTextResponse ||
      "I hit the turn limit. Here's what I did: " +
        tasksExecuted.map((t) => t.task).join(", ") +
        ". Say what you'd like next.",
    tasksExecuted,
    type: "task",
    model: "claude",
    totalTokens: totalInputTokens + totalOutputTokens,
  };
}
