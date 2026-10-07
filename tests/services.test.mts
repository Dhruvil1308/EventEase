/**
 * Integration tests for the core flows: capacity, duplicate registrations,
 * check-in exactly once (incl. races), and the host/attendee ownership rules.
 *
 * These run against the database in DATABASE_URL. Prisma qualifies every query
 * with `"public"` when using a driver adapter, so a separate schema cannot
 * isolate them — instead every row this file creates hangs off a Profile it
 * created, and `after()` deletes those profiles. The schema cascades from
 * Profile to Event to Registration to CheckInLog, so nothing is left behind.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running the tests.");

const { prisma } = await import("../src/lib/prisma");
const { createEvent, getEventStats } = await import("../src/lib/services/events");
const { registerParticipant, getTicket } = await import("../src/lib/services/registrations");
const { checkIn } = await import("../src/lib/services/checkin");
const { isAppError } = await import("../src/lib/errors");

const soon = () => new Date(Date.now() + 86_400_000).toISOString();

let HOST = "";
let OTHER_HOST = "";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");

/** Every profile this run creates, so `after()` can remove them all. */
const created: string[] = [];
const startedAt = new Date();

/** A fresh attendee account. Tickets are always bound to one of these. */
async function attendee(label: string) {
  const id = randomUUID();
  const email = `${slug(label)}.${id.slice(0, 8)}@uat.invalid`;
  await prisma.profile.create({ data: { id, email, name: label, role: "ATTENDEE" } });
  created.push(id);
  return { id, email };
}

async function host(name: string) {
  const id = randomUUID();
  await prisma.profile.create({
    data: { id, email: `${slug(name)}.${id.slice(0, 8)}@uat.invalid`, name, role: "HOST" },
  });
  created.push(id);
  return id;
}

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (err: unknown) => isAppError(err) && err.code === code);
}

describe("EventEase core flows", () => {
  before(async () => {
    await prisma.$connect();
    HOST = await host("Primary Host");
    OTHER_HOST = await host("Other Host");
  });
  after(async () => {
    // Deleting the profiles cascades to their events, registrations and logs.
    await prisma.profile.deleteMany({ where: { id: { in: created } } });
    // Scans of unknown codes are logged against no event, so they cannot
    // cascade — remove the ones this run produced.
    await prisma.checkInLog.deleteMany({ where: { eventId: null, createdAt: { gte: startedAt } } });
    await prisma.$disconnect();
  });

  it("creates an event with a capacity, owned by its host", async () => {
    const event = await createEvent(
      { name: "Robotics Workshop", venue: "Lab 2", startsAt: soon(), capacity: 30 },
      HOST,
    );
    assert.equal(event.stats.capacity, 30);
    assert.equal(event.stats.registered, 0);
    assert.equal(event.stats.remaining, 30);
    assert.equal(event.hostId, HOST);
  });

  it("validates event input", async () => {
    await rejectsWith(
      createEvent({ name: "X", venue: "Hall", startsAt: soon(), capacity: 10 }, HOST),
      "VALIDATION_ERROR",
    );
    await rejectsWith(
      createEvent({ name: "Valid name", venue: "Hall", startsAt: soon(), capacity: 0 }, HOST),
      "VALIDATION_ERROR",
    );
    await rejectsWith(
      createEvent({ name: "Valid name", venue: "Hall", startsAt: "not a date", capacity: 5 }, HOST),
      "VALIDATION_ERROR",
    );
  });

  it("DEMO: registers a participant, checks them in, and rejects a second check-in with the same code", async () => {
    const event = await createEvent({ name: "Demo Night", venue: "Main Hall", startsAt: soon(), capacity: 100 }, HOST);
    const aisha = await attendee("Aisha Khan");
    const reg = await registerParticipant(event.id, { name: "Aisha Khan", email: aisha.email }, aisha);
    assert.match(reg.code, /^EE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(reg.userId, aisha.id);

    const first = await checkIn(reg.code, event.id, HOST);
    assert.equal(first.status, "SUCCESS");

    const second = await checkIn(reg.code, event.id, HOST);
    assert.equal(second.status, "DUPLICATE");
    assert.ok(second.status === "DUPLICATE" && first.status === "SUCCESS" && second.checkedInAt === first.checkedInAt);

    const stats = await getEventStats(event.id);
    assert.deepEqual({ registered: stats?.registered, checkedIn: stats?.checkedIn }, { registered: 1, checkedIn: 1 });
  });

  it("blocks the same account registering twice for one event", async () => {
    const event = await createEvent(
      { name: "Pitch Arena", venue: "Seminar Hall", startsAt: soon(), capacity: 10 },
      HOST,
    );
    const dev = await attendee("Dev Patel");
    await registerParticipant(event.id, { name: "Dev Patel", email: dev.email }, dev);
    await rejectsWith(
      registerParticipant(event.id, { name: "Dev Patel", email: dev.email }, dev),
      "ALREADY_REGISTERED",
    );
  });

  it("issues the ticket to the signed-in account, ignoring any email in the body", async () => {
    const event = await createEvent({ name: "Spoof Test", venue: "Hall", startsAt: soon(), capacity: 10 }, HOST);
    const real = await attendee("Real Person");
    const reg = await registerParticipant(event.id, { name: "Real Person", email: "attacker@evil.test" }, real);
    assert.equal(reg.email, real.email);
    assert.equal(reg.userId, real.id);
  });

  it("enforces capacity, even with simultaneous registrations", async () => {
    const event = await createEvent({ name: "Tiny Room", venue: "Room 101", startsAt: soon(), capacity: 5 }, HOST);
    const people = await Promise.all(Array.from({ length: 15 }, (_, i) => attendee(`Person ${i}`)));
    const attempts = await Promise.allSettled(
      people.map((p, i) => registerParticipant(event.id, { name: `Person ${i}`, email: p.email }, p)),
    );
    const ok = attempts.filter((a) => a.status === "fulfilled").length;
    const full = attempts.filter(
      (a) => a.status === "rejected" && isAppError(a.reason) && a.reason.code === "EVENT_FULL",
    ).length;
    const unexpected = attempts
      .filter((a) => a.status === "rejected" && !(isAppError(a.reason) && a.reason.code === "EVENT_FULL"))
      .map((a) => String((a as PromiseRejectedResult).reason).slice(0, 160));
    assert.deepEqual(unexpected, [], `unexpected registration failures: ${unexpected.join(" | ")}`);
    assert.equal(ok, 5);
    assert.equal(full, 10);
    assert.equal((await getEventStats(event.id))?.registered, 5);
  });

  it("admits a ticket exactly once when scanned at several gates at the same instant", async () => {
    const event = await createEvent({ name: "Race Fest", venue: "Arena", startsAt: soon(), capacity: 50 }, HOST);
    const racer = await attendee("Racer");
    const reg = await registerParticipant(event.id, { name: "Racer", email: racer.email }, racer);
    const results = await Promise.all(Array.from({ length: 12 }, () => checkIn(reg.code)));
    assert.equal(results.filter((r) => r.status === "SUCCESS").length, 1);
    assert.equal(results.filter((r) => r.status === "DUPLICATE").length, 11);
  });

  it("accepts sloppy manual entry and rejects unknown or malformed codes", async () => {
    const event = await createEvent({ name: "Open Mic", venue: "Cafeteria", startsAt: soon(), capacity: 20 }, HOST);
    const riya = await attendee("Riya");
    const reg = await registerParticipant(event.id, { name: "Riya", email: riya.email }, riya);
    const sloppy = reg.code.toLowerCase().replace(/-/g, " ");
    assert.equal((await checkIn(sloppy)).status, "SUCCESS");
    assert.equal((await checkIn("EE-ZZZZ-ZZZZ")).status, "INVALID");
    assert.equal((await checkIn("definitely not a code")).status, "INVALID");
  });

  it("rejects a valid ticket at another event's gate without using it up", async () => {
    const a = await createEvent({ name: "Event A", venue: "Hall A", startsAt: soon(), capacity: 5 }, HOST);
    const b = await createEvent({ name: "Event B", venue: "Hall B", startsAt: soon(), capacity: 5 }, HOST);
    const kabir = await attendee("Kabir");
    const reg = await registerParticipant(a.id, { name: "Kabir", email: kabir.email }, kabir);
    assert.equal((await checkIn(reg.code, b.id, HOST)).status, "WRONG_EVENT");
    assert.equal((await checkIn(reg.code, a.id, HOST)).status, "SUCCESS");
  });

  it("refuses to let one host burn another host's ticket", async () => {
    const event = await createEvent({ name: "Mine", venue: "Hall", startsAt: soon(), capacity: 5 }, HOST);
    const guest = await attendee("Guest");
    const reg = await registerParticipant(event.id, { name: "Guest", email: guest.email }, guest);

    // The other host's gate must not admit — or consume — this ticket.
    assert.equal((await checkIn(reg.code, undefined, OTHER_HOST)).status, "WRONG_EVENT");
    assert.equal((await checkIn(reg.code, event.id, HOST)).status, "SUCCESS");
  });

  it("logs every gate attempt", async () => {
    const event = await createEvent({ name: "Audit Day", venue: "Hall", startsAt: soon(), capacity: 5 }, HOST);
    const meera = await attendee("Meera");
    const reg = await registerParticipant(event.id, { name: "Meera", email: meera.email }, meera);
    await checkIn(reg.code, event.id, HOST);
    await checkIn(reg.code, event.id, HOST);
    await checkIn("EE-ZZZZ-ZZZZ", event.id, HOST);
    const logs = await prisma.checkInLog.findMany({ where: { eventId: event.id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(
      logs.map((l) => l.result),
      ["SUCCESS", "DUPLICATE", "INVALID"],
    );
  });

  it("looks tickets up by code", async () => {
    const event = await createEvent({ name: "Lookup", venue: "Hall", startsAt: soon(), capacity: 5 }, HOST);
    const tara = await attendee("Tara");
    const reg = await registerParticipant(event.id, { name: "Tara", email: tara.email }, tara);
    const ticket = await getTicket(reg.code.toLowerCase());
    assert.equal(ticket?.name, "Tara");
    assert.equal(ticket?.event.name, "Lookup");
    assert.equal(await getTicket("EE-ZZZZ-ZZZZ"), null);
  });
});
