import { NextRequest, NextResponse } from "next/server";
import { updatePreference } from "@/lib/learning-engine";
import type { SpeakerId } from "@/types/voice";

export interface NewAction {
  category: string;
  subcategory?: string;
  value: unknown;
  source?: "explicit" | "learned";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, speakerId } = body as {
      action?: NewAction;
      speakerId?: SpeakerId;
    };

    if (!action || typeof action.category !== "string") {
      return NextResponse.json(
        { success: false, message: "Missing or invalid action (need category)" },
        { status: 400 }
      );
    }

    const userId = speakerId ?? "jesse";
    await updatePreference(
      userId,
      action.category,
      action.subcategory ?? "",
      action.value,
      action.source ?? "explicit"
    );

    return NextResponse.json({
      success: true,
      message: "Preference stored",
    });
  } catch (e) {
    console.error("[learn-action]", e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Failed to store" },
      { status: 500 }
    );
  }
}
