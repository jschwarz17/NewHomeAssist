import { NextRequest, NextResponse } from "next/server";
import { fetchExtractedArticle } from "@/lib/article-content";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "URL parameter required" }, { status: 400 });
  }

  try {
    const article = await fetchExtractedArticle(url);
    return NextResponse.json(article);
  } catch (error) {
    console.error("[substack/article-content] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch article content" },
      { status: 500 }
    );
  }
}
