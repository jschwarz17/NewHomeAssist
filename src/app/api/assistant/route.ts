import { NextRequest, NextResponse } from "next/server";
import type { SpeakerId } from "@/types/voice";

/**
 * Personal context per speaker (Jesse / Vanessa).
 * In production, load from a DB or env; here we inline for the blueprint.
 */
const JESSE_CONTEXT = `
You are assisting Jesse. Personalize responses with:
- Interests: fintech metrics, GitHub updates, developer workflow.
- Dietary: no cheese, no dairy.
- When suggesting food or recipes, avoid dairy and cheese.
`.trim();

const VANESSA_CONTEXT = `
You are assisting Vanessa. Personalize responses with:
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
      return "You are a helpful home assistant. The user has not been identified.";
  }
}

/**
 * Parses Gemini response for a home control command and returns Tasker intent payload.
 * Action: com.jesse.assistant.COMMAND, Extras: { task, value }
 */
function parseTaskerCommand(geminiResponse: string): { task: string; value: string } | null {
  const lower = geminiResponse.toLowerCase();
  if (lower.includes("dim the lights") || lower.includes("dim lights")) {
    const match = geminiResponse.match(/(\d+)/);
    return { task: "dim_lights", value: match ? match[1] : "50" };
  }
  if (lower.includes("turn on lights") || lower.includes("lights on")) {
    return { task: "lights", value: "on" };
  }
  if (lower.includes("turn off lights") || lower.includes("lights off")) {
    return { task: "lights", value: "off" };
  }
  if (lower.includes("play") && (lower.includes("sonos") || lower.includes("music"))) {
    const playWhat = geminiResponse.replace(/^.*(?:play|music)\s*/i, "").trim() || "music";
    return { task: "sonos_play", value: playWhat };
  }
  return null;
}

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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          message: "Gemini API key not configured",
          taskerCommand: parseTaskerCommand(transcript) ?? undefined,
        },
        { status: 200 }
      );
    }

    const prompt = `${context}\n\nUser said: "${transcript}"\n\nRespond briefly. If this is a home control command (e.g. dim lights, play Sonos), include the exact phrase so the app can send it to Tasker.`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 256 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { message: "Gemini API error", detail: err },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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
