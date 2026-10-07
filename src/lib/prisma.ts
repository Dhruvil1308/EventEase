import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill in your Supabase connection string.");
}

function createPrismaClient() {
  // Every connection here is a slot on Supabase's pooler, and a serverless
  // deployment runs many instances at once — so each instance keeps a small
  // pool. Locally a slightly larger one keeps the seed and tests brisk.
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 1 : 5)),
    idleTimeoutMillis: 10_000,
    // The database is remote; fail fast rather than hanging a request.
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads in development so we don't leak connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
