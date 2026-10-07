import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Migrations must never run through a connection pooler in transaction mode,
 * so the CLI prefers DIRECT_URL (Supabase's session pooler) and only falls
 * back to DATABASE_URL when it isn't set.
 *
 * The datasource is omitted entirely when neither is present, because
 * `prisma generate` never connects and runs on every `npm install` — including
 * Vercel's, and a fresh clone before anyone has written a `.env`.
 */
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {}),
});
