import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Locally: copy .env.example to .env. On Vercel: add it under " +
        "Project Settings → Environment Variables, using Supabase's transaction pooler (port 6543).",
    );
  }

  // Every connection here is a slot on Supabase's pooler, and a serverless
  // deployment runs many instances at once — so each instance keeps a small
  // pool. Locally a slightly larger one keeps the seed and tests brisk.
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 1 : 5)),
    idleTimeoutMillis: 10_000,
    // The database is remote; fail fast rather than hanging a request.
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads in development so we don't leak connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let client: PrismaClient | undefined = globalForPrisma.prisma;

function getClient(): PrismaClient {
  if (!client) {
    client = createPrismaClient();
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  }
  return client;
}

/**
 * The Prisma client, created on first use rather than on import.
 *
 * `next build` imports every route to prerender it. Constructing the client
 * eagerly would make a missing DATABASE_URL fail the build with a stack trace
 * from an unrelated page; this way the build succeeds and any genuinely
 * database-backed request reports the real problem.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const instance = getClient();
    const value = Reflect.get(instance, prop, instance);
    // Delegates are objects; client methods need `this` bound to the client.
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
