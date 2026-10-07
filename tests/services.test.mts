/**
 * Integration tests for the core flows against a throw-away SQLite database:
 * capacity, duplicate registrations, check-in exactly once (incl. races).
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "eventease-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
execSync("npx prisma migrate deploy", { stdio: "ignore", env: process.env });

// Import after DATABASE_URL is set so the Prisma client points at the test DB.
const { prisma } = await import("../src/lib/prisma");
const { createEvent, getEventStats } = await import("../src/lib/services/events");
const { registerParticipant, getTicket } = await import("../src/lib/services/registrations");
const { checkIn } = await import("../src/lib/services/checkin");
const { isAppError } = await import("../src/lib/errors");

const soon = () => new Date(Date.now() + 86_400_000).toISOString();

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (err: unknown) => isAppError(err) && err.code === code);
}

describe("EventEase core flows", () => {
  before(async () => {
    await prisma.$connect();
  });
  after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates an event with a capacity", async () => {
    const event = await createEvent({ name: "Robotics Workshop", venue: "Lab 2", startsAt: soon(), capacity: 30 });
    assert.equal(event.stats.capacity, 30);
    assert.equal(event.stats.registered, 0);
    assert.equal(event.stats.remaining, 30);
  });

  it("validates event input", async () => {
    await rejectsWith(createEvent({ name: "X", venue: "Hall", startsAt: soon(), capacity: 10 }), "VALIDATION_ERROR");
    await rejectsWith(
      createEvent({ name: "Valid name", venue: "Hall", startsAt: soon(), capacity: 0 }),
      "VALIDATION_ERROR",
    );
    await rejectsWith(
      createEvent({ name: "Valid name", venue: "Hall", startsAt: "not a date", capacity: 5 }),
      "VALIDATION_ERROR",
    );
  });

  it("DEMO: registers a participant, checks them in, and rejects a second check-in with the same code", async () => {
    const event = await createEvent({ name: "Demo Night", venue: "Main Hall", startsAt: soon(), capacity: 100 });
    const reg = await registerParticipant(event.id, { name: "Aisha Khan", email: "Aisha@Campus.edu" });
    assert.match(reg.code, /^EE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(reg.email, "aisha@campus.edu");

    const first = await checkIn(reg.code, event.id);
    assert.equal(first.status, "SUCCESS");

    const second = await checkIn(reg.code, event.id);
    assert.equal(second.status, "DUPLICATE");
    assert.ok(second.status === "DUPLICATE" && first.status === "SUCCESS" && second.checkedInAt === first.checkedInAt);

    const stats = await getEventStats(event.id);
    assert.deepEqual({ registered: stats?.registered, checkedIn: stats?.checkedIn }, { registered: 1, checkedIn: 1 });
  });

  it("blocks duplicate registrations for the same email (case-insensitive)", async () => {
    const event = await createEvent({ name: "Pitch Arena", venue: "Seminar Hall", startsAt: soon(), capacity: 10 });
    await registerParticipant(event.id, { name: "Dev Patel", email: "dev@campus.edu" });
    await rejectsWith(
      registerParticipant(event.id, { name: "Dev Patel", email: " DEV@campus.edu " }),
      "ALREADY_REGISTERED",
    );
  });

  it("enforces capacity, even with simultaneous registrations", async () => {
    const event = await createEvent({ name: "Tiny Room", venue: "Room 101", startsAt: soon(), capacity: 5 });
    const attempts = await Promise.allSettled(
      Array.from({ length: 15 }, (_, i) =>
        registerParticipant(event.id, { name: `Person ${i}`, email: `p${i}@campus.edu` }),
      ),
    );
    const ok = attempts.filter((a) => a.status === "fulfilled").length;
    const full = attempts.filter(
      (a) => a.status === "rejected" && isAppError(a.reason) && a.reason.code === "EVENT_FULL",
    ).length;
    assert.equal(ok, 5);
    assert.equal(full, 10);
    assert.equal((await getEventStats(event.id))?.registered, 5);
  });

  it("admits a ticket exactly once when scanned at several gates at the same instant", async () => {
    const event = await createEvent({ name: "Race Fest", venue: "Arena", startsAt: soon(), capacity: 50 });
    const reg = await registerParticipant(event.id, { name: "Racer", email: "race@campus.edu" });
    const results = await Promise.all(Array.from({ length: 12 }, () => checkIn(reg.code)));
    assert.equal(results.filter((r) => r.status === "SUCCESS").length, 1);
    assert.equal(results.filter((r) => r.status === "DUPLICATE").length, 11);
  });

  it("accepts sloppy manual entry and rejects unknown or malformed codes", async () => {
    const event = await createEvent({ name: "Open Mic", venue: "Cafeteria", startsAt: soon(), capacity: 20 });
    const reg = await registerParticipant(event.id, { name: "Riya", email: "riya@campus.edu" });
    const sloppy = reg.code.toLowerCase().replace(/-/g, " ");
    assert.equal((await checkIn(sloppy)).status, "SUCCESS");
    assert.equal((await checkIn("EE-ZZZZ-ZZZZ")).status, "INVALID");
    assert.equal((await checkIn("definitely not a code")).status, "INVALID");
  });

  it("rejects a valid ticket at another event's gate without using it up", async () => {
    const a = await createEvent({ name: "Event A", venue: "Hall A", startsAt: soon(), capacity: 5 });
    const b = await createEvent({ name: "Event B", venue: "Hall B", startsAt: soon(), capacity: 5 });
    const reg = await registerParticipant(a.id, { name: "Kabir", email: "kabir@campus.edu" });
    assert.equal((await checkIn(reg.code, b.id)).status, "WRONG_EVENT");
    assert.equal((await checkIn(reg.code, a.id)).status, "SUCCESS");
  });

  it("logs every gate attempt", async () => {
    const event = await createEvent({ name: "Audit Day", venue: "Hall", startsAt: soon(), capacity: 5 });
    const reg = await registerParticipant(event.id, { name: "Meera", email: "meera@campus.edu" });
    await checkIn(reg.code, event.id);
    await checkIn(reg.code, event.id);
    await checkIn("EE-ZZZZ-ZZZZ", event.id);
    const logs = await prisma.checkInLog.findMany({ where: { eventId: event.id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(
      logs.map((l) => l.result),
      ["SUCCESS", "DUPLICATE", "INVALID"],
    );
  });

  it("looks tickets up by code", async () => {
    const event = await createEvent({ name: "Lookup", venue: "Hall", startsAt: soon(), capacity: 5 });
    const reg = await registerParticipant(event.id, { name: "Tara", email: "tara@campus.edu" });
    const ticket = await getTicket(reg.code.toLowerCase());
    assert.equal(ticket?.name, "Tara");
    assert.equal(ticket?.event.name, "Lookup");
    assert.equal(await getTicket("EE-ZZZZ-ZZZZ"), null);
  });
});
