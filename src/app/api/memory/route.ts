import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

interface Memory {
  id: string;
  text: string;
  createdAt: string;
}

const MEMORY_FILE = join(process.cwd(), ".memory-store.json");

const memoryCache: Memory[] = [];
let cacheLoaded = false;

function loadMemories(): Memory[] {
  if (!cacheLoaded) {
    try {
      if (existsSync(MEMORY_FILE)) {
        const raw = readFileSync(MEMORY_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryCache.length = 0;
          memoryCache.push(...parsed);
        }
      }
    } catch {
      // File doesn't exist or is corrupted — start fresh
    }
    cacheLoaded = true;
  }
  return memoryCache;
}

function saveMemories(memories: Memory[]) {
  memoryCache.length = 0;
  memoryCache.push(...memories);
  try {
    writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2));
  } catch {
    // On Vercel, file writes fail — memories persist in-process only
  }
}

export async function GET() {
  const memories = loadMemories();
  return json({ memories });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = body?.text?.trim();
    if (!text) {
      return json({ error: "Missing 'text' field" }, 400);
    }
    const memories = loadMemories();
    const memory: Memory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: new Date().toISOString(),
    };
    memories.push(memory);
    saveMemories(memories);
    return json({ ok: true, memory });
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
