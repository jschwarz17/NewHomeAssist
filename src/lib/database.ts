/**
 * SQLite database for Ara: users, preferences, routines, interactions, learning.
 * Not persistent on Vercel serverless; use for self-hosted or local dev.
 */

import Database from "better-sqlite3";
import path from "path";

const DEFAULT_PATH = path.join(process.cwd(), "ara.db");

let db: Database.Database | null = null;

function getDbPath(): string {
  return process.env.DATABASE_PATH ?? DEFAULT_PATH;
}

const SCHEMA = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  communication_style TEXT,
  response_preference TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Preferences table (room-specific, time-based, etc)
CREATE TABLE IF NOT EXISTS preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  key TEXT,
  value TEXT,
  confidence REAL,
  source TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Device preferences table
CREATE TABLE IF NOT EXISTS device_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  device_type TEXT,
  preferred_device TEXT,
  rank INTEGER,
  confidence REAL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Routines table
CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  routine_name TEXT,
  trigger_type TEXT,
  trigger_value TEXT,
  frequency TEXT,
  tasks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Interaction history
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_input TEXT,
  intent_type TEXT,
  api_used TEXT,
  result_type TEXT,
  actions_taken TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
  feedback_score INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Learned patterns
CREATE TABLE IF NOT EXISTS learned_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  pattern_type TEXT,
  pattern_data TEXT,
  confidence REAL,
  times_observed INTEGER DEFAULT 1,
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Failed automations
CREATE TABLE IF NOT EXISTS failed_automations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  task_name TEXT,
  reason TEXT,
  last_failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  failure_count INTEGER DEFAULT 1,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Context snapshots
CREATE TABLE IF NOT EXISTS context_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  snapshot_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`;

export function getDatabase(): Database.Database {
  if (db) return db;
  try {
    const dbPath = getDbPath();
    db = new Database(dbPath);
    db.exec(SCHEMA);
    return db;
  } catch (e) {
    console.error("[database] Failed to open SQLite:", e);
    throw e;
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function isDatabaseAvailable(): boolean {
  try {
    getDatabase();
    return true;
  } catch {
    return false;
  }
}
