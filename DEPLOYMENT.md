# Deploying EventEase

Backend and database: **Supabase** (Postgres + Auth).
Frontend: **Vercel**.

---

## 1. What's already done

The Supabase project is live and in use:

- Schema pushed via Prisma migrations (`Profile`, `Event`, `Registration`, `CheckInLog`, `Role` enum).
- Row Level Security **enabled with no policies** on all four tables, and the `anon`/`authenticated`
  grants revoked. The app talks to Postgres through Prisma as the `postgres` role, which bypasses
  RLS — so the data is unreachable through Supabase's public REST API even with the publishable key.
- Demo data seeded, including sign-in-able accounts.

### Demo accounts

| Portal   | Email                  | Password       |
| -------- | ---------------------- | -------------- |
| Host     | `host@eventease.demo`  | `eventease123` |
| Attendee | `aisha@eventease.demo` | `eventease123` |
| Attendee | `rahul@eventease.demo` | `eventease123` |

Re-create them any time with `npm run db:seed`.

---

## 2. One thing you must do before deploying

**Vercel cannot reach Supabase's direct database host.** `db.<ref>.supabase.co` resolves to IPv6
only, and Vercel's functions don't have IPv6 egress. Local development works because this machine
does have IPv6 — production will not.

So `DATABASE_URL` on Vercel must be the **Transaction pooler** connection string:

1. Supabase dashboard → **Project Settings → Database → Connection string**
2. Choose the **Transaction pooler** tab (port `6543`)
3. Copy it and replace `[YOUR-PASSWORD]` with your database password
4. Append `?pgbouncer=true&connection_limit=1` — the transaction pooler doesn't support prepared
   statements, and serverless functions should hold one connection each

The result looks like:

```
postgresql://postgres.<project-ref>:<password>@aws-X-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

`DIRECT_URL` stays on the direct host (port `5432`) — it is only used by `prisma migrate`, which
you run from your machine, never from Vercel.

---

## 3. Environment variables on Vercel

Add these under **Project → Settings → Environment Variables** (Production, Preview and Development):

| Variable                        | Value                                                           |
| ------------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`                  | Transaction pooler string from step 2 (port 6543)               |
| `DIRECT_URL`                    | Direct connection string (port 5432)                            |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://<project-ref>.supabase.co`                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your publishable key (`sb_publishable_…`)                       |
| `SUPABASE_SECRET_KEY`           | Your secret key (`sb_secret_…`) — **server only, never public** |

The exact values are in your local `.env`, which is gitignored and must stay that way.

> `SUPABASE_SECRET_KEY` can create and delete any user in your project. It is only ever read in
> server code (`src/lib/supabase/admin.ts`, which is marked `server-only`). Never prefix it with
> `NEXT_PUBLIC_`.

---

## 4. Deploy

No `vercel.json` is needed — Vercel detects Next.js automatically.

- **Build command**: `next build` (default)
- **Install command**: `npm install` (default). `postinstall` runs `prisma generate`, so the
  client is built against the schema on every deploy.
- **Node version**: 20.19+, 22.12+ or 24+ (set in `package.json` → `engines`)

Then either connect the GitHub repo at [vercel.com/new](https://vercel.com/new), or:

```bash
npm i -g vercel
vercel link
vercel --prod
```

---

## 5. Schema changes after launch

Migrations run from your machine, against `DIRECT_URL`:

```bash
npx prisma migrate dev --name what_changed   # create + apply locally
npx prisma migrate deploy                    # apply to Supabase
git push                                     # Vercel redeploys
```

Never point `prisma migrate` at the pooler.

---

## 6. Troubleshooting

**`Can't reach database server` on Vercel, but it works locally**
`DATABASE_URL` is still the direct host. Switch it to the transaction pooler (step 2).

**`prepared statement "s0" already exists`**
The pooler string is missing `?pgbouncer=true`.

**`Too many connections`**
Add `connection_limit=1` to the pooler URL. Each serverless instance keeps its own pool.

**Sign-up says the account exists but sign-in fails**
A Supabase auth user exists without a matching `Profile` row. `getCurrentProfile()` rebuilds the
profile from the auth metadata on next sign-in, so this self-heals — but you can also delete the
user in Supabase → Authentication → Users and sign up again.
