import { neon } from "@neondatabase/serverless";

export interface RapidApiEndpoint {
  path: string;
  method: string;
  description: string;
  params: { name: string; type: string; required: boolean; description: string }[];
}

export interface RapidApiService {
  id: number;
  name: string;
  slug: string;
  category: string;
  description: string;
  rapidapi_host: string;
  base_url: string;
  endpoints: RapidApiEndpoint[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function getClient() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL (or POSTGRES_URL) is not set");
  return neon(url);
}

export async function initRapidApiSchema() {
  const sql = getClient();
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
}

export async function getActiveServices(): Promise<RapidApiService[]> {
  const sql = getClient();
  const rows = await sql`
    SELECT * FROM rapid_api_services WHERE is_active = true ORDER BY category, name
  `;
  return rows as unknown as RapidApiService[];
}

export async function getAllServices(category?: string): Promise<RapidApiService[]> {
  const sql = getClient();
  if (category) {
    const rows = await sql`
      SELECT * FROM rapid_api_services WHERE category = ${category} ORDER BY name
    `;
    return rows as unknown as RapidApiService[];
  }
  const rows = await sql`SELECT * FROM rapid_api_services ORDER BY category, name`;
  return rows as unknown as RapidApiService[];
}

export async function addService(
  service: Omit<RapidApiService, "id" | "created_at" | "updated_at" | "is_active">
): Promise<RapidApiService> {
  const sql = getClient();
  const rows = await sql`
    INSERT INTO rapid_api_services (name, slug, category, description, rapidapi_host, base_url, endpoints)
    VALUES (
      ${service.name},
      ${service.slug},
      ${service.category},
      ${service.description},
      ${service.rapidapi_host},
      ${service.base_url},
      ${JSON.stringify(service.endpoints)}
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      rapidapi_host = EXCLUDED.rapidapi_host,
      base_url = EXCLUDED.base_url,
      endpoints = EXCLUDED.endpoints,
      updated_at = NOW()
    RETURNING *
  `;
  return rows[0] as unknown as RapidApiService;
}
