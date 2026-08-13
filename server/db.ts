import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { assertDevelopmentDatabaseSafety } from "./runtime-safety";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

assertDevelopmentDatabaseSafety();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
