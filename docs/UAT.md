# EventEase — UAT Test Scenarios

User acceptance tests for the college event registration & QR check-in app.
**159 cases across 12 suites.** Suites A–H cover the core app; I–L cover profiles,
richer events, Aanaya's reminder calls and the local setup. Each suite can be run on its own.

---

## Before you start (≈5 minutes)

```bash
npm install
npm run dev:calls   # app + ngrok tunnel — prints the local URL and the webhook URL
```

Use the local URL it prints: `http://localhost:3000`, or `3001` when another app already
holds port 3000. Wherever this document says `localhost:3000`, use that URL.

> **⚠ The local `.env` points at the live database** — the same one the deployed site
> uses. **Never run `npm run db:seed` or `npm run db:reset`**: they wipe it. Follow
> three rules instead:
>
> 1. **Sign every new test account up with an email ending in `@e2e.test`**
>    (e.g. `uat.host1@e2e.test`). Afterwards `npm run test:cleanup` deletes those
>    accounts and everything they made — events, registrations, gate logs, call
>    records and uploaded images. Nothing else is touched.
> 2. **Only enter mobile numbers whose owners agreed to be called** — your own or a
>    teammate's. Aanaya places real phone calls, and each one uses Vobiz balance.
> 3. **While the app runs, scheduled reminders really fire** (Suite K). To switch that
>    off, uncomment `REMINDER_SCHEDULER="off"` in `.env` and restart.

### Test accounts

Demo accounts (use them if they exist in the database). For anything that creates
data, prefer fresh `@e2e.test` accounts.

| Role         | Email                  | Password       |
| ------------ | ---------------------- | -------------- |
| **Host**     | `host@eventease.demo`  | `eventease123` |
| **Attendee** | `aisha@eventease.demo` | `eventease123` |
| **Attendee** | `rahul@eventease.demo` | `eventease123` |

### Seeded events

The numbers below, and those quoted in A2, B9, C4, C5, C12, C13, G1 and G6, come from
freshly seeded demo data. On the live database they will differ — check that the
numbers on related screens agree with each other rather than matching these exactly.

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

## Suite I — Profiles

Use a fresh attendee account (`…@e2e.test`), and a host account for I15.

| ID  | Scenario                     | Steps                                                                                                    | Expected result                                                                                                          | ✓   |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --- |
| I1  | Profile needs an account     | Signed out, open `/profile`                                                                              | Redirected to `/signin?next=%2Fprofile`                                                                                  |     |
| I2  | Profile opens from the menu  | Sign in → avatar menu → profile link                                                                     | `/profile` opens: About you, Skills & hobbies, Links & preferences, a live profile card and a "Profile N% complete" ring |     |
| I3  | Upload a photo               | Click the photo area → choose a JPEG/PNG under 300 KB                                                    | Preview appears at once; badge reads `N KB / 300 KB`; the card shows the photo                                           |     |
| I4  | Big photo is optimised       | Choose a phone photo of several MB                                                                       | "Optimising…" then "Uploading…"; the stored size on the badge is ≤ 300 KB                                                |     |
| I5  | A non-image is refused       | Rename a `.txt` file to `.png` and choose it                                                             | An error under the photo; nothing is uploaded                                                                            |     |
| I6  | Remove the photo             | Click **Remove**                                                                                         | The photo is gone from the card and the navbar                                                                           |     |
| I7  | Bad mobile number refused    | Enter `12345` → **Save profile**                                                                         | "Enter a valid mobile number, e.g. 98765 43210"; nothing saved                                                           |     |
| I8  | Mobile number formats        | Enter **your own** number as `98765 43210`, then `+91 98765 43210`, then `09876543210`, saving each time | All accepted and shown in one consistent `+91` format                                                                    |     |
| I9  | Skills and hobbies           | Type a skill → Enter, add two more; remove one with its ×                                                | Chips appear and disappear; the card mirrors them                                                                        |     |
| I10 | Links saved                  | LinkedIn `linkedin.com/in/your-name`, GitHub `your-username` → save                                      | "Profile saved ✓"; both still there after a reload                                                                       |     |
| I11 | Bad link refused             | LinkedIn `not a link` → save                                                                             | "Enter a valid link"                                                                                                     |     |
| I12 | Call language                | Pick **ગુજરાતી** → save                                                                                  | Saved; the next registration form has Gujarati pre-selected under "Call me in"                                           |     |
| I13 | Everything survives a reload | Fill every field → save → hard-refresh                                                                   | Every field, chip, link, language and the photo are still there                                                          |     |
| I14 | Completeness ring            | Fill fields one by one                                                                                   | The "Profile N% complete" ring rises as each is added                                                                    |     |
| I15 | Hosts have a profile too     | As a host, open `/profile`, fill **Club or organization** → save                                         | Saved; works exactly like the attendee profile                                                                           |     |

---

## Suite J — Richer events, images and editing

Host in the normal window, attendee in incognito. Create every event in the future.

| ID  | Scenario                         | Steps                                                                           | Expected result                                                                                                    | ✓   |
| --- | -------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --- |
| J1  | Kind of event                    | `/events/new` → click each kind (Workshop, Competition, Hackathon…)             | One is selected at a time; the preview card shows its emoji and label                                              |     |
| J2  | Competitions start with prizes   | On a fresh form pick **Hackathon**                                              | Prize rows **🥇 1st place**, **🥈 2nd place**, **🥉 3rd place** appear with empty rewards                          |     |
| J3  | A prize needs a reward           | Leave a reward empty → **Create event**                                         | "Say what the winner gets"; nothing is created                                                                     |     |
| J4  | Add and remove prizes            | **+ Add prize** repeatedly; remove one with ×                                   | Rows add up to 10 (then the button disables) and remove individually                                               |     |
| J5  | Start and end time               | Starts 10:00, Ends 18:00 the same day → create                                  | The card and registration page show the start and the end time                                                     |     |
| J6  | End before start refused         | Ends 09:00 with a 10:00 start → **Create event**                                | "The end must be after the start"; nothing is created                                                              |     |
| J7  | Quick dates and durations        | Click a quick-date chip under Starts at, then a duration chip under Ends at     | Both fields fill in; the end equals the start plus that duration                                                   |     |
| J8  | Entry fee hint                   | Fee `150`, then `0`                                                             | Hints read "Shown as ₹150 — collected at the venue." and "0 means the event is free."                              |     |
| J9  | Fee shown to attendees           | Open the card on `/events` and the registration page                            | Card: **🎟 ₹150** (free events **🎟 Free**). Register page: "₹150 at the venue"                                      |     |
| J10 | Cover image                      | Choose a banner image → create                                                  | The cover shows on the event card, the registration page and the host dashboard                                    |     |
| J11 | Large cover optimised            | Choose a multi-MB banner                                                        | Optimised in the browser; stored at ≤ 300 KB                                                                       |     |
| J12 | Edit an event                    | Event dashboard → **Edit** → change the venue → **Save changes**                | Back on the dashboard (`?updated=1`); the new venue shows everywhere                                               |     |
| J13 | Editing keeps registrations      | Edit an event that has registrations and check-ins                              | Counts, tickets and gate log are unchanged                                                                         |     |
| J14 | Only the owner can edit          | As a second host, open `/events/<id>/edit`                                      | Redirected to `/host?denied=owner`                                                                                 |     |
| J15 | Sign-in returns to the edit page | Signed out, open `/events/<id>/edit` → sign in as the owner                     | Lands on the edit page, not the event dashboard                                                                    |     |
| J16 | Registration is pre-filled       | Attendee with a full profile opens `/events/<id>/register`                      | Name, email (read-only), student ID, department, mobile and "Call me in" come from the profile; mobile is optional |     |
| J17 | Delete an event                  | On a **test** event's dashboard → **Delete event** → **Yes, delete everything** | The event, its registrations and gate log are gone from `/host` and `/events`; **Cancel** backs out safely         |     |

---

## Suite K — Aanaya reminder calls

Run the app with `npm run dev:calls`. **Only call numbers whose owners agreed** —
register a `@e2e.test` attendee with your own mobile number for K10–K22.

| ID  | Scenario                             | Steps                                                                                      | Expected result                                                                                                                                                                         | ✓   |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| K1  | Console is for the event's host only | Open `/events/<id>/calls` signed out; as an attendee; as another host                      | Host sign-in (returning to the console) / `/dashboard?denied=host` / `/host?denied=owner`                                                                                               |     |
| K2  | Console opens                        | Event dashboard → **📞 Reminder calls**                                                    | "Reminder calls", "Gujarati · Hindi · English — every call under 20 seconds.", stats tiles and a row per registrant                                                                     |     |
| K3  | Setup checklist without a tunnel     | Stop the app, run plain `npm run dev`, reopen the console                                  | "Finish setting up Aanaya" lists the public webhook URL as missing; **📞 Call everyone one by one** is disabled                                                                         |     |
| K4  | Setup complete                       | Back to `npm run dev:calls`, reload                                                        | No checklist; Call buttons enabled for people with a number                                                                                                                             |     |
| K5  | No number, no call                   | Look at a registrant without a mobile number                                               | Row reads **No number** with no Call button; they're left out of "Call everyone"                                                                                                        |     |
| K6  | Search and filter                    | Search by name, email or number; use the filter                                            | The list narrows to matching registrants                                                                                                                                                |     |
| K7  | Hear the Hindi message               | 🎧 panel → **हिन्दी** → **Generate Hindi preview**                                         | Devanagari script naming the event, its day and time, and the minutes-early ask; audio plays in Aanaya's voice; badges show the message length, reply window and **✓ Call ≈ N s / 20s** |     |
| K8  | Gujarati and English                 | Repeat K7 with **ગુજરાતી** and **English**                                                 | Script in that language and writing system; still ✓ under 20 s                                                                                                                          |     |
| K9  | Regenerate                           | **Regenerate & play**                                                                      | A fresh clip plays                                                                                                                                                                      |     |
| K10 | Call one person                      | Register yourself with your own mobile → console → **Call** on your row                    | Row moves Dialling… → Ringing… → On the call → **Reached**; your phone rings from the Vobiz number; Aanaya speaks your language; the line cuts within 20 s                              |     |
| K11 | "Yes" is understood                  | Answer and say "haan, main aa jaunga" (or "yes, I'll come")                                | After the call the row shows **👍 Coming** and what you said                                                                                                                            |     |
| K12 | "No" is understood                   | Call again; say "nahi aa paunga" (or "sorry, I can't come")                                | **✋ Can't come**                                                                                                                                                                       |     |
| K13 | Silence                              | Call again; say nothing                                                                    | **No reply**                                                                                                                                                                            |     |
| K14 | Not answered                         | Call again; decline it, then repeat and let it ring out                                    | **Busy / declined**, then **No answer** (gives up after about 30 s of ringing)                                                                                                          |     |
| K15 | Call again                           | On a reached row click **Call again**                                                      | A new call is placed and logged                                                                                                                                                         |     |
| K16 | Everyone, one by one                 | Two consenting numbers → **📞 Call everyone one by one (2)**                               | Strictly one call at a time; "N waiting in the queue" counts down                                                                                                                       |     |
| K17 | Skip people already reached          | Tick **Skip people already reached** → call everyone                                       | Reached people aren't called again; if all were reached the message says to untick the box                                                                                              |     |
| K18 | Stop the queue                       | During K16 click **Stop queue**                                                            | "Stopped — N queued call(s) canceled."; waiting rows read **Canceled**                                                                                                                  |     |
| K19 | Language for one batch               | Choose **English** in the batch language menu → call                                       | Aanaya speaks English whatever the attendee chose                                                                                                                                       |     |
| K20 | Each attendee's language             | Event setting **Each attendee's choice**; attendee chose ગુજરાતી                           | That call is in Gujarati                                                                                                                                                                |     |
| K21 | Save a schedule                      | Console → **Before the start** → pick a time → **Save schedule**; then try under 5 minutes | "Saved"; under 5 minutes is refused ("Call at least 5 minutes before the start")                                                                                                        |     |
| K22 | A scheduled call fires               | Event starting in ~20 min, schedule 15 min before, your own number registered, app running | The call arrives on its own at start − 15 min, once only                                                                                                                                |     |
| K23 | Scheduler can be switched off        | Uncomment `REMINDER_SCHEDULER="off"`, restart, repeat K22                                  | No automatic call; manual **Call** still works                                                                                                                                          |     |
| K24 | Forged webhooks rejected             | `curl -X POST "https://<NGROK_DOMAIN>/api/voice/answer?id=x&t=forged"`                     | `403`                                                                                                                                                                                   |     |
| K25 | Scheduler endpoint protected         | `curl https://<NGROK_DOMAIN>/api/cron/reminders`                                           | `401`                                                                                                                                                                                   |     |

---

## Suite L — Local setup and operations

| ID  | Scenario                       | Steps                                                               | Expected result                                                                                       | ✓   |
| --- | ------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --- |
| L1  | One command starts everything  | `npm run dev:calls`                                                 | Prints **EventEase http://localhost:N** and **Webhooks https://disliking-hulk-bauble.ngrok-free.dev** |     |
| L2  | Busy port is avoided           | Another app on port 3000, then L1                                   | "Port 3000 is busy, so EventEase runs on 3001."                                                       |     |
| L3  | Fixed port                     | `PORT=3005 npm run dev:calls`; then again while 3005 is taken       | Runs on 3005; the second time a clear "already in use" error                                          |     |
| L4  | Same webhook URL every time    | Stop and start twice                                                | The webhook URL never changes (static ngrok domain)                                                   |     |
| L5  | The tunnel reaches this laptop | Run K24 from another network (e.g. phone hotspot)                   | `403` — the request reached the local app                                                             |     |
| L6  | Ctrl+C stops both              | Press Ctrl+C                                                        | The app and ngrok both stop; the port is free again                                                   |     |
| L7  | Separate terminals still work  | `npm run dev` and `npm run tunnel` side by side                     | Same result as L1                                                                                     |     |
| L8  | Production build               | `npm run build`                                                     | Completes and lists every page and API route                                                          |     |
| L9  | Unit and integration tests     | `npm test`                                                          | 45 passed, 0 failed                                                                                   |     |
| L10 | Browser journeys               | With L1 running: `E2E_BASE_URL=http://localhost:N npm run test:e2e` | 5 passed; the teardown line reports what it removed                                                   |     |
| L11 | Test data cleanup              | After a manual session: `npm run test:cleanup`                      | Reports the `@e2e.test` profiles, auth users and files it removed                                     |     |

---

## Already covered by automated tests

These run in minutes and don't need manual repetition — run them first and you can
skip the matching manual cases.

```bash
npm test                                             # 45 unit + integration tests, ~40 s
npm run dev:calls                                    # terminal 1 — note the port
E2E_BASE_URL=http://localhost:3001 npm run test:e2e  # terminal 2 — 5 browser journeys, ~1.5 min
```

Both suites **clean up after themselves**: every account, event, registration, gate log,
uploaded image and generated call audio they create is removed when they finish, so
the data is left exactly as it was. No test ever places a phone call.

| Automated test                                                                                     | Covers                                           |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `npm test` → "DEMO: registers … rejects a second check-in"                                         | D2, D3, D6, D7, D8                               |
| `npm test` → "enforces capacity, even with simultaneous registrations"                             | G2 (incl. 15 concurrent sign-ups)                |
| `npm test` → "blocks the same account registering twice"                                           | G3, G4                                           |
| `npm test` → "issues the ticket to the signed-in account, ignoring any email in the body"          | D4                                               |
| `npm test` → "admits a ticket exactly once … several gates at the same instant"                    | D7 under race conditions                         |
| `npm test` → "accepts sloppy manual entry and rejects unknown or malformed codes"                  | E1–E5                                            |
| `npm test` → "rejects a valid ticket at another event's gate without using it up"                  | E7, E8                                           |
| `npm test` → "refuses to let one host burn another host's ticket"                                  | F5, F6                                           |
| `npm test` → "logs every gate attempt"                                                             | D9, E12                                          |
| `npm test` → phone numbers, validation                                                             | I7, I8, I11, J3, J6, K21 (rules)                 |
| `npm test` → reminder script, spoken start time, 20-second budget                                  | K7, K8 (script content and length)               |
| `npm test` → "understanding replies without the LLM", webhook signatures                           | K11–K13 (fallback), K24                          |
| `npm run test:e2e` → "host creates an event, attendee registers…"                                  | A4, B2, C7, D1–D10, F10                          |
| `npm run test:e2e` → "a host account is turned away at the attendee portal"                        | B14, F8                                          |
| `npm run test:e2e` → "signed-out visitors can't reach profiles, event editing or the call console" | I1, J15, K1 (signed out), K24, K25               |
| `npm run test:e2e` → "an attendee builds a rich profile with a photo that fits in 300 KB"          | I2–I5, I7, I9–I13                                |
| `npm run test:e2e` → "a host runs a rich event: details, cover, edits and Aanaya's call console"   | J1–J3, J5, J6, J8–J10, J12, J16, K2, K5, K7, K21 |

**Still manual, and worth the time:** all of Suite A (gates), B1/B8–B13 (attendee UI),
C4/C12–C16 (host UI), E10/E11 (camera and image scanning), F1–F4/F7 (isolation),
H1–H10 (non-functional), I6/I8/I14/I15, J4/J7/J11/J13/J14/J17, **K3–K4 and K6–K23 (real
calls — only to consenting numbers)**, and Suite L.

---

## Sign-off

| Suite                               | Cases   | Passed | Failed | Notes |
| ----------------------------------- | ------- | ------ | ------ | ----- |
| A — Access control while signed out | 11      |        |        |       |
| B — Attendee portal                 | 15      |        |        |       |
| C — Host portal                     | 16      |        |        |       |
| D — Core demo scenario              | 10      |        |        |       |
| E — Check-in gate                   | 12      |        |        |       |
| F — Cross-account isolation         | 11      |        |        |       |
| G — Capacity and duplicates         | 6       |        |        |       |
| H — Non-functional                  | 10      |        |        |       |
| I — Profiles                        | 15      |        |        |       |
| J — Richer events and editing       | 17      |        |        |       |
| K — Aanaya reminder calls           | 25      |        |        |       |
| L — Local setup and operations      | 11      |        |        |       |
| **Total**                           | **159** |        |        |       |

Tester: ................................ Date: ....................

Build / commit under test: ....................................
