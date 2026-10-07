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

**Nothing may use Supabase's direct host.** `db.<ref>.supabase.co` resolves to IPv6 only, and
neither Vercel's functions nor most local networks have IPv6 egress — this project's own local
connection broke partway through development for exactly that reason.

Both URLs therefore go through the pooler, which is IPv4. This project is in **ap-northeast-2**,
so the already-working values are:

| Variable       | Pooler      | Port   | Purpose               |
| -------------- | ----------- | ------ | --------------------- |
| `DATABASE_URL` | Transaction | `6543` | All runtime queries   |
| `DIRECT_URL`   | Session     | `5432` | `prisma migrate` only |

```
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
```

The exact strings, with the password filled in, are already in your local `.env` — copy them
straight into Vercel.

> If you ever need to find these again: Supabase dashboard → **Project Settings → Database →
> Connection string**, then the **Transaction pooler** and **Session pooler** tabs. The username is
> `postgres.<project-ref>`, not plain `postgres`.

**Pool size.** Each serverless instance keeps its own connection pool, and they all share the
pooler's slots. `src/lib/prisma.ts` therefore uses a pool of 1 on Vercel (detected via the `VERCEL`
env var) and 5 locally. Override with `DATABASE_POOL_MAX` if needed.

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
