import { NextResponse } from "next/server";
import { fetchSubstackArticles } from "@/lib/substack-rss";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  try {
    const articles = await fetchSubstackArticles();
    return NextResponse.json(articles, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[substack/articles] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
