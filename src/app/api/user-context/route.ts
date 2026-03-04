import { NextRequest, NextResponse } from "next/server";
import { buildUserContext } from "@/lib/learning-engine";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? "jesse";

    if (!userId) {
      return NextResponse.json(
        { message: "Missing userId" },
        { status: 400 }
      );
    }

    const context = await buildUserContext(userId);
    return NextResponse.json(context);
  } catch (e) {
    console.error("[user-context]", e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
