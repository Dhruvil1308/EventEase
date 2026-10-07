-- Supabase's default privileges grant anon/authenticated full access to new
-- tables in `public`, and Prisma creates `_prisma_migrations` itself — so it
-- was left writable through the public REST API even though every application
-- table is locked down.
--
-- It holds no user data, but a caller with only the publishable key could
-- rewrite or truncate the migration history and break future deploys.
-- Prisma connects as `postgres`, which is unaffected by this.

REVOKE ALL ON "_prisma_migrations" FROM anon, authenticated;

-- Stop the same thing happening to any table added later.
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES FROM anon, authenticated;
