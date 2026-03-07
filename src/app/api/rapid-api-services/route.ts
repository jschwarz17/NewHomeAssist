import { NextRequest, NextResponse } from "next/server";
import { getAllServices, addService } from "@/lib/rapid-api-db";

export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get("category") ?? undefined;
    const services = await getAllServices(category);
    return NextResponse.json({ services });
  } catch (err) {
    console.error("[rapid-api-services] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, category, description, rapidapi_host, base_url, endpoints } = body;

    if (!name || !slug || !category || !description || !rapidapi_host || !base_url) {
      return NextResponse.json(
        { error: "Missing required fields: name, slug, category, description, rapidapi_host, base_url" },
        { status: 400 }
      );
    }

    const service = await addService({
      name,
      slug,
      category,
      description,
      rapidapi_host,
      base_url,
      endpoints: endpoints ?? [],
    });

    return NextResponse.json({ service }, { status: 201 });
  } catch (err) {
    console.error("[rapid-api-services] POST error:", err);
    return NextResponse.json({ error: "Failed to add service" }, { status: 500 });
  }
}
