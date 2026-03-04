import { NextRequest, NextResponse } from "next/server";
import { getDatabase, isDatabaseAvailable } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { interactionId, rating, feedback } = body as {
      interactionId?: string | number;
      rating?: number;
      feedback?: string;
    };

    if (interactionId == null || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: "Missing or invalid interactionId or rating (1-5)" },
        { status: 400 }
      );
    }

    if (!isDatabaseAvailable()) {
      return NextResponse.json({ success: false, message: "Database not available" });
    }

    const db = getDatabase();
    const id = Number(interactionId);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid interactionId" },
        { status: 400 }
      );
    }

    db.prepare(
      "UPDATE interactions SET feedback_score = ? WHERE id = ?"
    ).run(rating, id);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[rate-interaction]", e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
