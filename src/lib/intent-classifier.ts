/**
 * Classify user input as "task" (home automation) or "chat" (conversational).
 * Rule-based first, then regex, then optional Claude Haiku fallback.
 */

const TASK_KEYWORDS = new Set([
  "turn",
  "open",
  "play",
  "dim",
  "set",
  "start",
  "stop",
  "lock",
  "unlock",
  "close",
  "execute",
  "run",
  "brighten",
  "switch",
  "pause",
  "resume",
]);

const CHAT_KEYWORDS = new Set([
  "what",
  "tell",
  "explain",
  "news",
  "weather",
  "how",
  "why",
  "when",
  "who",
  "joke",
  "think",
  "opinion",
  "meaning",
  "where",
  "what's",
  "define",
]);

const DEVICE_KEYWORDS = new Set([
  "lights",
  "music",
  "temperature",
  "thermostat",
  "door",
  "blinds",
  "coffee",
  "garage",
  "sonos",
  "spotify",
  "light",
  "lamp",
]);

const TASK_START_PATTERN = /^(turn|switch|set|dim|brighten|play|pause|stop|start|open|close|lock|unlock)\b/i;
const CHAT_START_PATTERN = /^(what|tell|explain|how|why|when|who|where|what's)\b/i;

const CONFIDENCE_THRESHOLD = 0.8;

const classificationCache = new Map<string, { type: "task" | "chat"; confidence: number }>();

function normalizeForCache(transcript: string): string {
  return transcript.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface ClassifyIntentResult {
  type: "task" | "chat";
  confidence: number;
  reasoning?: string;
}

export async function classifyIntent(
  transcript: string,
  _previousClassifications?: Map<string, "task" | "chat">
): Promise<ClassifyIntentResult> {
  const normalized = normalizeForCache(transcript);
  const cached = classificationCache.get(normalized);
  if (cached) {
    return { type: cached.type, confidence: cached.confidence };
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  let taskScore = 0;
  let chatScore = 0;
  const reasons: string[] = [];

  if (TASK_START_PATTERN.test(normalized)) {
    taskScore += 2;
    reasons.push("task_start_pattern");
  }
  if (CHAT_START_PATTERN.test(normalized)) {
    chatScore += 2;
    reasons.push("chat_start_pattern");
  }

  for (const w of words) {
    const lower = w.toLowerCase();
    if (TASK_KEYWORDS.has(lower)) taskScore++;
    if (CHAT_KEYWORDS.has(lower)) chatScore++;
    if (DEVICE_KEYWORDS.has(lower)) taskScore++;
  }

  const total = taskScore + chatScore;
  let type: "task" | "chat";
  let confidence: number;
  if (total === 0) {
    type = "chat";
    confidence = 0.5;
    reasons.push("no_keywords_default_chat");
  } else if (taskScore > chatScore) {
    type = "task";
    confidence = Math.min(0.99, 0.6 + (taskScore - chatScore) * 0.1);
    reasons.push("task_keywords_win");
  } else if (chatScore > taskScore) {
    type = "chat";
    confidence = Math.min(0.99, 0.6 + (chatScore - taskScore) * 0.1);
    reasons.push("chat_keywords_win");
  } else {
    type = "chat";
    confidence = 0.6;
    reasons.push("tie_default_chat");
  }

  if (confidence < CONFIDENCE_THRESHOLD) {
    const fallback = await classifyWithClaude(transcript);
    if (fallback) {
      type = fallback.type;
      confidence = fallback.confidence;
      reasons.push("claude_fallback");
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.log("[intent-classifier] low confidence, no fallback:", { transcript, confidence, reasons });
      }
    }
  }

  classificationCache.set(normalized, { type, confidence });
  if (classificationCache.size > 500) {
    const first = classificationCache.keys().next().value;
    if (first) classificationCache.delete(first);
  }

  return {
    type,
    confidence,
    reasoning: reasons.join(", "),
  };
}

async function classifyWithClaude(transcript: string): Promise<ClassifyIntentResult | null> {
  const key = process.env.CLAUDE_API_KEY;
  if (!key) return null;

  try {
    const { Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 32,
      messages: [
        {
          role: "user",
          content: `Classify this user message as exactly one word: "task" or "chat". Task = home automation, control devices, run something. Chat = question, news, weather, joke, opinion, conversation. Reply with only the word.\n\nMessage: ${transcript}`,
        },
      ],
    });

    const text = (msg.content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text!)
      .join("")
      .trim()
      .toLowerCase();
    const type = text.includes("task") ? "task" : "chat";
    return { type, confidence: 0.85 };
  } catch (e) {
    console.error("[intent-classifier] Claude fallback error:", e);
    return null;
  }
}
