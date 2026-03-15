import { NextRequest, NextResponse } from "next/server";

const DEBUG_ENDPOINT = "http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33";
const DEBUG_SESSION_ID = "915513";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    const res = await fetch(DEBUG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": DEBUG_SESSION_ID,
      },
      body,
    });

    return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Debug relay failed" },
      { status: 500 }
    );
  }
}
