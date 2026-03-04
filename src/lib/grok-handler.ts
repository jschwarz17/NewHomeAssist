/**
 * Handle conversational (non-task) requests with Grok API.
 */

import { buildUserContext } from "./learning-engine";
import { buildGrokSystemPrompt } from "./prompts";

const GROK_CHAT_URL = "https://api.x.ai/v1/chat/completions";

export type SpeakerId = "jesse" | "vanessa";

export interface GrokChatResult {
  response: string;
  type: "chat";
  model: "grok";
  tokenUsage?: number;
}

export async function handleChatWithGrok(
  transcript: string,
  speakerId?: SpeakerId | null
): Promise<GrokChatResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return {
      response: "I'm not connected to the chat service right now. Check the API key.",
      type: "chat",
      model: "grok",
    };
  }

  let context = null;
  if (speakerId) {
    try {
      context = await buildUserContext(speakerId);
    } catch (e) {
      console.error("[grok-handler] buildUserContext:", e);
    }
  }

  const systemPrompt = buildGrokSystemPrompt(speakerId ?? null, context);

  try {
    const model = process.env.GROK_MODEL ?? "grok-3-mini";
    const res = await fetch(GROK_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
        max_tokens: 150,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[grok-handler] API error:", res.status, err);
      return {
        response: "I had trouble answering that. Can you try again?",
        type: "chat",
        model: "grok",
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const text =
      data?.choices?.[0]?.message?.content?.trim() ??
      "I'm not sure how to respond to that.";
    const tokenUsage = data?.usage?.total_tokens;

    return {
      response: text,
      type: "chat",
      model: "grok",
      tokenUsage,
    };
  } catch (e) {
    console.error("[grok-handler] request failed:", e);
    return {
      response: "Something went wrong on my end. Try again in a moment.",
      type: "chat",
      model: "grok",
    };
  }
}
