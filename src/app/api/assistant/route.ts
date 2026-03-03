import { NextRequest, NextResponse } from "next/server";
import type { SpeakerId } from "@/types/voice";

/**
 * Personal context per speaker (Jesse / Vanessa).
 * Ara uses this to personalize responses.
 */
const JESSE_CONTEXT = `
You are Ara, a warm and friendly home assistant. For this user (Jesse), personalize with:
- Interests: fintech metrics, GitHub updates, developer workflow.
- Dietary: no cheese, no dairy.
- When suggesting food or recipes, avoid dairy and cheese.
`.trim();

const VANESSA_CONTEXT = `
You are Ara, a warm and friendly home assistant. For this user (Vanessa), personalize with:
- Calendar and schedule preferences.
- Music preferences (e.g. Sonos, playlists).
- General home and lifestyle.
`.trim();

function getContextForSpeaker(speakerId: SpeakerId): string {
  switch (speakerId) {
    case "jesse":
      return JESSE_CONTEXT;
    case "vanessa":
      return VANESSA_CONTEXT;
    default:
      return "You are Ara, a warm and friendly home assistant. The user has not been identified.";
  }
}

/**
 * Parse Ara's response for a home control command and return Tasker intent payload.
 * Action: com.jesse.assistant.COMMAND, Extras: { task, value }
 */
function parseTaskerCommand(response: string): { task: string; value: string } | null {
  const lower = response.toLowerCase();
  if (lower.includes("dim the lights") || lower.includes("dim lights")) {
    const match = response.match(/(\d+)/);
    return { task: "dim_lights", value: match ? match[1] : "50" };
  }
  if (lower.includes("turn on lights") || lower.includes("lights on")) {
    return { task: "lights", value: "on" };
  }
  if (lower.includes("turn off lights") || lower.includes("lights off")) {
    return { task: "lights", value: "off" };
  }
  if (lower.includes("play") && (lower.includes("sonos") || lower.includes("music"))) {
    const playWhat = response.replace(/^.*(?:play|music)\s*/i, "").trim() || "music";
    return { task: "sonos_play", value: playWhat };
  }
  return null;
}

const GROK_CHAT_URL = "https://api.x.ai/v1/chat/completions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { speakerId, transcript } = body as { speakerId?: SpeakerId; transcript?: string };

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { message: "Missing or invalid transcript" },
        { status: 400 }
      );
    }

    const context = getContextForSpeaker(speakerId ?? null);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          message: "Grok API key not configured (XAI_API_KEY)",
          taskerCommand: parseTaskerCommand(transcript) ?? undefined,
        },
        { status: 200 }
      );
    }

    const systemContent = `${context}\n\nRespond briefly. If the user gives a home control command (e.g. dim lights, play Sonos), include the exact phrase so the app can send it to Tasker.`;

    const res = await fetch(GROK_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROK_MODEL ?? "grok-3-mini",
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: transcript },
        ],
        max_tokens: 256,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { message: "Grok API error", detail: err },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
    const taskerCommand = parseTaskerCommand(text);

    return NextResponse.json({
      response: text,
      taskerCommand: taskerCommand ?? undefined,
    });
  } catch (e) {
    console.error("[assistant] POST error:", e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
