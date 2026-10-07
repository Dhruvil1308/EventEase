# EventEase — College Event Registration & Check-In

> Register fast. Scan once. Zero duplicates.

Organizers usually juggle a Google Form for sign-ups and a spreadsheet at the door, which leads to duplicate entries and slow check-ins. **EventEase** puts the whole flow in one place: create an event with a capacity, give every participant a unique QR ticket and entry code, and verify it at the gate in under a second. A second scan of the same ticket is rejected automatically.

![EventEase landing page with the 3D voxel QR code](docs/screenshots/home.jpg)

| Check-in: first scan                                   | Check-in: same code again                                     |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| ![Entry granted](docs/screenshots/checkin-success.jpg) | ![Duplicate rejected](docs/screenshots/checkin-duplicate.jpg) |

| Holographic QR ticket                  | Live event dashboard                         |
| -------------------------------------- | -------------------------------------------- |
| ![Ticket](docs/screenshots/ticket.jpg) | ![Dashboard](docs/screenshots/dashboard.jpg) |

---

## Requirements covered

| Requirement                                                      | How EventEase does it                                                                                                                                                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create an event with a participant capacity                      | `/events/new` form with live preview. Capacity is validated server-side and enforced in a transaction, so simultaneous sign-ups can't overbook.                                                                   |
| Register participants and generate a unique QR code / entry code | `/events/:id/register` issues a code like `EE-7K2M-Q9XD` (unique index) and a QR ticket at `/tickets/:code`, with PNG download, copy and print. The same email can't register twice per event.                    |
| Verify codes during check-in and prevent duplicate check-ins     | `/checkin` gate: camera QR scanner, manual code entry, or scan from an image. Check-in is a single conditional update, so a ticket is admitted **exactly once**, even if scanned at two gates at the same moment. |
| Display registration and attendance counts                       | Live dashboard per event (auto-refreshing): registered / capacity, checked-in / registered, seats left, gate results. Totals on `/events` and the landing page.                                                   |
| **Demo:** register → check in → reject second check-in           | Covered by an automated end-to-end test (`npm run test:e2e`) and a unit test (`npm test`). See [Demo script](#demo-script-2-minutes).                                                                             |

### Extras

- **Wrong-event protection.** Pick an event at the gate, and tickets for other events are rejected without being used up.
- **Audit trail.** Every scan is logged (granted / duplicate / invalid / wrong event).
- **CSV export** of the attendance sheet, with formula-injection-safe cells.
- **Typo-proof codes.** No `0/O/1/I/L`; lowercase, spaces and missing dashes are all accepted. USB barcode scanners work in the code field.
- **Gate feedback.** Colour flash, a 3D portal that turns green or red, synthesized sounds (mute toggle), and vibration on phones.
- **Accessible.** Keyboard-friendly, semantic markup, live regions for verdicts, and `prefers-reduced-motion` disables the heavy motion.

## Tech stack

| Layer      | Choice                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework  | **Next.js 16** (App Router, Cache Components / Partial Prerendering, Route Handlers), **React 19**, TypeScript                                                     |
| 3D         | **three.js** + **@react-three/fiber** + **@react-three/drei**: a voxel QR hero that assembles and scatters with scroll, plus a check-in portal                     |
| Animation  | **anime.js v4**: scroll-synced reveals that play on scroll-down and reverse on scroll-up, split-text, SVG line drawing, count-ups, magnetic buttons, 3D tilt cards |
| Styling    | **Tailwind CSS v4**, glassmorphism, Unbounded / Manrope / JetBrains Mono fonts                                                                                     |
| Database   | **Supabase Postgres** via **Prisma ORM 7** (`@prisma/adapter-pg`)                                                                                                  |
| Auth       | **Supabase Auth** — two portals (attendee / host), sessions via `@supabase/ssr` cookies                                                                            |
| QR         | `qrcode` (generation), native `BarcodeDetector` with a `jsQR` fallback (scanning)                                                                                  |
| Validation | `zod` (shared by client and server)                                                                                                                                |
| Testing    | Node test runner (services & codes) and Playwright (end-to-end demo)                                                                                               |

## Quick start

**Prerequisites:** Node.js `20.19+`, `22.12+` or `24+`, npm, and a Supabase project.

```bash
cp .env.example .env   # fill in your Supabase connection strings and keys
npm install            # also generates the Prisma client
npm run db:deploy      # applies migrations to Supabase
npm run db:seed        # demo events, participants and sign-in-able accounts
npm run dev            # http://localhost:3000
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full Supabase + Vercel setup, including the pooler
connection string Vercel requires.

### Demo accounts (after seeding)

| Portal   | Email                  | Password       |
| -------- | ---------------------- | -------------- |
| Host     | `host@eventease.demo`  | `eventease123` |
| Attendee | `aisha@eventease.demo` | `eventease123` |

### Two portals

Attendees and hosts are separate accounts with separate sign-in pages:

- **Attendees** (`/signin`) browse events, register, and hold their tickets at `/dashboard`.
- **Hosts** (`/host/signin`) create events, run the check-in gate, and manage attendance at `/host`.

Nobody can create an event or register without signing in, and a host account is turned away at the
attendee door (and vice versa).

Seed data: four events (one in progress with live check-ins, one full), about 290 participants, and some gate history. Re-seed at any time with `npm run db:seed`.

## Demo script (2 minutes)

1. **Home** (`/`): scroll down slowly. The 3D QR code bursts apart, sections reveal, and the "How it works" line draws itself. Scroll back up and everything reverses.
2. **Create**: `New event` → fill name, venue and date, then set **capacity** (try `2`). The preview card updates as you type. Create it.
3. **Register**: on the dashboard, click **+ Register participant**, enter a name and email, and submit. You land on the participant's **QR ticket** with a unique entry code.
   - Optional: register the same email again and it's rejected with _"already registered"_.
4. **Check in**: on the ticket, click **"Verify this ticket at the check-in gate"**. The code is pre-filled; press **Verify & check in** → ✅ **Entry granted**.
5. **Reject a duplicate**: press **Verify & check in** again (or just hit Enter) → ⛔ **Already checked in** _(first used at 10:42 AM)_.
6. **Counts**: back on the event dashboard, registered / checked-in / duplicates are updated live. The ticket page now shows a **CHECKED IN** stamp.

> Camera scanning: open **Scan QR** on the gate and point the camera at the ticket on another screen, or use **"Scan from an image…"** with the ticket's downloaded QR PNG.

## How it works

### Data model (`prisma/schema.prisma`)

```
Event ──< Registration ──< CheckInLog
  id, name, venue,     id, name, email (lower-case),     result: SUCCESS | DUPLICATE |
  startsAt, capacity,  code (unique), checkedInAt?        INVALID | WRONG_EVENT
  theme                @@unique([eventId, email])        code, eventId?, registrationId?
```

### The important guarantees

- **No duplicate check-ins.** `checkIn()` in `src/lib/services/checkin.ts` runs
  `UPDATE Registration SET checkedInAt = now WHERE id = ? AND checkedInAt IS NULL`.
  Only one request can flip `checkedInAt` from `NULL`; every other scan gets `DUPLICATE` with the original check-in time. The test suite fires 12 simultaneous scans and asserts exactly one success.
- **No overbooking.** `registerParticipant()` takes a `SELECT … FOR UPDATE` lock on the event row, then counts seats and inserts inside the same transaction. Postgres lets concurrent transactions count without seeing each other, so the row lock is what makes this safe — registrations for one event serialize, while other events proceed in parallel (tested with 15 simultaneous sign-ups for 5 seats).
- **Tickets are bound to accounts.** A registration always takes its email from the session, never from the request body, so a ticket can't be issued to someone else. One ticket per account per event.
- **Nothing leaks across hosts.** Participant lists, CSV exports, live counts and the gate are all scoped to the owning host; one host's gate can't admit — or burn — another host's ticket.
- **No duplicate registrations.** A unique index on `(eventId, email)`, with emails lower-cased and trimmed by zod.
- **Unique, typo-proof codes.** `EE-XXXX-XXXX` from a 31-character alphabet (≈ 8.5 × 10¹¹ codes), generated with `crypto.getRandomValues` and rejection sampling, protected by a unique index with retry.

### Project structure

```
prisma/                schema, migrations, seed
src/app/               pages (App Router) + REST route handlers under api/
src/components/
  three/               HeroScene (voxel QR), PortalScene (check-in gate)
  motion/              anime.js primitives: Reveal, SplitText, CountUp, Magnetic, TiltCard, Marquee
  checkin/             gate console, QR scanner, verdict card, sound/haptics
  dashboard/           live dashboard, participants table, activity feed
  events/ tickets/ home/ layout/ ui/
src/lib/
  services/            business logic (events, registrations, check-in, live data)
  codes.ts             entry-code generation & normalization
  validation.ts        zod schemas shared by client and server
tests/                 node:test suites + Playwright e2e
```

## REST API

| Method   | Endpoint                        | Description                                                                                   |
| -------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET`    | `/api/events`                   | All events with registration/attendance stats                                                 |
| `POST`   | `/api/events`                   | Create `{ name, venue, startsAt, capacity, description?, theme? }`                            |
| `GET`    | `/api/events/:id`               | One event with stats                                                                          |
| `DELETE` | `/api/events/:id`               | Delete an event (and its registrations/logs)                                                  |
| `GET`    | `/api/events/:id/registrations` | Participants + stats                                                                          |
| `POST`   | `/api/events/:id/registrations` | Register `{ name, email, studentId?, department? }` → `201` with code                         |
| `GET`    | `/api/events/:id/live`          | Stats, gate counts, participants, recent activity (polled by the dashboard)                   |
| `GET`    | `/api/events/:id/export`        | Attendance CSV                                                                                |
| `POST`   | `/api/checkin`                  | Verify `{ code, eventId? }`: `200 SUCCESS`, `409 DUPLICATE`, `409 WRONG_EVENT`, `404 INVALID` |
| `GET`    | `/api/tickets/:code`            | Ticket lookup                                                                                 |
| `GET`    | `/api/tickets/:code/qr`         | QR PNG (`?download` to save)                                                                  |
| `GET`    | `/api/stats`                    | Totals across all events                                                                      |

The demo scenario, using only the API:

```bash
EVENT=$(curl -s -X POST localhost:3000/api/events -H 'content-type: application/json' \
  -d '{"name":"API Demo","venue":"Hall 1","startsAt":"2030-01-01T10:00:00Z","capacity":50}' | jq -r .event.id)
CODE=$(curl -s -X POST localhost:3000/api/events/$EVENT/registrations -H 'content-type: application/json' \
  -d '{"name":"Aisha Khan","email":"aisha@campus.edu"}' | jq -r .registration.code)
curl -s -X POST localhost:3000/api/checkin -H 'content-type: application/json' -d "{\"code\":\"$CODE\"}" | jq .status  # "SUCCESS"
curl -s -X POST localhost:3000/api/checkin -H 'content-type: application/json' -d "{\"code\":\"$CODE\"}" | jq .status  # "DUPLICATE"
```

## Scripts

| Script                                  | What it does                                                            |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                           | Start the dev server                                                    |
| `npm run dev:https`                     | Dev server over HTTPS (needed for the camera on other devices)          |
| `npm run build` / `npm start`           | Production build / serve                                                |
| `npm run db:deploy`                     | Apply migrations to Supabase                                            |
| `npm run db:seed`                       | Reset demo data                                                         |
| `npm run db:migrate`                    | Create a migration after editing the schema                             |
| `npm run db:studio`                     | Browse the database in Prisma Studio                                    |
| `npm test`                              | Unit + integration tests (throw-away Postgres schema)                   |
| `npm run test:e2e`                      | Playwright end-to-end demo (run `npx playwright install chromium` once) |
| `npm run lint` / `typecheck` / `format` | Code quality                                                            |

## Notes

- **Camera on phones:** browsers only allow camera access on `https://` or `localhost`. To scan with a phone on the same Wi-Fi, run `npm run dev:https` and open the "Network" URL it prints (accept the self-signed certificate). Next.js may also ask you to add that address to [`allowedDevOrigins`](https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins) in `next.config.ts`.
- **Time zone:** set `NEXT_PUBLIC_TIMEZONE` (e.g. `Asia/Kolkata`) in `.env` to show every time in the venue's time zone.
- **Deploying:** see [DEPLOYMENT.md](DEPLOYMENT.md). Vercel must use Supabase's transaction pooler — its functions can't reach the IPv6-only direct host.
- **Next steps:** organizer authentication for the dashboard and gate, emailing tickets to participants, waitlists when an event is full.
