import { NextRequest, NextResponse } from "next/server";
import { processUserRequest } from "@/lib/voice-orchestrator";
import type { SpeakerId } from "@/types/voice";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, speakerId } = body as {
      transcript?: string;
      speakerId?: SpeakerId;
    };

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { message: "Missing or invalid transcript" },
        { status: 400 }
      );
    }

    const result = await processUserRequest(transcript.trim(), speakerId ?? null);

    const response: Record<string, unknown> = {
      response: result.response,
      type: result.type,
      model: result.model,
    };
    if (result.metadata) response.metadata = result.metadata;

    if (result.taskerCommands?.length) {
      response.taskerCommands = result.taskerCommands;
    }

    return NextResponse.json(response);
  } catch (e) {
    console.error("[process-request]", e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
