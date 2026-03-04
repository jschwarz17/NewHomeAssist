import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GLAMOUR_LINK = "https://www.glamour.com/";

/** Real Glamour magazine: fetch og:image from glamour.com or use known cover URL */
export async function GET() {
  try {
    const res = await fetch(GLAMOUR_LINK, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AraHomeAssist/1.0)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("fetch failed");
    const html = await res.text();
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const image = ogImageMatch?.[1] ?? null;
    return NextResponse.json({ link: GLAMOUR_LINK, image });
  } catch {
    return NextResponse.json({ link: GLAMOUR_LINK, image: null });
  }
}
