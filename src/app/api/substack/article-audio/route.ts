import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const XAI_TTS_URL = "https://api.x.ai/v1/tts";
const MAX_TTS_CHARS = 4000;

export async function POST(req: NextRequest) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "XAI_API_KEY not configured" },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as { text?: string };
    const text = String(body.text ?? "").trim();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (text.length > MAX_TTS_CHARS) {
      return NextResponse.json(
        { error: `Text exceeds ${MAX_TTS_CHARS} characters` },
        { status: 400 }
      );
    }

    const response = await fetch(XAI_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text,
        voice_id: "ara",
        output_format: {
          codec: "mp3",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const normalized = errorText.toLowerCase();
      const userFacingError =
        normalized.includes("used all available credits") ||
        normalized.includes("monthly spending limit")
          ? "Ara audio is temporarily unavailable because the xAI account has exhausted its credits or spending limit."
          : "Failed to generate Ara audio";
      return NextResponse.json(
        {
          error: userFacingError,
          detail: errorText.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[substack/article-audio] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate audio" },
      { status: 500 }
    );
  }
}
