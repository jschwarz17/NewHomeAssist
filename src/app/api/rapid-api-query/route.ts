import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveServices, type RapidApiService } from "@/lib/rapid-api-db";

const MODEL = "claude-3-5-haiku-latest";

/** Default location for Ara: Park Slope, Brooklyn, New York */
const DEFAULT_LOCATION = "Park Slope, Brooklyn, NY";
const DEFAULT_TIMEZONE = "America/New_York";

function buildCatalogPrompt(services: RapidApiService[]): string {
  return services
    .map((s) => {
      const eps = s.endpoints
        .map((e) => {
          const params = e.params
            .map((p) => `${p.name} (${p.type}${p.required ? ", required" : ""}): ${p.description}`)
            .join("; ");
          return `  ${e.method} ${e.path} - ${e.description}${params ? `\n    Params: ${params}` : ""}`;
        })
        .join("\n");
      return `[${s.slug}] ${s.name} (${s.category})\n  Host: ${s.rapidapi_host}\n  Base: ${s.base_url}\n  ${s.description}\n  Endpoints:\n${eps}`;
    })
    .join("\n\n");
}

const ROUTER_SYSTEM = `You are an API routing agent. Given a catalog of available RapidAPI services and a user question, determine which service and endpoint best answers the question.

Return ONLY valid JSON (no markdown fences) with these fields:
{
  "service_slug": "<slug from catalog>",
  "endpoint_path": "<endpoint path>",
  "http_method": "GET or POST",
  "params": { "<param_name>": "<value>" },
  "rapidapi_host": "<host from catalog>",
  "base_url": "<base_url from catalog>"
}

Rules:
- Pick the single best endpoint for the question.
- Fill in params with concrete values derived from the question.
- Default location: Ara's home is Park Slope, Brooklyn, New York. For WEATHER (or any location param like q, city, location) when the user does not specify a place, use "Park Slope, Brooklyn, NY" or "Brooklyn, NY" so results are for that area.
- Default time: For current time / "what time is it" with no city or timezone given, use timezone "America/New_York" (Park Slope is in Eastern time). Only use another timezone or city when the user explicitly asks for a different place.
- If no service can answer the question, return: { "error": "no_matching_service" }`;

const FORMATTER_SYSTEM = `Format the API response data into a concise, voice-friendly answer (1-2 sentences). 
Be natural and conversational. Do not mention the API or data source. 
If the data is unclear or empty, say you couldn't find the answer.`;

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    // #region agent log
    console.log(`[ARA-DEBUG][C] rapid-api-query received question="${question}"`);
    // #endregion
    if (!question || typeof question !== "string") {
      return NextResponse.json({ success: false, error: "Missing question" }, { status: 400 });
    }

    const claudeKey = process.env.CLAUDE_API_KEY;
    const rapidKey = process.env.RAPID_API_KEY;
    if (!claudeKey) {
      return NextResponse.json({ success: false, error: "CLAUDE_API_KEY not configured" }, { status: 500 });
    }
    if (!rapidKey) {
      return NextResponse.json({ success: false, error: "RAPID_API_KEY not configured" }, { status: 500 });
    }

    const services = await getActiveServices();
    if (services.length === 0) {
      return NextResponse.json(
        { success: false, error: "No RapidAPI services configured. Run the seed script first." },
        { status: 500 }
      );
    }

    const catalog = buildCatalogPrompt(services);
    const claude = new Anthropic({ apiKey: claudeKey });

    // Step 1: Ask Claude to pick the right service and build the request
    const routerRes = await claude.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: ROUTER_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Default location for weather/location: ${DEFAULT_LOCATION}. Default timezone for current time: ${DEFAULT_TIMEZONE}. Use these when the user does not specify a place.\n\nAvailable APIs:\n\n${catalog}\n\nUser question: "${question}"`,
        },
      ],
    });

    const routerText = routerRes.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let routing: {
      service_slug?: string;
      endpoint_path?: string;
      http_method?: string;
      params?: Record<string, string>;
      rapidapi_host?: string;
      base_url?: string;
      error?: string;
    };

    // #region agent log
    console.log(`[ARA-DEBUG][C] Claude router response="${routerText.slice(0,400)}"`);
    // #endregion
    try {
      routing = JSON.parse(routerText);
    } catch {
      console.error("[rapid-api-query] Claude returned non-JSON:", routerText);
      return NextResponse.json({ success: false, error: "Failed to parse routing response" }, { status: 500 });
    }

    if (routing.error) {
      return NextResponse.json({
        success: false,
        answer: "I don't have an external tool that can answer that question yet.",
        error: routing.error,
      });
    }

    if (!routing.rapidapi_host || !routing.base_url || !routing.endpoint_path) {
      return NextResponse.json({ success: false, error: "Incomplete routing from Claude" }, { status: 500 });
    }

    // Step 2: Call the RapidAPI endpoint
    const method = (routing.http_method || "GET").toUpperCase();
    const headers: Record<string, string> = {
      "X-RapidAPI-Key": rapidKey,
      "X-RapidAPI-Host": routing.rapidapi_host,
    };

    let apiResponse: Response;

    if (method === "GET") {
      const url = new URL(routing.endpoint_path, routing.base_url);
      if (routing.params) {
        for (const [k, v] of Object.entries(routing.params)) {
          url.searchParams.set(k, String(v));
        }
      }
      apiResponse = await fetch(url.toString(), { method: "GET", headers });
    } else {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      const body = new URLSearchParams(routing.params || {}).toString();
      const url = `${routing.base_url}${routing.endpoint_path}`;
      apiResponse = await fetch(url, { method: "POST", headers, body });
    }

    // #region agent log
    console.log(`[ARA-DEBUG][D] RapidAPI call status=${apiResponse.status} slug=${routing.service_slug} url=${routing.base_url}${routing.endpoint_path}`);
    // #endregion
    if (!apiResponse.ok) {
      const errText = await apiResponse.text().catch(() => "");
      console.error(`[rapid-api-query] API ${apiResponse.status}:`, errText.slice(0, 500));
      return NextResponse.json({
        success: false,
        answer: "The external service returned an error. Please try again later.",
        error: `RapidAPI ${apiResponse.status}`,
      });
    }

    const apiData = await apiResponse.json();
    const dataStr = JSON.stringify(apiData).slice(0, 4000);

    // Step 3: Ask Claude to format the response for voice
    const formatterRes = await claude.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: FORMATTER_SYSTEM,
      messages: [
        {
          role: "user",
          content: `User asked: "${question}"\n\nAPI response data:\n${dataStr}\n\nProvide a concise voice-friendly answer.`,
        },
      ],
    });

    const answer = formatterRes.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({
      success: true,
      answer,
      service_used: routing.service_slug,
    });
  } catch (err) {
    // #region agent log
    const errMsg = err instanceof Error ? `${err.message}\n${err.stack?.slice(0,400)}` : String(err);
    console.error("[rapid-api-query] Error:", errMsg);
    // #endregion
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
