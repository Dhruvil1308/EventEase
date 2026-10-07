import "dotenv/config";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

/**
 * The browser journeys sign real accounts up, which creates Supabase auth users
 * and rows in the database. This removes everything they made, so running the
 * suite never leaves the demo data dirty.
 *
 * Test accounts are the only ones using the `@e2e.test` domain. Deleting a
 * profile cascades to its events, registrations and gate logs.
 */
export default async function teardown() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL } = process.env;

  let profiles = 0;
  if (DATABASE_URL) {
    const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await db.connect();
    const res = await db.query(`DELETE FROM "Profile" WHERE email LIKE '%@e2e.test'`);
    profiles = res.rowCount ?? 0;
    await db.end();
  }

  let authUsers = 0;
  if (NEXT_PUBLIC_SUPABASE_URL && SUPABASE_SECRET_KEY) {
    const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of data?.users ?? []) {
      if (user.email?.endsWith("@e2e.test")) {
        await admin.auth.admin.deleteUser(user.id).catch(() => {});
        authUsers++;
      }
    }
  }

  console.log(`\n[teardown] removed ${profiles} test profile(s) and ${authUsers} auth user(s)`);
}
