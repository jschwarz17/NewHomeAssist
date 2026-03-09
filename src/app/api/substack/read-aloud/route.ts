import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Use Grok to read article content aloud via text-to-speech.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "XAI_API_KEY not set" }, { status: 500 });
  }

  try {
    const { content, title } = await req.json();
    if (!content) {
      return NextResponse.json({ error: "Content required" }, { status: 400 });
    }

    // Use Grok's text-to-speech capability
    // Note: This is a simplified version - you may need to use a dedicated TTS service
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4-1-fast",
        input: [
          {
            role: "system",
            content: "You are a text-to-speech assistant. Read the article content clearly and naturally.",
          },
          {
            role: "user",
            content: `Please read this article aloud: ${title ? `Title: ${title}\n\n` : ""}${content}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const data = await response.json();
    const audioText = data.output?.[0]?.content?.[0]?.text || "";

    return NextResponse.json({ audioText, success: true });
  } catch (error) {
    console.error("[substack/read-aloud] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
