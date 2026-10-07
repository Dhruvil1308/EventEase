/**
 * Seeds the database with a few realistic college events, participants,
 * check-ins and gate activity so the dashboard looks alive on first run.
 *
 *   npm run db:seed        (also runs as part of `npm run setup` / `npm run db:reset`)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateEntryCode } from "../src/lib/codes";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set — see .env.example.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Demo accounts you can actually sign in with after seeding. */
const DEMO_PASSWORD = "eventease123";
const DEMO_HOST = { email: "host@eventease.demo", name: "Code Carnival Committee", organization: "Student Council" };
const DEMO_ATTENDEES = [
  { email: "aisha@eventease.demo", name: "Aisha Khan", studentId: "21CE045", department: "Computer" },
  { email: "rahul@eventease.demo", name: "Rahul Mehta", studentId: "21IT112", department: "IT" },
];

const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
const admin = supabaseConfigured
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Creates (or reuses) a real Supabase auth user so the demo accounts can sign
 * in. Without Supabase credentials the seed still runs — those profiles just
 * get a random id and can't be signed into.
 */
async function ensureAuthUser(email: string, name: string, role: "HOST" | "ATTENDEE"): Promise<string> {
  if (!admin) return randomUUID();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name, role },
  });
  if (!error && data.user) return data.user.id;

  // Already exists from a previous seed — find and reuse it.
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      user_metadata: { name, role },
    });
    return existing.id;
  }
  throw new Error(`Could not create or find the auth user for ${email}: ${error?.message}`);
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Started ~45 minutes ago, rounded to the half hour — "happening now". */
function inProgress() {
  const d = new Date(Date.now() - 45 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
  return d;
}

function at(daysFromNow: number, hour: number, minute = 0) {
  const d = new Date(Date.now() + daysFromNow * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const FIRST = [
  "Aarav",
  "Diya",
  "Kabir",
  "Ananya",
  "Vihaan",
  "Ishita",
  "Arjun",
  "Meera",
  "Rohan",
  "Sara",
  "Aditya",
  "Nisha",
  "Kunal",
  "Priya",
  "Dev",
  "Tara",
  "Rahul",
  "Zoya",
  "Yash",
  "Aisha",
  "Neel",
  "Kavya",
  "Omar",
  "Riya",
  "Siddharth",
  "Fatima",
  "Harsh",
  "Leela",
  "Manav",
  "Pooja",
  "Arnav",
  "Sneha",
  "Kiran",
  "Tanvi",
  "Aryan",
  "Maya",
];
const LAST = [
  "Sharma",
  "Patel",
  "Iyer",
  "Khan",
  "Reddy",
  "Mehta",
  "Das",
  "Nair",
  "Gupta",
  "Joshi",
  "Singh",
  "Kapoor",
  "Rao",
  "Bose",
  "Desai",
  "Verma",
  "Menon",
  "Shah",
];
const DEPTS = [
  "Computer Science",
  "Electronics",
  "Mechanical",
  "Civil",
  "Information Technology",
  "Biotech",
  "Design",
  "Management",
];

function person(i: number) {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7) % LAST.length];
  return {
    name: `${first} ${last}`,
    email: `${first}.${last}${i}`.toLowerCase() + "@campus.edu",
    studentId: `21${String(1000 + ((i * 37) % 9000)).padStart(4, "0")}`,
    department: DEPTS[(i * 3) % DEPTS.length],
  };
}

const EVENTS = [
  {
    name: "TechFest 2026 — Hackathon Kickoff",
    description: "36 hours, 60 teams, one stage. Opening ceremony, problem statements and team formation.",
    venue: "Main Auditorium, Block A",
    startsAt: at(2, 10),
    capacity: 150,
    theme: "aurora",
    registrations: 96,
    checkedIn: 0,
  },
  {
    name: "AI & Robotics Workshop",
    description: "Hands-on session building a line-following robot with a tiny on-device vision model.",
    venue: "Innovation Lab 2",
    startsAt: inProgress(),
    capacity: 40,
    theme: "neon",
    registrations: 37,
    checkedIn: 21,
  },
  {
    name: "Rhythm — Cultural Night",
    description: "Dance crews, the college band and a DJ set to close the fest. Bring your ID card.",
    venue: "Open Air Theatre",
    startsAt: at(5, 18),
    capacity: 300,
    theme: "sunset",
    registrations: 142,
    checkedIn: 0,
  },
  {
    name: "Startup Pitch Arena",
    description: "Ten student startups, five investors, three minutes each. Audience vote decides the wildcard.",
    venue: "Seminar Hall 3",
    startsAt: at(1, 16),
    capacity: 12,
    theme: "blossom",
    registrations: 12,
    checkedIn: 0,
  },
];

async function main() {
  await prisma.checkInLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.profile.deleteMany();

  // ── Demo accounts ────────────────────────────────────────────────────────
  const hostId = await ensureAuthUser(DEMO_HOST.email, DEMO_HOST.name, "HOST");
  await prisma.profile.create({
    data: {
      id: hostId,
      email: DEMO_HOST.email,
      name: DEMO_HOST.name,
      role: "HOST",
      organization: DEMO_HOST.organization,
    },
  });

  const demoAttendeeIds: string[] = [];
  for (const a of DEMO_ATTENDEES) {
    const id = await ensureAuthUser(a.email, a.name, "ATTENDEE");
    await prisma.profile.create({
      data: { id, email: a.email, name: a.name, role: "ATTENDEE", studentId: a.studentId, department: a.department },
    });
    demoAttendeeIds.push(id);
  }
  console.log(
    admin
      ? `  ✓ demo accounts ready (password: ${DEMO_PASSWORD})`
      : "  ! Supabase credentials missing — demo profiles created but not signed-in-able",
  );

  let personIndex = 0;
  for (const spec of EVENTS) {
    const { registrations, checkedIn, ...data } = spec;
    const event = await prisma.event.create({ data: { ...data, hostId } });

    // Build every row in memory first, then insert in batches. One round trip
    // per batch instead of one per row — the database is remote, so this is the
    // difference between a two-minute seed and a two-second one.
    const profileRows: {
      id: string;
      email: string;
      name: string;
      role: "ATTENDEE";
      studentId: string;
      department: string;
    }[] = [];
    const regRows: {
      id: string;
      eventId: string;
      userId: string;
      name: string;
      email: string;
      studentId: string;
      department: string;
      code: string;
      createdAt: Date;
      checkedInAt: Date | null;
    }[] = [];
    const logRows: {
      result: string;
      code: string;
      eventId: string;
      registrationId: string;
      createdAt: Date;
    }[] = [];

    for (let i = 0; i < registrations; i++) {
      const person_ = person(personIndex++);
      const createdAt = new Date(Date.now() - (registrations - i) * 47 * 60_000);

      // The first seats of each event go to the demo attendees so their
      // dashboard has real tickets to show.
      const demoId = demoAttendeeIds[i];
      const demo = demoId ? DEMO_ATTENDEES[i] : null;
      let userId = demoId;
      if (!userId) {
        userId = randomUUID();
        profileRows.push({
          id: userId,
          email: person_.email,
          name: person_.name,
          role: "ATTENDEE",
          studentId: person_.studentId,
          department: person_.department,
        });
      }

      // Simulate the gate for events that are already running.
      const attended = i < checkedIn;
      const checkedInAt = attended ? new Date(Date.now() - (checkedIn - i) * 2.5 * 60_000) : null;
      const id = randomUUID();
      const code = generateEntryCode();

      regRows.push({
        id,
        eventId: event.id,
        userId,
        name: demo?.name ?? person_.name,
        email: demo?.email ?? person_.email,
        studentId: demo?.studentId ?? person_.studentId,
        department: demo?.department ?? person_.department,
        code,
        createdAt,
        checkedInAt,
      });

      if (attended && checkedInAt) {
        logRows.push({ result: "SUCCESS", code, eventId: event.id, registrationId: id, createdAt: checkedInAt });
        if (i % 7 === 3) {
          // Someone tries to reuse a ticket a few minutes later.
          logRows.push({
            result: "DUPLICATE",
            code,
            eventId: event.id,
            registrationId: id,
            createdAt: new Date(checkedInAt.getTime() + 4 * 60_000),
          });
        }
      }
    }

    if (profileRows.length) await prisma.profile.createMany({ data: profileRows });
    if (regRows.length) await prisma.registration.createMany({ data: regRows });
    if (logRows.length) await prisma.checkInLog.createMany({ data: logRows });
    if (checkedIn > 0) {
      await prisma.checkInLog.create({
        data: {
          result: "INVALID",
          code: "EE-9QX4-TT2A",
          eventId: event.id,
          createdAt: new Date(Date.now() - 9 * 60_000),
        },
      });
    }
    console.log(`  ✓ ${event.name} — ${registrations}/${event.capacity} registered, ${checkedIn} checked in`);
  }
}

main()
  .then(async () => {
    console.log("🌱 Seed complete");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
