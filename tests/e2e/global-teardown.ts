import "dotenv/config";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

/**
 * The browser journeys sign real accounts up, which creates Supabase auth users,
 * rows in the database and files in Storage. This removes everything they made,
 * so running the suite never leaves the demo data dirty.
 *
 * Test accounts are the only ones using the `@e2e.test` domain. Deleting a
 * profile cascades to its events, registrations, gate logs and call records;
 * their uploads (profile photos, event covers, Aanaya's audio) are removed here.
 */
const MEDIA_BUCKET = "eventease-media"; // avatars/<profileId>/…, events/<eventId>/…
const VOICE_BUCKET = "voice-prompts"; // events/<eventId>/…

export default async function teardown() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL } = process.env;
  const admin =
    NEXT_PUBLIC_SUPABASE_URL && SUPABASE_SECRET_KEY
      ? createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  let profiles = 0;
  let files = 0;
  if (DATABASE_URL) {
    const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await db.connect();
    const testProfiles = `SELECT id FROM "Profile" WHERE email LIKE '%@e2e.test'`;
    const profileIds = (await db.query<{ id: string }>(testProfiles)).rows.map((r) => r.id);
    const eventIds = (
      await db.query<{ id: string }>(`SELECT id FROM "Event" WHERE "hostId" IN (${testProfiles})`)
    ).rows.map((r) => r.id);

    if (admin) {
      const folders: [string, string][] = [
        ...profileIds.map((id): [string, string] => [MEDIA_BUCKET, `avatars/${id}`]),
        ...eventIds.flatMap((id): [string, string][] => [
          [MEDIA_BUCKET, `events/${id}`],
          [VOICE_BUCKET, `events/${id}`],
        ]),
      ];
      for (const [bucket, folder] of folders) {
        const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
        const paths = (data ?? []).map((f) => `${folder}/${f.name}`);
        if (paths.length && !(await admin.storage.from(bucket).remove(paths)).error) files += paths.length;
      }
    }

    const res = await db.query(`DELETE FROM "Profile" WHERE email LIKE '%@e2e.test'`);
    profiles = res.rowCount ?? 0;
    await db.end();
  }

  let authUsers = 0;
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of data?.users ?? []) {
      if (user.email?.endsWith("@e2e.test")) {
        await admin.auth.admin.deleteUser(user.id).catch(() => {});
        authUsers++;
      }
    }
  }

  console.log(
    `\n[teardown] removed ${profiles} test profile(s), ${authUsers} auth user(s) and ${files} uploaded file(s)`,
  );
}
