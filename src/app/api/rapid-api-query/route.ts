import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveServices, type RapidApiService } from "@/lib/rapid-api-db";

const MODEL = "claude-3-5-haiku-latest";
const DEFAULT_LOCATION = "Park Slope, Brooklyn, NY";
const DEFAULT_TIMEZONE = "America/New_York";

// ─── Param extraction helpers ──────────────────────────────────────────────

function extractLocation(q: string): string {
  const m = q.match(/(?:in|at|for)\s+([A-Za-z][A-Za-z\s,]+?)(?:\s*\?|$|,\s*(?:right now|today|tonight|tomorrow))/i);
  return m ? m[1].trim() : "";
}

function extractCityForTime(q: string): string {
  const m = q.match(/(?:in|at)\s+([A-Za-z][A-Za-z\s]+?)(?:\s*\?|$)/i);
  return m ? m[1].trim().replace(/\s+/g, "_") : "";
}

function extractLanguageCode(q: string): string {
  const MAP: Record<string, string> = {
    spanish: "es", french: "fr", german: "de", italian: "it", portuguese: "pt",
    japanese: "ja", chinese: "zh", arabic: "ar", korean: "ko", russian: "ru",
    hindi: "hi", dutch: "nl", greek: "el", polish: "pl", turkish: "tr",
    mandarin: "zh", catalan: "ca", swedish: "sv", norwegian: "no", danish: "da",
  };
  const m = q.match(/\b(spanish|french|german|italian|portuguese|japanese|chinese|arabic|korean|russian|hindi|dutch|greek|polish|turkish|mandarin|catalan|swedish|norwegian|danish)\b/i);
  return m ? (MAP[m[1].toLowerCase()] ?? "es") : "es";
}

function extractTextToTranslate(q: string): string {
  const m = q.match(/(?:translate|say|how.*?say|what.*?say)\s+["']?(.+?)["']?\s+(?:in|to|into)\s+\w+/i);
  if (m) return m[1].trim();
  const m2 = q.match(/["'](.+?)["']/);
  return m2 ? m2[1].trim() : q.replace(/translate|how do you say|in \w+/gi, "").trim();
}

function extractTicker(q: string): string {
  const company: Record<string, string> = {
    apple: "AAPL", google: "GOOGL", alphabet: "GOOGL", microsoft: "MSFT",
    amazon: "AMZN", tesla: "TSLA", meta: "META", netflix: "NFLX", nvidia: "NVDA",
    "sp 500": "SPY", "s&p": "SPY", dow: "DIA", nasdaq: "QQQ",
    bitcoin: "BTC-USD", ethereum: "ETH-USD",
  };
  const lower = q.toLowerCase();
  for (const [name, ticker] of Object.entries(company)) {
    if (lower.includes(name)) return ticker;
  }
  const m = q.match(/\b([A-Z]{2,5})\b/);
  return m ? m[1] : "SPY";
}

function extractSearchQuery(q: string, removeWords: string[]): string {
  let s = q;
  for (const w of removeWords) s = s.replace(new RegExp(`\\b${w}\\b`, "gi"), "");
  return s.trim().replace(/\s+/g, " ") || q;
}

function extractRecipeQuery(q: string): string {
  const m = q.match(/(?:recipe|how to|how do|make|cook)\s+(?:for\s+|a\s+|some\s+)?(.+?)(?:\?|$)/i);
  return m ? m[1].trim() : q;
}

function extractMovieQuery(q: string): string {
  const m = q.match(/(?:movie|film|show|series)\s+(?:about|called|named)?\s*["']?(.+?)["']?(?:\?|$)/i);
  return m ? m[1].trim() : "";
}

// ─── WMO weather code → human-readable description ─────────────────────────

const WMO_CODES: Record<number, string> = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "foggy", 48: "icy fog",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
  80: "rain showers", 81: "rain showers", 82: "heavy rain showers",
  85: "snow showers", 86: "heavy snow showers",
  95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with hail",
};

// ─── Open-Meteo weather fetch (free, no key needed) ──────────────────────────

async function callOpenMeteoWeather(location: string): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    // Step 1: geocode
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const geoResp = await fetch(geoUrl);
    if (!geoResp.ok) return { ok: false, error: `Geocoding failed: ${geoResp.status}` };
    const geoData = await geoResp.json() as { results?: { latitude: number; longitude: number; name: string; admin1?: string; country?: string }[] };
    const place = geoData?.results?.[0];
    if (!place) return { ok: false, error: `Location not found: ${location}` };

    // Step 2: fetch weather
    const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
    const wxResp = await fetch(wxUrl);
    if (!wxResp.ok) return { ok: false, error: `Weather fetch failed: ${wxResp.status}` };
    const wxData = await wxResp.json();
    return { ok: true, data: { ...wxData, _location: place } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Inline response formatters (no Claude needed for known services) ──────

function formatWeather(d: unknown): string | null {
  const data = d as {
    current?: { temperature_2m?: number; apparent_temperature?: number; weathercode?: number };
    _location?: { name?: string; admin1?: string };
  };
  const c = data?.current;
  if (!c) return null;
  const temp = c.temperature_2m !== undefined ? `${Math.round(c.temperature_2m)}°F` : null;
  const feels = c.apparent_temperature !== undefined ? `, feels like ${Math.round(c.apparent_temperature)}°F` : "";
  const cond = c.weathercode !== undefined ? (WMO_CODES[c.weathercode] ?? "") : "";
  const locName = data?._location?.name ?? "your area";
  if (temp && cond) return `It's ${temp}${feels} and ${cond} in ${locName}.`;
  if (temp) return `It's ${temp}${feels} in ${locName}.`;
  return null;
}

function formatTime(d: unknown): string | null {
  const data = d as { datetime?: string; timezone?: string };
  if (!data?.datetime) return null;
  const dt = new Date(data.datetime.replace(" ", "T"));
  if (isNaN(dt.getTime())) return null;
  const timeStr = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const tz = data.timezone?.split("/")[1]?.replace(/_/g, " ") ?? "your timezone";
  return `It's ${timeStr} in ${tz}.`;
}

function formatNews(d: unknown): string | null {
  const data = d as { data?: { title?: string }[] };
  const items = (data?.data ?? []).slice(0, 2).map((n) => n.title).filter(Boolean) as string[];
  if (!items.length) return null;
  if (items.length === 1) return `Here's the latest: ${items[0]}.`;
  return `Here are the latest headlines: ${items.join(". And: ")}.`;
}

function formatTranslation(d: unknown): string | null {
  const data = d as { data?: { translations?: { translatedText?: string }[] } };
  return data?.data?.translations?.[0]?.translatedText ?? null;
}

function formatFinance(d: unknown): string | null {
  const data = d as Record<string, unknown>;
  const body = (data?.body ?? data) as Record<string, unknown>;
  const first = Object.values(body)[0] as Record<string, unknown> | undefined;
  if (!first) return null;
  const name = (first.shortName ?? first.longName ?? first.symbol ?? "The stock") as string;
  const price = first.regularMarketPrice as number | undefined;
  const pct = first.regularMarketChangePercent as number | undefined;
  if (price === undefined) return null;
  const dir = pct !== undefined ? (pct >= 0 ? "up" : "down") : "";
  const pctStr = pct !== undefined ? `, ${dir} ${Math.abs(pct).toFixed(2)}% today` : "";
  return `${name} is trading at $${Number(price).toFixed(2)}${pctStr}.`;
}

function formatMovies(d: unknown): string | null {
  const data = d as { results?: { title?: string }[]; data?: { title?: string }[] };
  const list = (data?.results ?? data?.data ?? []).slice(0, 3).map((m) => (m as { title?: string }).title).filter(Boolean) as string[];
  if (!list.length) return null;
  return `Here are some popular movies right now: ${list.join(", ")}.`;
}

function formatRecipes(d: unknown): string | null {
  const data = d as { results?: { title?: string; readyInMinutes?: number }[] };
  const recipes = (data?.results ?? []).slice(0, 2);
  if (!recipes.length) return null;
  const parts = recipes.map((r) => (r.readyInMinutes ? `${r.title} (${r.readyInMinutes} min)` : r.title)).filter(Boolean);
  return `I found these recipes: ${parts.join(" and ")}.`;
}

function formatSports(d: unknown): string | null {
  const data = d as { response?: { teams?: { home?: { name?: string }; away?: { name?: string } }; goals?: { home?: number; away?: number }; fixture?: { status?: { short?: string } } }[] };
  const fixtures = (data?.response ?? []).slice(0, 3);
  if (!fixtures.length) return "There are no live matches right now.";
  const parts = fixtures.map((f) => {
    const home = f.teams?.home?.name ?? "Home";
    const away = f.teams?.away?.name ?? "Away";
    const gh = f.goals?.home;
    const ga = f.goals?.away;
    const status = f.fixture?.status?.short ?? "";
    if (gh !== undefined && ga !== undefined) return `${home} ${gh}–${ga} ${away} (${status})`;
    return `${home} vs ${away}`;
  });
  return `Current matches: ${parts.join("; ")}.`;
}

function formatMusic(d: unknown): string | null {
  const data = d as { tracks?: { items?: { name?: string; artists?: { name?: string }[] }[] }; artists?: { items?: { name?: string }[] } };
  const track = data?.tracks?.items?.[0];
  if (track?.name) {
    const artist = track.artists?.[0]?.name;
    return artist ? `"${track.name}" by ${artist}.` : `"${track.name}".`;
  }
  const artist = data?.artists?.items?.[0]?.name;
  if (artist) return `Top result: ${artist}.`;
  return null;
}

// ─── Direct route map (no Claude needed) ──────────────────────────────────

interface DirectRoute {
  slug: string;
  rapidapi_host: string;
  base_url: string;
  match: RegExp;
  /** If present, completely replaces the RapidAPI call. Receives the raw question. */
  callFn?: (q: string) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  build: (q: string) => { endpoint: string; method: string; params: Record<string, string> };
  format: (data: unknown) => string | null;
}

const DIRECT_ROUTES: DirectRoute[] = [
  {
    slug: "open-meteo-weather",
    rapidapi_host: "",
    base_url: "",
    match: /weather|forecast|temperature|raining|rain|hot outside|cold outside|sunny|cloudy|humid|snow|wind/i,
    callFn: (q) => callOpenMeteoWeather(extractLocation(q) || DEFAULT_LOCATION),
    build: () => ({ endpoint: "", method: "GET", params: {} }),
    format: formatWeather,
  },
  {
    slug: "world-time",
    rapidapi_host: "world-time-by-api-ninjas.p.rapidapi.com",
    base_url: "https://world-time-by-api-ninjas.p.rapidapi.com",
    match: /\btime\b|what time|current time|clock/i,
    build: (q) => {
      const city = extractCityForTime(q);
      const params: Record<string, string> = city ? { city } : { timezone: DEFAULT_TIMEZONE };
      return { endpoint: "/v1/worldtime", method: "GET", params };
    },
    format: formatTime,
  },
  {
    slug: "realtime-news",
    rapidapi_host: "real-time-news-data.p.rapidapi.com",
    base_url: "https://real-time-news-data.p.rapidapi.com",
    match: /news|headlines|latest|what'?s happening|current events/i,
    build: (q) => {
      const query = extractSearchQuery(q, ["news", "headlines", "what's", "whats", "the", "latest", "any", "tell", "me", "about"]);
      return { endpoint: "/search", method: "GET", params: { query: query || "top headlines", country: "US", lang: "en", limit: "5" } };
    },
    format: formatNews,
  },
  {
    slug: "google-translate",
    rapidapi_host: "google-translate1.p.rapidapi.com",
    base_url: "https://google-translate1.p.rapidapi.com",
    match: /translat|how do you say|how to say|what is .+ in \w+|say .+ in \w+/i,
    build: (q) => ({
      endpoint: "/language/translate/v2",
      method: "POST",
      params: { q: extractTextToTranslate(q), target: extractLanguageCode(q) },
    }),
    format: formatTranslation,
  },
  {
    slug: "api-football",
    rapidapi_host: "api-football-v1.p.rapidapi.com",
    base_url: "https://api-football-v1.p.rapidapi.com",
    match: /soccer|football score|match score|game score|standings|premier league|champions league/i,
    build: () => ({ endpoint: "/v3/fixtures", method: "GET", params: { live: "all" } }),
    format: formatSports,
  },
  {
    slug: "imdb",
    rapidapi_host: "imdb236.p.rapidapi.com",
    base_url: "https://imdb236.p.rapidapi.com",
    match: /movie|film|watch|streaming|netflix|hulu|disney|trending|tv show|series|what.*watch/i,
    build: (q) => {
      const query = extractMovieQuery(q);
      const params: Record<string, string> = query ? { query, rows: "5" } : {};
      const endpoint = query ? "/imdb/search" : "/imdb/most-popular-movies";
      return { endpoint, method: "GET", params };
    },
    format: formatMovies,
  },
  {
    slug: "spoonacular",
    rapidapi_host: "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com",
    base_url: "https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com",
    match: /recipe|how to cook|how to make|how do i make|how do i cook|what can i cook|ingredients for/i,
    build: (q) => ({
      endpoint: "/recipes/complexSearch",
      method: "GET",
      params: { query: extractRecipeQuery(q), number: "3" },
    }),
    format: formatRecipes,
  },
  {
    slug: "yahoo-finance",
    rapidapi_host: "yahoo-finance15.p.rapidapi.com",
    base_url: "https://yahoo-finance15.p.rapidapi.com",
    match: /stock|share price|market|ticker|trading|invest|\bcrypto\b|bitcoin|ethereum|\$[A-Z]+|nasdaq|dow jones|s&p/i,
    build: (q) => ({ endpoint: "/api/v1/markets/quote", method: "GET", params: { ticker: extractTicker(q), type: "EQUITY" } }),
    format: formatFinance,
  },
  {
    slug: "spotify",
    rapidapi_host: "spotify23.p.rapidapi.com",
    base_url: "https://spotify23.p.rapidapi.com",
    match: /who sings|who sang|who made|who is the artist|what band|what song|song by|album by|discography/i,
    build: (q) => ({
      endpoint: "/search/",
      method: "GET",
      params: { q: extractSearchQuery(q, ["who", "sings", "sang", "made", "is", "the", "artist", "what", "band", "song", "by"]), type: "multi", limit: "5" },
    }),
    format: formatMusic,
  },
];

// ─── Claude fallback (only for unknown/new tools) ─────────────────────────

function buildCatalogPrompt(services: RapidApiService[]): string {
  return services
    .map((s) => {
      const eps = s.endpoints
        .map((e) => {
          const params = e.params.map((p) => `${p.name} (${p.type}${p.required ? ", required" : ""}): ${p.description}`).join("; ");
          return `  ${e.method} ${e.path} - ${e.description}${params ? `\n    Params: ${params}` : ""}`;
        })
        .join("\n");
      return `[${s.slug}] ${s.name} (${s.category})\n  Host: ${s.rapidapi_host}\n  Base: ${s.base_url}\n  Endpoints:\n${eps}`;
    })
    .join("\n\n");
}

const ROUTER_SYSTEM = `You are an API routing agent. Given a catalog of available RapidAPI services and a user question, determine which service and endpoint best answers the question.

Return ONLY valid JSON (no markdown fences):
{"service_slug":"<slug>","endpoint_path":"<path>","http_method":"GET or POST","params":{"<name>":"<value>"},"rapidapi_host":"<host>","base_url":"<base_url>"}

Rules:
- Default location: Park Slope, Brooklyn, NY. Default timezone: America/New_York.
- If no service fits, return: {"error":"no_matching_service"}`;

const FORMATTER_SYSTEM = `Format this API response into a concise, voice-friendly answer (1-2 sentences). Be natural. Do not mention the API or data source.`;

// ─── Call RapidAPI ─────────────────────────────────────────────────────────

async function callRapidApi(
  rapidKey: string,
  host: string,
  baseUrl: string,
  endpoint: string,
  method: string,
  params: Record<string, string>
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const headers: Record<string, string> = { "X-RapidAPI-Key": rapidKey, "X-RapidAPI-Host": host };
  try {
    let resp: Response;
    if (method.toUpperCase() === "GET") {
      const url = new URL(endpoint, baseUrl);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      resp = await fetch(url.toString(), { method: "GET", headers });
    } else {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      resp = await fetch(`${baseUrl}${endpoint}`, { method: "POST", headers, body: new URLSearchParams(params).toString() });
    }
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return { ok: false, error: `RapidAPI ${resp.status}: ${errText.slice(0, 200)}` };
    }
    return { ok: true, data: await resp.json() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    // #region agent log
    console.log(`[ARA-DEBUG][C] rapid-api-query received question="${question}"`);
    // #endregion
    if (!question || typeof question !== "string") {
      return NextResponse.json({ success: false, error: "Missing question" }, { status: 400 });
    }

    const rapidKey = process.env.RAPID_API_KEY;
    if (!rapidKey) {
      return NextResponse.json({ success: false, error: "RAPID_API_KEY not configured" }, { status: 500 });
    }

    // ── Step 1: Try direct routing (no Claude) ──────────────────────────
    const directRoute = DIRECT_ROUTES.find((r) => r.match.test(question));

    if (directRoute) {
      // #region agent log
      console.log(`[ARA-DEBUG][C] direct route matched slug=${directRoute.slug}`);
      // #endregion
      let result: { ok: boolean; data?: unknown; error?: string };
      if (directRoute.callFn) {
        result = await directRoute.callFn(question);
      } else {
        const { endpoint, method, params } = directRoute.build(question);
        result = await callRapidApi(rapidKey, directRoute.rapidapi_host, directRoute.base_url, endpoint, method, params);
      }

      // #region agent log
      console.log(`[ARA-DEBUG][D] RapidAPI result ok=${result.ok} slug=${directRoute.slug} error=${result.error ?? "none"}`);
      // #endregion

      if (!result.ok) {
        return NextResponse.json({ success: false, answer: "The service returned an error. Try again later.", error: result.error });
      }

      const answer = directRoute.format(result.data);
      if (answer) {
        return NextResponse.json({ success: true, answer, service_used: directRoute.slug, routed_by: "direct" });
      }
      // Formatter couldn't parse — return a best-effort plain summary
      return NextResponse.json({
        success: true,
        answer: `I got a response from ${directRoute.slug} but couldn't format it clearly.`,
        service_used: directRoute.slug,
        routed_by: "direct",
      });
    }

    // ── Step 2: No direct match — fall back to Claude for new/unknown tools
    const claudeKey = process.env.CLAUDE_API_KEY;
    if (!claudeKey) {
      return NextResponse.json({ success: false, error: "No matching service and CLAUDE_API_KEY not configured" }, { status: 500 });
    }

    const services = await getActiveServices();
    if (!services.length) {
      return NextResponse.json({ success: false, answer: "I don't have an external tool for that yet.", error: "no_services" });
    }

    // #region agent log
    console.log(`[ARA-DEBUG][C] no direct route — falling back to Claude routing`);
    // #endregion

    const claude = new Anthropic({ apiKey: claudeKey });
    const catalog = buildCatalogPrompt(services);

    const routerRes = await claude.messages.create({
      model: MODEL, max_tokens: 512, system: ROUTER_SYSTEM,
      messages: [{ role: "user", content: `Available APIs:\n\n${catalog}\n\nUser question: "${question}"` }],
    });

    const routerText = routerRes.content.filter((b) => b.type === "text").map((b) => b.text).join("");

    let routing: { service_slug?: string; endpoint_path?: string; http_method?: string; params?: Record<string, string>; rapidapi_host?: string; base_url?: string; error?: string };
    try { routing = JSON.parse(routerText); } catch {
      return NextResponse.json({ success: false, error: "Claude returned invalid JSON" }, { status: 500 });
    }

    if (routing.error || !routing.rapidapi_host || !routing.base_url || !routing.endpoint_path) {
      return NextResponse.json({ success: false, answer: "I don't have an external tool that can answer that yet.", error: routing.error });
    }

    const fallbackResult = await callRapidApi(rapidKey, routing.rapidapi_host, routing.base_url, routing.endpoint_path, routing.http_method ?? "GET", routing.params ?? {});

    if (!fallbackResult.ok) {
      return NextResponse.json({ success: false, answer: "The external service returned an error.", error: fallbackResult.error });
    }

    // Claude formats the unknown-service response
    const fmtRes = await claude.messages.create({
      model: MODEL, max_tokens: 256, system: FORMATTER_SYSTEM,
      messages: [{ role: "user", content: `User asked: "${question}"\n\nAPI data:\n${JSON.stringify(fallbackResult.data).slice(0, 4000)}\n\nVoice-friendly answer:` }],
    });
    const answer = fmtRes.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();

    return NextResponse.json({ success: true, answer, service_used: routing.service_slug, routed_by: "claude" });

  } catch (err) {
    // #region agent log
    const errMsg = err instanceof Error ? `${err.message}\n${err.stack?.slice(0, 400)}` : String(err);
    console.error("[rapid-api-query] Error:", errMsg);
    // #endregion
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
