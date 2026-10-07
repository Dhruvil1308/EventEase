import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill in your Supabase connection string.");
}

function createPrismaClient() {
  // Supabase terminates idle connections, and serverless invocations are short
  // lived, so keep the pool small and let it drain quickly.
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads in development so we don't leak connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
