import { defineConfig } from "drizzle-kit";
import { assertDevelopmentDatabaseSafety } from "./server/runtime-safety";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

assertDevelopmentDatabaseSafety();

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
