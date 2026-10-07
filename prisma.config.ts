import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Migrations must never run through a connection pooler, so the CLI prefers
 * DIRECT_URL and only falls back to DATABASE_URL when it isn't set.
 */
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("Set DIRECT_URL (or DATABASE_URL) to your Supabase Postgres connection string.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
});
