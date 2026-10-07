/**
 * Seeds the database with a few realistic college events, participants,
 * check-ins and gate activity so the dashboard looks alive on first run.
 *
 *   npm run db:seed        (also runs as part of `npm run setup` / `npm run db:reset`)
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateEntryCode } from "../src/lib/codes";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

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

  let personIndex = 0;
  for (const spec of EVENTS) {
    const { registrations, checkedIn, ...data } = spec;
    const event = await prisma.event.create({ data });

    const regs = [];
    for (let i = 0; i < registrations; i++) {
      const p = person(personIndex++);
      const createdAt = new Date(Date.now() - (registrations - i) * 47 * 60_000);
      regs.push(
        await prisma.registration.create({
          data: { ...p, eventId: event.id, code: generateEntryCode(), createdAt },
        }),
      );
    }

    // Simulate the gate for events that are already running.
    for (let i = 0; i < checkedIn; i++) {
      const reg = regs[i];
      const time = new Date(Date.now() - (checkedIn - i) * 2.5 * 60_000);
      await prisma.registration.update({ where: { id: reg.id }, data: { checkedInAt: time } });
      await prisma.checkInLog.create({
        data: { result: "SUCCESS", code: reg.code, eventId: event.id, registrationId: reg.id, createdAt: time },
      });
      if (i % 7 === 3) {
        // Someone tries to reuse a ticket a few minutes later.
        await prisma.checkInLog.create({
          data: {
            result: "DUPLICATE",
            code: reg.code,
            eventId: event.id,
            registrationId: reg.id,
            createdAt: new Date(time.getTime() + 4 * 60_000),
          },
        });
      }
    }
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
