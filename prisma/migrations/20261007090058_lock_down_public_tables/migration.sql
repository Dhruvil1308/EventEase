-- Supabase exposes every table in `public` through PostgREST using the anon key.
-- This app never talks to PostgREST: all data access goes through Prisma, which
-- connects as the `postgres` role and therefore bypasses RLS.
--
-- Enabling RLS with NO policies means anon/authenticated API callers can read
-- and write nothing, while Prisma is unaffected. Without this, anyone holding
-- the publishable key could read every registration and entry code.

ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Registration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CheckInLog" ENABLE ROW LEVEL SECURITY;

-- Belt and braces: drop the blanket grants Supabase hands the API roles.
REVOKE ALL ON "Profile", "Event", "Registration", "CheckInLog" FROM anon, authenticated;
