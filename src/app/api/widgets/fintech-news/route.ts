import { NextResponse } from "next/server";
import { fetchSubstackArticles } from "@/lib/substack-rss";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type Story = { title: string; url: string };

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const { fintech: articles } = await fetchSubstackArticles();
    const stories: Story[] = articles
      .slice(0, 5)
      .filter((a) => a.title && a.link)
      .map((a) => ({ title: a.title, url: a.link }));
    return json({ stories });
  } catch {
    return json({ stories: [] });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
