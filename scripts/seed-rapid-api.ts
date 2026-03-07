/**
 * Seed script: populates the rapid_api_services table in Vercel Postgres (Neon)
 * with a curated set of starter APIs.
 *
 * Usage:  npx tsx scripts/seed-rapid-api.ts
 * Requires DATABASE_URL (or POSTGRES_URL) in .env or .env.local
 */

import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

const envFiles = [".env.local", ".env"];
for (const f of envFiles) {
  const p = path.resolve(process.cwd(), f);
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    }
  }
}

const SERVICES = [
  {
    name: "WeatherAPI.com",
    slug: "weatherapi",
    category: "weather",
    description:
      "Real-time weather, forecasts, search/autocomplete, astronomy, and time zone data for any location worldwide.",
    rapidapi_host: "weatherapi-com.p.rapidapi.com",
    base_url: "https://weatherapi-com.p.rapidapi.com",
    endpoints: [
      {
        path: "/current.json",
        method: "GET",
        description: "Current weather for a location",
        params: [
          { name: "q", type: "string", required: true, description: "City name, zip code, IP, or lat,lon" },
        ],
      },
      {
        path: "/forecast.json",
        method: "GET",
        description: "Weather forecast up to 10 days",
        params: [
          { name: "q", type: "string", required: true, description: "Location query" },
          { name: "days", type: "number", required: false, description: "Number of forecast days (1-10)" },
        ],
      },
      {
        path: "/search.json",
        method: "GET",
        description: "Search or autocomplete locations",
        params: [
          { name: "q", type: "string", required: true, description: "Location search query" },
        ],
      },
      {
        path: "/astronomy.json",
        method: "GET",
        description: "Sunrise, sunset, moonrise, moonset, moon phase",
        params: [
          { name: "q", type: "string", required: true, description: "Location query" },
          { name: "dt", type: "string", required: false, description: "Date in yyyy-MM-dd format" },
        ],
      },
    ],
  },
  {
    name: "World Time by API-Ninjas",
    slug: "world-time",
    category: "time",
    description: "Get the current time for any city or timezone in the world.",
    rapidapi_host: "world-time-by-api-ninjas.p.rapidapi.com",
    base_url: "https://world-time-by-api-ninjas.p.rapidapi.com",
    endpoints: [
      {
        path: "/v1/worldtime",
        method: "GET",
        description: "Current time for a city or timezone",
        params: [
          { name: "city", type: "string", required: false, description: "City name (e.g. Tokyo)" },
          { name: "timezone", type: "string", required: false, description: "Timezone (e.g. America/New_York)" },
        ],
      },
    ],
  },
  {
    name: "Spotify",
    slug: "spotify",
    category: "music",
    description:
      "Search tracks, artists, albums, playlists. Get artist info, top tracks, album details, and recommendations.",
    rapidapi_host: "spotify23.p.rapidapi.com",
    base_url: "https://spotify23.p.rapidapi.com",
    endpoints: [
      {
        path: "/search/",
        method: "GET",
        description: "Search for tracks, artists, albums, or playlists",
        params: [
          { name: "q", type: "string", required: true, description: "Search query" },
          { name: "type", type: "string", required: true, description: "Type: multi, tracks, artists, albums, playlists" },
          { name: "limit", type: "number", required: false, description: "Results per page (default 10)" },
        ],
      },
      {
        path: "/artist_overview/",
        method: "GET",
        description: "Get detailed info about an artist",
        params: [
          { name: "id", type: "string", required: true, description: "Spotify artist ID" },
        ],
      },
      {
        path: "/tracks/",
        method: "GET",
        description: "Get track details by ID",
        params: [
          { name: "ids", type: "string", required: true, description: "Comma-separated track IDs" },
        ],
      },
    ],
  },
  {
    name: "Real-Time News Data",
    slug: "realtime-news",
    category: "news",
    description:
      "Search real-time news articles from thousands of sources worldwide. Filter by topic, country, and language.",
    rapidapi_host: "real-time-news-data.p.rapidapi.com",
    base_url: "https://real-time-news-data.p.rapidapi.com",
    endpoints: [
      {
        path: "/search",
        method: "GET",
        description: "Search news articles by keyword",
        params: [
          { name: "query", type: "string", required: true, description: "Search keywords" },
          { name: "country", type: "string", required: false, description: "Country code (US, GB, etc.)" },
          { name: "lang", type: "string", required: false, description: "Language code (en, es, etc.)" },
          { name: "limit", type: "number", required: false, description: "Max results (default 10)" },
        ],
      },
      {
        path: "/topic-news-by-section",
        method: "GET",
        description: "Get top news for a topic section (WORLD, BUSINESS, TECHNOLOGY, SPORTS, etc.)",
        params: [
          { name: "topic", type: "string", required: true, description: "Topic: WORLD, BUSINESS, TECHNOLOGY, ENTERTAINMENT, SPORTS, SCIENCE, HEALTH" },
          { name: "country", type: "string", required: false, description: "Country code" },
          { name: "lang", type: "string", required: false, description: "Language code" },
        ],
      },
    ],
  },
  {
    name: "Google Translate",
    slug: "google-translate",
    category: "translation",
    description: "Translate text between languages and detect the source language.",
    rapidapi_host: "google-translate1.p.rapidapi.com",
    base_url: "https://google-translate1.p.rapidapi.com",
    endpoints: [
      {
        path: "/language/translate/v2",
        method: "POST",
        description: "Translate text to a target language",
        params: [
          { name: "q", type: "string", required: true, description: "Text to translate" },
          { name: "target", type: "string", required: true, description: "Target language code (e.g. es, fr, ja)" },
          { name: "source", type: "string", required: false, description: "Source language code (auto-detected if omitted)" },
        ],
      },
      {
        path: "/language/translate/v2/detect",
        method: "POST",
        description: "Detect the language of text",
        params: [
          { name: "q", type: "string", required: true, description: "Text to detect language of" },
        ],
      },
    ],
  },
  {
    name: "API-Football",
    slug: "api-football",
    category: "sports",
    description:
      "Live scores, standings, fixtures, and statistics for football/soccer leagues worldwide.",
    rapidapi_host: "api-football-v1.p.rapidapi.com",
    base_url: "https://api-football-v1.p.rapidapi.com",
    endpoints: [
      {
        path: "/v3/fixtures",
        method: "GET",
        description: "Get fixtures/matches for a date or league",
        params: [
          { name: "date", type: "string", required: false, description: "Date in YYYY-MM-DD" },
          { name: "league", type: "number", required: false, description: "League ID (e.g. 39 = Premier League)" },
          { name: "live", type: "string", required: false, description: "Set to 'all' for live matches" },
        ],
      },
      {
        path: "/v3/standings",
        method: "GET",
        description: "League standings/table",
        params: [
          { name: "league", type: "number", required: true, description: "League ID" },
          { name: "season", type: "number", required: true, description: "Season year (e.g. 2025)" },
        ],
      },
    ],
  },
  {
    name: "IMDb",
    slug: "imdb",
    category: "movies",
    description:
      "Search movies and TV shows, get ratings, cast, plot summaries, and trending titles from IMDb.",
    rapidapi_host: "imdb236.p.rapidapi.com",
    base_url: "https://imdb236.p.rapidapi.com",
    endpoints: [
      {
        path: "/imdb/search",
        method: "GET",
        description: "Search movies and TV shows by title",
        params: [
          { name: "query", type: "string", required: true, description: "Search query (movie or show title)" },
          { name: "rows", type: "number", required: false, description: "Number of results" },
        ],
      },
      {
        path: "/imdb/most-popular-movies",
        method: "GET",
        description: "Get the most popular movies right now",
        params: [],
      },
      {
        path: "/imdb/most-popular-tv",
        method: "GET",
        description: "Get the most popular TV shows right now",
        params: [],
      },
    ],
  },
  {
    name: "Spoonacular",
    slug: "spoonacular",
    category: "recipes",
    description:
      "Search recipes, get nutritional info, meal plans, and ingredient substitutions.",
    rapidapi_host: "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com",
    base_url: "https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com",
    endpoints: [
      {
        path: "/recipes/complexSearch",
        method: "GET",
        description: "Search recipes by keywords, ingredients, diet, cuisine, etc.",
        params: [
          { name: "query", type: "string", required: true, description: "Recipe search keywords" },
          { name: "cuisine", type: "string", required: false, description: "Cuisine type (italian, mexican, etc.)" },
          { name: "diet", type: "string", required: false, description: "Diet (vegetarian, vegan, gluten free, etc.)" },
          { name: "number", type: "number", required: false, description: "Number of results (default 10)" },
        ],
      },
      {
        path: "/recipes/findByIngredients",
        method: "GET",
        description: "Find recipes by available ingredients",
        params: [
          { name: "ingredients", type: "string", required: true, description: "Comma-separated ingredient list" },
          { name: "number", type: "number", required: false, description: "Number of results" },
        ],
      },
    ],
  },
  {
    name: "Yahoo Finance",
    slug: "yahoo-finance",
    category: "finance",
    description: "Stock quotes, market data, financial news, company profiles, and historical prices.",
    rapidapi_host: "yahoo-finance15.p.rapidapi.com",
    base_url: "https://yahoo-finance15.p.rapidapi.com",
    endpoints: [
      {
        path: "/api/v1/markets/quote",
        method: "GET",
        description: "Get real-time stock quote for one or more tickers",
        params: [
          { name: "ticker", type: "string", required: true, description: "Stock ticker symbol(s), comma-separated (e.g. AAPL,MSFT)" },
          { name: "type", type: "string", required: false, description: "Quote type: EQUITY, INDEX, MUTUALFUND, ETF" },
        ],
      },
      {
        path: "/api/v1/markets/search",
        method: "GET",
        description: "Search for stocks, ETFs, and other securities by name",
        params: [
          { name: "search", type: "string", required: true, description: "Company name or ticker to search" },
        ],
      },
    ],
  },
];

async function seed() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error("DATABASE_URL not set. Add it to .env or .env.local");
    process.exit(1);
  }

  const sql = neon(url);

  console.log("Creating rapid_api_services table...");
  await sql`
    CREATE TABLE IF NOT EXISTS rapid_api_services (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      category VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      rapidapi_host VARCHAR(255) NOT NULL,
      base_url VARCHAR(500) NOT NULL,
      endpoints JSONB NOT NULL DEFAULT '[]',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log(`Seeding ${SERVICES.length} services...`);
  for (const svc of SERVICES) {
    await sql`
      INSERT INTO rapid_api_services (name, slug, category, description, rapidapi_host, base_url, endpoints)
      VALUES (
        ${svc.name},
        ${svc.slug},
        ${svc.category},
        ${svc.description},
        ${svc.rapidapi_host},
        ${svc.base_url},
        ${JSON.stringify(svc.endpoints)}
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        rapidapi_host = EXCLUDED.rapidapi_host,
        base_url = EXCLUDED.base_url,
        endpoints = EXCLUDED.endpoints,
        updated_at = NOW()
    `;
    console.log(`  + ${svc.name} (${svc.category})`);
  }

  console.log("Done! Verifying...");
  const rows = await sql`SELECT slug, category, name FROM rapid_api_services ORDER BY category`;
  console.table(rows);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
