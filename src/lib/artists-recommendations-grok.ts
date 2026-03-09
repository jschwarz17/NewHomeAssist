/**
 * Single Grok API call for indie rock artist recommendations.
 */

export interface ArtistItem {
  name: string;
  description: string;
  genre: string;
  spotifyId: string | null;
  spotifyTrackUri: string | null;
  imageUrl: string | null;
}

export interface ArtistsResult {
  artists: ArtistItem[];
  cachedAt: number;
  version: number;
}

const ARTISTS_SYSTEM_PROMPT = `You are Grok, helping to curate a list of the top 10 most interesting new indie rock artists. The user likes Radiohead, Foals, and Queens of the Stone Age (QOTSA) as reference points. These bands are known for their experimental sound, complex arrangements, atmospheric textures, and dynamic shifts.

Your task: Recommend exactly 10 new indie rock artists (released music in the last 2-3 years) that would appeal to someone who likes Radiohead, Foals, and QOTSA. Focus on artists with:
- Experimental or atmospheric elements
- Complex, layered instrumentation
- Dynamic range (quiet to loud)
- Interesting production techniques
- Unique vocal styles or instrumental approaches

For each artist, provide:
1. Artist name
2. A 2-3 sentence description explaining why they're interesting and how they relate to the reference bands
3. Genre tags (e.g., "indie rock", "post-rock", "art rock", "experimental rock")
4. Spotify artist ID (if you can find it via web search)
5. A specific track URI from Spotify (one song to preview - choose a representative track)
6. Artist image URL (official photo or album art)

Output format (strictly follow this, no extra text, no lists outside the sections):

ARTISTS

Artist Name
[Insert artist image URL here using Grok's image search/render capability]
Description: [2-3 sentences about why this artist is interesting and how they relate to Radiohead/Foals/QOTSA]
Genre: [comma-separated genres]
Spotify Artist ID: [spotify:artist:XXXXX or null if not found]
Spotify Track URI: [spotify:track:XXXXX - one representative song, or null if not found]

(Repeat for all 10 artists)

Never skip the ---JSON--- block. Always end your response with the ---JSON--- block containing every artist you listed.`;

const CACHE_VERSION = 1;

export type ParseFailureReason = "no_json_marker" | "no_brace" | "json_parse_error" | "empty_artists";

function parseGrokResponse(raw: string): { artists: ArtistItem[] } | { error: ParseFailureReason } {
  const jsonMarker = "---JSON---";
  const idx = raw.indexOf(jsonMarker);
  if (idx === -1) return { error: "no_json_marker" };
  let jsonStr = raw.slice(idx + jsonMarker.length).replace(/^[\s\n]+/, "").trim();
  jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const firstBrace = jsonStr.indexOf("{");
  if (firstBrace === -1) return { error: "no_brace" };
  let depth = 0;
  let end = firstBrace;
  for (let i = firstBrace; i < jsonStr.length; i++) {
    if (jsonStr[i] === "{") depth++;
    if (jsonStr[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const slice = jsonStr.slice(firstBrace, end);
  let obj: {
    artists?: Array<{
      name?: string;
      description?: string;
      genre?: string;
      spotifyId?: string | null;
      spotifyTrackUri?: string | null;
      imageUrl?: string | null;
    }>;
  };
  try {
    obj = JSON.parse(slice) as typeof obj;
  } catch {
    return { error: "json_parse_error" };
  }
  const toItem = (
    o: {
      name?: string;
      description?: string;
      genre?: string;
      spotifyId?: string | null;
      spotifyTrackUri?: string | null;
      imageUrl?: string | null;
    }
  ): ArtistItem => ({
    name: o.name ?? "",
    description: o.description ?? "",
    genre: o.genre ?? "indie rock",
    spotifyId: o.spotifyId && o.spotifyId.startsWith("spotify:artist:") ? o.spotifyId : null,
    spotifyTrackUri: o.spotifyTrackUri && o.spotifyTrackUri.startsWith("spotify:track:") ? o.spotifyTrackUri : null,
    imageUrl: o.imageUrl && o.imageUrl.startsWith("http") ? o.imageUrl : null,
  });
  const artists: ArtistItem[] = (obj.artists ?? []).map((o) => toItem(o));
  if (artists.length === 0) return { error: "empty_artists" };
  return { artists };
}

async function callGrokAndParse(apiKey: string): Promise<ArtistsResult> {
  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast",
      tools: [{ type: "web_search" }],
      input: [
        { role: "system", content: ARTISTS_SYSTEM_PROMPT },
        { role: "user", content: "Generate my top 10 indie rock artist recommendations now. Use Radiohead, Foals, and Queens of the Stone Age as reference points. For each artist, find their Spotify artist ID and a representative track URI. Output the 10 artists in the format specified, then the ---JSON--- block with all details." },
      ],
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Grok API error: ${res.status} — ${bodyText.slice(0, 200)}`);
  }

  let data: { output?: unknown[] };
  try {
    data = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    throw new Error(
      "Grok API returned invalid JSON (empty or truncated). Try again in a moment."
    );
  }

  type OutputItem = { type: string; content?: { type: string; text: string }[] };
  const messageItem = (data.output as OutputItem[] | undefined)?.find((o) => o.type === "message");
  const contentBlocks = messageItem?.content ?? [];
  const outputTextBlocks = contentBlocks.filter((c): c is { type: string; text: string } => c.type === "output_text");
  const raw = messageItem?.content?.find((c) => c.type === "output_text")?.text ?? "";

  const parsed = parseGrokResponse(raw);
  if ("error" in parsed) {
    const reason = parsed.error;
    const snippet = raw.length > 800 ? raw.slice(-800) : raw;
    const msg =
      reason === "no_json_marker"
        ? "Grok did not include ---JSON--- block in response"
        : reason === "no_brace"
          ? "Grok's ---JSON--- block had no JSON object"
          : reason === "json_parse_error"
            ? "Grok's JSON after ---JSON--- failed to parse"
            : "Grok returned empty artists array";
    throw new Error(
      `Grok did not return valid structured data: ${msg}. Raw tail: ${snippet.replace(/\n/g, " ").slice(0, 400)}`
    );
  }

  return {
    artists: parsed.artists,
    cachedAt: Date.now(),
    version: CACHE_VERSION,
  };
}

/** Calls Grok and returns parsed recommendations. Retries once on structured-data parse failure. Throws on API or parse failure. */
export async function fetchArtistsFromGrok(apiKey: string): Promise<ArtistsResult> {
  try {
    return await callGrokAndParse(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Grok did not return valid structured data") && message.includes("Raw tail:")) {
      console.warn("[artists-recommendations-grok] First attempt failed, retrying once...");
      return await callGrokAndParse(apiKey);
    }
    throw err;
  }
}
