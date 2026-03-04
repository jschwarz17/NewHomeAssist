import { NextRequest, NextResponse } from "next/server";
import { classifyIntent } from "@/lib/intent-classifier";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transcript = body?.transcript;
    if (typeof transcript !== "string") {
      return NextResponse.json(
        { message: "Missing or invalid transcript" },
        { status: 400 }
      );
    }
    const result = await classifyIntent(transcript);
    return NextResponse.json({
      type: result.type,
      confidence: result.confidence,
      reasoning: result.reasoning,
    });
  } catch (e) {
    console.error("[classify-intent]", e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
