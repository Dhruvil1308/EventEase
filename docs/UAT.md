# EventEase — UAT Test Scenarios

User acceptance tests for the college event registration & QR check-in app.
**91 cases across 8 suites.** Designed to be run top to bottom in one sitting.

---

## Before you start (≈3 minutes)

```bash
npm install
npm run db:seed     # ~8s — resets to clean demo data
npm run dev         # http://localhost:3000
```

`npm run db:seed` is safe to re-run at any point. If a test leaves the data in a
confusing state, re-seed and carry on — it takes seconds.

### Test accounts

| Role         | Email                  | Password       |
| ------------ | ---------------------- | -------------- |
| **Host**     | `host@eventease.demo`  | `eventease123` |
| **Attendee** | `aisha@eventease.demo` | `eventease123` |
| **Attendee** | `rahul@eventease.demo` | `eventease123` |

### Seeded events

| Event                             | Capacity | Registered | State             |
| --------------------------------- | -------- | ---------- | ----------------- |
| TechFest 2026 — Hackathon Kickoff | 150      | 96         | Open              |
| AI & Robotics Workshop            | 40       | 37         | Almost full, live |
| Rhythm — Cultural Night           | 300      | 142        | Open              |
| Startup Pitch Arena               | 12       | 12         | **Full**          |

### Run the three browser profiles side by side

Several suites need two identities at once. Fastest setup: one **normal window**
(host), one **incognito window** (attendee), one more **incognito** (signed out).
That avoids signing in and out between cases.

### How to record a result

Mark each case **Pass** / **Fail** / **N/A** in the right-hand column. For a
failure, note what you saw instead. A sign-off table is at the bottom.

---

## Suite A — Access control while signed out

Use the signed-out window. These prove nothing works without an account.

| ID  | Scenario                                   | Steps                                                                                                                                                        | Expected result                                                              | ✓   |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --- |
| A1  | Home page is public                        | Open `/`                                                                                                                                                     | Hero loads. Navbar shows **Host portal** and **Sign in**. No dashboard links |     |
| A2  | Event list is public                       | Open `/events`                                                                                                                                               | All 4 events visible with live registration counts                           |     |
| A3  | Cannot create an event                     | Open `/events/new`                                                                                                                                           | Redirected to `/host/signin?next=%2Fevents%2Fnew`                            |     |
| A4  | Cannot register                            | Open `/events` → click **Register** on TechFest                                                                                                              | Redirected to `/signin?next=…`                                               |     |
| A5  | Cannot open the gate                       | Open `/checkin`                                                                                                                                              | Redirected to `/host/signin?next=%2Fcheckin`                                 |     |
| A6  | Cannot see a host dashboard                | Open `/host`                                                                                                                                                 | Redirected to `/host/signin`                                                 |     |
| A7  | Cannot see an attendee dashboard           | Open `/dashboard`                                                                                                                                            | Redirected to `/signin`                                                      |     |
| A8  | Cannot open someone's ticket               | Open `/tickets/EE-XXXX-XXXX` (any code)                                                                                                                      | Redirected to `/signin`, **not** shown the ticket                            |     |
| A9  | API rejects event creation                 | `curl -X POST localhost:3000/api/events -H 'content-type: application/json' -d '{"name":"Hack","venue":"Hall","startsAt":"2030-01-01T10:00","capacity":10}'` | `401` with `UNAUTHORIZED`                                                    |     |
| A10 | API rejects check-in                       | `curl -X POST localhost:3000/api/checkin -H 'content-type: application/json' -d '{"code":"EE-ZZZZ-ZZZZ"}'`                                                   | `401` with `UNAUTHORIZED`                                                    |     |
| A11 | Returned to intended page after signing in | From A3's redirect, sign in as host                                                                                                                          | Lands on `/events/new`, not the generic dashboard                            |     |

---

## Suite B — Attendee portal

| ID  | Scenario                         | Steps                                                                   | Expected result                                                                               | ✓   |
| --- | -------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --- |
| B1  | Portal is visually distinct      | Open `/signin`                                                          | Eyebrow reads **ATTENDEE PORTAL** in cyan. Link offers the host portal                        |     |
| B2  | Sign up with a new account       | `/signup` → name, a fresh email, password ≥8 chars → **Create account** | Signed in immediately (no confirmation email), lands on `/dashboard`                          |     |
| B3  | Short password rejected          | `/signup` with a 5-character password                                   | Inline error "Use at least 8 characters". No account created                                  |     |
| B4  | Malformed email rejected         | `/signup` with `not-an-email`                                           | Inline error "Enter a valid email address"                                                    |     |
| B5  | Duplicate email rejected         | `/signup` using `aisha@eventease.demo`                                  | Error says the account exists and to sign in instead                                          |     |
| B6  | Wrong password rejected          | `/signin` as `aisha@eventease.demo` with `wrongpass`                    | "That email and password don't match an account"                                              |     |
| B7  | Sign in succeeds                 | `/signin` as Aisha                                                      | Lands on `/dashboard`. Navbar shows **AK** avatar and her name                                |     |
| B8  | Dashboard shows her tickets      | Look at `/dashboard`                                                    | Tiles for Tickets / Upcoming / Attended. One card per ticket, each with entry code and status |     |
| B9  | Ticket statuses are accurate     | Inspect the cards                                                       | AI & Robotics shows **Checked in**; the others show **Ready to scan**                         |     |
| B10 | Ticket opens from the dashboard  | Click **View QR ticket**                                                | Ticket page shows a scannable QR plus the `EE-XXXX-XXXX` code                                 |     |
| B11 | Nav is attendee-shaped           | Check the navbar                                                        | Only **My tickets** and **Browse events**. No Create, no Check-in                             |     |
| B12 | Cards offer Register, not Manage | Open `/events` as Aisha                                                 | Cards show **Register** (or "Registration closed"). No Manage/Check-in buttons                |     |
| B13 | Account menu works               | Click the avatar                                                        | Dropdown shows "Attendee account", My tickets, Browse events, Sign out                        |     |
| B14 | Sign out                         | Click **Sign out**                                                      | Returned to `/`, navbar back to Sign in. `/dashboard` now redirects                           |     |
| B15 | Session survives a reload        | Sign in, then hard-refresh (Ctrl+Shift+R)                               | Still signed in                                                                               |     |

---

## Suite C — Host portal

| ID  | Scenario                    | Steps                                                                            | Expected result                                                                       | ✓   |
| --- | --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --- |
| C1  | Portal is visually distinct | Open `/host/signin`                                                              | Eyebrow reads **HOST PORTAL** in pink. Link offers the attendee portal                |     |
| C2  | Host sign-up                | `/host/signup` → name, fresh email, password, optional club → **Create account** | Signed in, lands on `/host` with an empty-state prompt to create an event             |     |
| C3  | Host sign-in                | `/host/signin` as `host@eventease.demo`                                          | Lands on `/host`                                                                      |     |
| C4  | Dashboard totals            | Look at `/host`                                                                  | Your events **4**, Registrations **287**, Checked in **21**, Duplicates blocked **3** |     |
| C5  | Only own events listed      | Scroll the grid                                                                  | Exactly the 4 seeded events, each with **Manage** and **Check-in**                    |     |
| C6  | Nav is host-shaped          | Check the navbar                                                                 | Your events, Browse, Create, Check-in                                                 |     |
| C7  | Create an event             | `/events/new` → name, venue, future date, capacity **2** → **Create event**      | Lands on the event dashboard with a "Event created!" banner and a copy-link button    |     |
| C8  | Name too short rejected     | Create with a 1-character name                                                   | Inline error, no event created                                                        |     |
| C9  | Capacity zero rejected      | Create with capacity `0`                                                         | Inline error "Capacity must be at least 1"                                            |     |
| C10 | Invalid date rejected       | Clear the date and submit                                                        | Inline error "Pick a valid date and time"                                             |     |
| C11 | New event appears           | Return to `/host`                                                                | Count is now 5 and the new event is in the grid                                       |     |
| C12 | Event dashboard detail      | Open **Manage** on AI & Robotics                                                 | Shows 37/40 registered, 21 checked in, participants table, gate activity feed         |     |
| C13 | Participants table          | Inspect the table                                                                | Names, emails, entry codes and check-in times for all 37                              |     |
| C14 | Copy registration link      | Click **Copy registration link**                                                 | Button confirms "Link copied!"; clipboard holds the full `/events/<id>/register` URL  |     |
| C15 | Host cannot register        | As the host, open `/events/<id>/register`                                        | Redirected to `/host?denied=attendee` — hosts attend nothing                          |     |
| C16 | CSV export                  | Open `/api/events/<id>/export`                                                   | Downloads `…-attendance.csv` with headers and one row per participant                 |     |

---

## Suite D — The core demo scenario

**This is the requirement the project is judged on.** Run it in one pass.
Host in the normal window, attendee in incognito.

| ID  | Scenario                              | Steps                                                                            | Expected result                                                            | ✓   |
| --- | ------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --- |
| D1  | Host creates an event with a capacity | As host: `/events/new` → "UAT Demo", venue, future date, capacity **2** → Create | Event dashboard opens, 0/2 registered                                      |     |
| D2  | Attendee registers                    | As Aisha: open the registration link → **Register & get my QR ticket**           | Confetti, then redirect to `/tickets/EE-XXXX-XXXX`                         |     |
| D3  | A unique code is issued               | Read the ticket                                                                  | Code matches `EE-XXXX-XXXX`. QR is displayed and scannable                 |     |
| D4  | Email is bound to the account         | Check the form before submitting                                                 | Email field is pre-filled with her account email and **read-only**         |     |
| D5  | Counts update                         | As host, reload the event dashboard                                              | 1/2 registered, 0 checked in                                               |     |
| D6  | **First check-in is granted**         | As host: `/checkin` → pick the event → type the code → **Verify & check in**     | Green verdict: **Entry granted**, with Aisha's name                        |     |
| D7  | **Second check-in is rejected**       | Click **Verify & check in** again with the same code                             | Red verdict: **Entry denied** — already checked in, with the original time |     |
| D8  | Counts reflect attendance             | Reload the event dashboard                                                       | 1/2 registered, **1 checked in**, attendance 100%                          |     |
| D9  | Duplicate attempt is logged           | Look at the gate activity feed                                                   | Shows the SUCCESS followed by the DUPLICATE                                |     |
| D10 | Attendee sees the new status          | As Aisha, open `/dashboard`                                                      | That ticket now shows **Checked in**                                       |     |

---

## Suite E — Check-in gate behaviour

Signed in as host, on `/checkin`.

| ID  | Scenario                     | Steps                                                           | Expected result                                                               | ✓   |
| --- | ---------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- | --- |
| E1  | Unknown code                 | Enter `EE-ZZZZ-ZZZZ` → verify                                   | **Invalid** — "No ticket matches this code"                                   |     |
| E2  | Malformed code               | Enter `hello world` → verify                                    | **Invalid** — "That doesn't look like an EventEase entry code"                |     |
| E3  | Lower case accepted          | Take a valid unused code, type it lower-case                    | Accepted — **Entry granted**                                                  |     |
| E4  | Dashes optional              | Enter a valid code with no dashes, e.g. `7K2MQ9XD`              | Accepted                                                                      |     |
| E5  | Spaces tolerated             | Enter a valid code as `ee 7k2m q9xd`                            | Accepted                                                                      |     |
| E6  | Ambiguous characters absent  | Inspect several codes                                           | No `0`, `O`, `1`, `I` or `L` anywhere                                         |     |
| E7  | Wrong event at this gate     | Set the gate to event A, scan a valid ticket for event B        | **Wrong event** — names the correct event, and the ticket is **not** consumed |     |
| E8  | Ticket still usable after E7 | Set the gate to event B, scan the same code                     | **Entry granted** — E7 did not burn it                                        |     |
| E9  | Gate lists only your events  | Open the event dropdown                                         | Only this host's events, plus "Any event"                                     |     |
| E10 | QR scanning                  | Click **Scan QR** → allow camera → hold a ticket QR to the lens | Code is read and verified without typing                                      |     |
| E11 | Scan from an image           | Click **Scan from an image** → upload a ticket screenshot       | Code is read from the file                                                    |     |
| E12 | Gate counters                | Perform a mix of valid, duplicate and invalid scans             | The three counters below the form track each outcome                          |     |

---

## Suite F — Cross-account isolation

Needs a **second host**. Create one via C2 (e.g. `host2@uat.test`).

| ID  | Scenario                                 | Steps                                                                 | Expected result                                                            | ✓   |
| --- | ---------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | --- |
| F1  | Host B sees none of Host A's events      | Sign in as host2 → `/host`                                            | Empty state. None of the seeded events                                     |     |
| F2  | Host B cannot open Host A's dashboard    | Visit `/events/<A's event id>`                                        | Redirected to `/host?denied=owner`                                         |     |
| F3  | Host B cannot read the participant list  | `curl` `/api/events/<A's id>/registrations` with host2's cookies      | `403 FORBIDDEN`                                                            |     |
| F4  | Host B cannot export Host A's data       | Open `/api/events/<A's id>/export` as host2                           | `403 FORBIDDEN`                                                            |     |
| F5  | **Host B cannot burn Host A's ticket**   | As host2, gate on "Any event", scan a valid ticket for Host A's event | **Wrong event** — "another host runs it". Ticket remains unused            |     |
| F6  | Ticket still works for its real host     | As Host A, scan that same code                                        | **Entry granted**                                                          |     |
| F7  | Attendee cannot read a stranger's ticket | As Rahul, open Aisha's ticket URL                                     | Not found / not shown                                                      |     |
| F8  | Host account refused at attendee door    | Sign out → `/signin` with host credentials                            | Error: "This is a host account. Sign in at the host portal (/host/signin)" |     |
| F9  | Attendee account refused at host door    | `/host/signin` with Aisha's credentials                               | Error: "This is an attendee account…"                                      |     |
| F10 | Attendee blocked from host tools         | As Aisha, open `/events/new`                                          | Redirected to `/dashboard?denied=host`                                     |     |
| F11 | Host blocked from attendee dashboard     | As host, open `/dashboard`                                            | Redirected to `/host?denied=attendee`                                      |     |

---

## Suite G — Capacity and duplicates

| ID  | Scenario                                 | Steps                                                              | Expected result                                                                | ✓   |
| --- | ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --- |
| G1  | Full event blocks registration           | As Aisha, open Startup Pitch Arena (12/12)                         | Card reads **Registration closed**; the register page says every seat is taken |     |
| G2  | Capacity is respected exactly            | Register attendees into the capacity-2 event from D1 until full    | The 3rd attempt is refused with "all 2 seats are taken" — never 3/2            |     |
| G3  | One ticket per account per event         | As Aisha, having registered, open the same registration page again | Redirected to her existing ticket instead of a second registration             |     |
| G4  | Duplicate blocked at the API             | `POST /api/events/<id>/registrations` twice with Aisha's cookies   | Second call returns `409 ALREADY_REGISTERED`                                   |     |
| G5  | Seats-left indicator                     | Watch the register page as seats fill                              | "N seats left" decreases and matches the dashboard                             |     |
| G6  | Full event still admits existing tickets | Gate on Startup Pitch Arena, scan one of its codes                 | **Entry granted** — being full doesn't block check-in                          |     |

---

## Suite H — Non-functional

| ID  | Scenario                   | Steps                                                              | Expected result                                                          | ✓   |
| --- | -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ | --- |
| H1  | Page speed                 | Click through `/`, `/events`, `/host`, `/checkin`                  | Each settles in roughly a second; no blank screens                       |     |
| H2  | Skeletons, not blank pages | Throttle to "Fast 3G" in DevTools and navigate                     | Layout and headings appear immediately, data streams in behind skeletons |     |
| H3  | Live dashboard updates     | Keep an event dashboard open, check someone in from another window | Counts and activity feed update within ~4s without a manual reload       |     |
| H4  | Mobile layout              | DevTools → iPhone SE (375px) on every page                         | No horizontal scrolling. Hamburger menu opens and its links work         |     |
| H5  | Keyboard only              | Tab through sign-in, create-event and the gate                     | Every control reachable, focus ring always visible, Enter submits        |     |
| H6  | Screen-reader verdicts     | With a screen reader on, perform a check-in                        | The granted/denied verdict is announced                                  |     |
| H7  | Reduced motion respected   | OS setting "Reduce motion" on, reload `/`                          | Content is visible with animations suppressed                            |     |
| H8  | JavaScript disabled        | Disable JS, open `/`                                               | Text and layout still readable (no permanently invisible content)        |     |
| H9  | Back/forward navigation    | Move through several pages, then use browser Back and Forward      | Correct pages, no stale counts, still signed in                          |     |
| H10 | Two tabs stay consistent   | Sign out in one tab, navigate in the other                         | The second tab also behaves as signed out                                |     |

---

## Already covered by automated tests

These run in seconds and don't need manual repetition — run them first and you can
skip the matching manual cases.

```bash
npm test          # 18 integration tests, ~35s
npm run test:e2e  # 2 full browser journeys, ~40s
```

Both suites **clean up after themselves** — every account, event, registration and
gate log they create is removed when they finish, so the demo data is byte-for-byte
unchanged. Run them as often as you like, including right before a demo.

| Automated test                                                                            | Covers                            |
| ----------------------------------------------------------------------------------------- | --------------------------------- |
| `npm test` → "DEMO: registers … rejects a second check-in"                                | D2, D3, D6, D7, D8                |
| `npm test` → "enforces capacity, even with simultaneous registrations"                    | G2 (incl. 15 concurrent sign-ups) |
| `npm test` → "blocks the same account registering twice"                                  | G3, G4                            |
| `npm test` → "issues the ticket to the signed-in account, ignoring any email in the body" | D4                                |
| `npm test` → "admits a ticket exactly once … several gates at the same instant"           | D7 under race conditions          |
| `npm test` → "accepts sloppy manual entry and rejects unknown or malformed codes"         | E1–E5                             |
| `npm test` → "rejects a valid ticket at another event's gate without using it up"         | E7, E8                            |
| `npm test` → "refuses to let one host burn another host's ticket"                         | F5, F6                            |
| `npm test` → "logs every gate attempt"                                                    | D9, E12                           |
| `npm run test:e2e` → "host creates an event, attendee registers…"                         | A4, B2, C7, D1–D10, F10           |
| `npm run test:e2e` → "a host account is turned away at the attendee portal"               | B14, F8                           |

**Still manual, and worth the time:** all of Suite A (gates), B1/B8–B13 (attendee
UI), C4/C12–C16 (host UI), E10/E11 (camera and image scanning), F1–F4/F7 (isolation),
H1–H10 (non-functional).

---

## Sign-off

| Suite                               | Cases  | Passed | Failed | Notes |
| ----------------------------------- | ------ | ------ | ------ | ----- |
| A — Access control while signed out | 11     |        |        |       |
| B — Attendee portal                 | 15     |        |        |       |
| C — Host portal                     | 16     |        |        |       |
| D — Core demo scenario              | 10     |        |        |       |
| E — Check-in gate                   | 12     |        |        |       |
| F — Cross-account isolation         | 11     |        |        |       |
| G — Capacity and duplicates         | 6      |        |        |       |
| H — Non-functional                  | 10     |        |        |       |
| **Total**                           | **91** |        |        |       |

Tester: ................................ Date: ....................

Build / commit under test: ....................................
