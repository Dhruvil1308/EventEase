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

## 2. Database connection — never use the direct host

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

The repo is already configured for Vercel. You should not need to change any
build settings.

### What's in the repo for this

| File                           | Why it matters                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `vercel.json`                  | Pins functions to **`icn1` (Seoul)** — see below. Declares the Next.js framework.                                                |
| `.vercelignore`                | Keeps tests, docs and screenshots out of the upload.                                                                             |
| `package.json` → `postinstall` | Runs `prisma generate` on every install, so the client always matches the schema. The generated client is gitignored on purpose. |
| `src/lib/prisma.ts`            | Creates the client lazily and uses a pool of **1** when `VERCEL` is set.                                                         |
| `next.config.ts`               | Security headers, and `typescript.ignoreBuildErrors: false` so a type error fails the deploy instead of shipping.                |

### Run the functions in Seoul

This is the single biggest thing you can do for speed. Supabase is in
**ap-northeast-2 (Seoul)**, and one database round trip across the Pacific costs
~140ms. Vercel defaults to `iad1` (Washington DC), which would add that latency
to _every_ query on _every_ page.

`vercel.json` pins functions to `icn1`, Vercel's Seoul region, putting them in the
same city as the database:

```json
{ "regions": ["icn1"] }
```

Expect production to feel noticeably faster than local development, because
locally every query still crosses the ocean. A single region is available on the
Hobby plan; if you ever move the Supabase project, change this to match.

### Environment variables

Add the five variables from section 3 **before the first deploy**, for
Production, Preview and Development. The build itself succeeds without them
(the Prisma client is lazy), but every page would then error at request time.

### Deploy

- **Build command**: `next build` (default — leave it blank)
- **Install command**: `npm install` (default)
- **Output**: auto-detected
- **Node version**: 20.19+, 22.12+ or 24+ (from `package.json` → `engines`)

Do **not** add `prisma migrate deploy` to the build command. Migrations run from
your machine (section 5), so a deploy can never half-migrate production.

Either import the GitHub repo at [vercel.com/new](https://vercel.com/new) — pushes
to `main` then deploy automatically — or:

```bash
npm i -g vercel
vercel link
vercel --prod
```

### After the first deploy

1. Open the deployment URL and sign in as `host@eventease.demo`.
2. Check `/host` loads with its 4 events — that proves the pooler URL works.
3. Run one check-in at `/checkin` to confirm writes work.
4. If the camera doesn't appear on a phone, confirm you're on **https** —
   `getUserMedia` is blocked on insecure origins. Vercel URLs are always https.

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
