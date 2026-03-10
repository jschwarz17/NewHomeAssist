import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const XAI_TTS_URL = "https://api.x.ai/v1/tts";
const MAX_TTS_CHARS = 4000;
const GOOGLE_TTS_SEGMENT_CHARS = 180;

function splitForGoogleTts(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const segments: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) segments.push(trimmed);
    current = "";
  };

  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;

    if (!current) {
      if (piece.length <= GOOGLE_TTS_SEGMENT_CHARS) {
        current = piece;
      } else {
        for (let i = 0; i < piece.length; i += GOOGLE_TTS_SEGMENT_CHARS) {
          segments.push(piece.slice(i, i + GOOGLE_TTS_SEGMENT_CHARS));
        }
      }
      continue;
    }

    const next = `${current} ${piece}`;
    if (next.length <= GOOGLE_TTS_SEGMENT_CHARS) {
      current = next;
    } else {
      flush();
      if (piece.length <= GOOGLE_TTS_SEGMENT_CHARS) {
        current = piece;
      } else {
        for (let i = 0; i < piece.length; i += GOOGLE_TTS_SEGMENT_CHARS) {
          segments.push(piece.slice(i, i + GOOGLE_TTS_SEGMENT_CHARS));
        }
      }
    }
  }

  flush();
  return segments;
}

function concatBuffers(buffers: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const totalLength = buffers.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of buffers) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

async function synthesizeGoogleTts(text: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const segments = splitForGoogleTts(text);
  if (segments.length === 0) return null;

  const chunks: Uint8Array<ArrayBuffer>[] = [];
  for (const segment of segments) {
    const params = new URLSearchParams({
      ie: "UTF-8",
      tl: "en",
      client: "tw-ob",
      q: segment,
    });
    const response = await fetch(`https://translate.google.com/translate_tts?${params}`, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (!buffer.length) {
      return null;
    }
    chunks.push(buffer);
  }

  return concatBuffers(chunks);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.XAI_API_KEY;

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

    if (!apiKey) {
      const googleAudio = await synthesizeGoogleTts(text);
      if (!googleAudio) {
        return NextResponse.json(
          { error: "Ara audio is temporarily unavailable." },
          { status: 503 }
        );
      }
      const googleBlob = new Blob([googleAudio], { type: "audio/mpeg" });
      return new Response(
        googleBlob,
        {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        }
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
      const shouldFallbackToGoogle =
        normalized.includes("used all available credits") ||
        normalized.includes("monthly spending limit") ||
        normalized.includes("insufficient") ||
        normalized.includes("quota");

      if (shouldFallbackToGoogle) {
        const googleAudio = await synthesizeGoogleTts(text);
        if (googleAudio) {
          const googleBlob = new Blob([googleAudio], { type: "audio/mpeg" });
          return new Response(
            googleBlob,
            {
              headers: {
                "Content-Type": "audio/mpeg",
                "Cache-Control": "no-store",
              },
            }
          );
        }
      }

      return NextResponse.json(
        {
          error: "Failed to generate Ara audio",
          detail: errorText.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
        headers: {
        "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
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
