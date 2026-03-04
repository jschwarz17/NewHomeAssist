import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
  "https://localhost",
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:3000",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((o) => origin.startsWith(o));
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (isAllowedOrigin(origin)) {
      res.headers.set("Access-Control-Allow-Origin", origin!);
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type");
      res.headers.set("Access-Control-Max-Age", "86400");
    }
    return res;
  }

  const res = NextResponse.next();
  if (isAllowedOrigin(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin!);
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
