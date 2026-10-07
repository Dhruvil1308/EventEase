import { expect, test, type Page } from "@playwright/test";

/**
 * The hackathon demo scenario, end to end through the UI, across both portals:
 * a host signs up and creates an event → an attendee signs up and registers →
 * the host checks them in → a second check-in with the same code is rejected.
 */

const PASSWORD = "eventease123";

async function signUp(page: Page, portal: "host" | "attendee", name: string, email: string) {
  await page.goto(portal === "host" ? "/host/signup" : "/signup");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(portal === "host" ? /\/host$/ : /\/dashboard$/);
}

test("host creates an event, attendee registers, gate admits once and rejects the reuse", async ({ browser }) => {
  const stamp = Date.now();
  const eventName = `E2E Demo ${stamp}`;
  const hostEmail = `host.${stamp}@e2e.test`;
  const attendeeEmail = `attendee.${stamp}@e2e.test`;

  const hostCtx = await browser.newContext();
  const attendeeCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const attendee = await attendeeCtx.newPage();

  // ── 1. Host signs up and creates an event with a capacity ─────────────────
  await signUp(host, "host", "E2E Host", hostEmail);
  await host.goto("/events/new");
  await host.getByLabel("Event name").fill(eventName);
  await host.getByLabel("Venue").fill("Main Auditorium");
  await host.getByLabel("Starts at").fill("2030-01-15T10:00");
  await host.getByLabel("Participant capacity").fill("2");
  await host.getByRole("button", { name: "Create event" }).click();
  await expect(host).toHaveURL(/\/events\/[^/]+\?created=1/);
  await expect(host.getByRole("heading", { name: eventName })).toBeVisible();
  const eventId = new URL(host.url()).pathname.split("/").pop()!;

  // ── 2. Signed-out visitors cannot register ───────────────────────────────
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`/events/${eventId}/register`);
  await expect(anon).toHaveURL(/\/signin\?next=/);
  await anon.context().close();

  // ── 3. Attendee signs up and registers, receiving a unique code + QR ──────
  await signUp(attendee, "attendee", "Aisha Khan", attendeeEmail);
  await attendee.goto(`/events/${eventId}/register`);
  await attendee.getByRole("button", { name: /Register & get my QR ticket/ }).click();
  await expect(attendee).toHaveURL(/\/tickets\/EE-/);

  const code = decodeURIComponent(new URL(attendee.url()).pathname.split("/").pop()!).replace(/\?.*$/, "");
  expect(code).toMatch(/^EE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await expect(attendee.locator("[data-code]")).toHaveText(code);

  // The same account can't take a second seat.
  const dup = await attendee.request.post(`/api/events/${eventId}/registrations`, {
    data: { name: "Aisha Again", email: attendeeEmail },
  });
  expect(dup.status()).toBe(409);

  // The ticket shows up on their dashboard.
  await attendee.goto("/dashboard");
  await expect(attendee.getByText(code)).toBeVisible();

  // ── 4. Host checks them in at the gate ───────────────────────────────────
  await host.goto(`/checkin?event=${eventId}&code=${encodeURIComponent(code)}`);
  await expect(host.locator("#entry-code")).toHaveValue(code.slice(3));
  const verdict = host.locator('[role="status"][aria-live="assertive"]');
  await host.getByRole("button", { name: /Verify & check in/ }).click();
  await expect(verdict).toContainText("Entry granted");
  await expect(verdict).toContainText("Aisha Khan");

  // ── 5. A second check-in with the same code is rejected ──────────────────
  await host.getByRole("button", { name: /Verify & check in/ }).click();
  await expect(verdict).toContainText("Entry denied");

  // ── 6. Counts reflect one registration and one attendee ──────────────────
  const live = await (await host.request.get(`/api/events/${eventId}/live`)).json();
  expect(live.stats).toMatchObject({ capacity: 2, registered: 1, checkedIn: 1, remaining: 1 });
  expect(live.gate).toMatchObject({ SUCCESS: 1, DUPLICATE: 1 });

  // ── 7. The attendee can't reach host-only tools or this event's data ──────
  await attendee.goto("/events/new");
  await expect(attendee).toHaveURL(/\/dashboard/);
  expect((await attendee.request.get(`/api/events/${eventId}/live`)).status()).toBe(403);

  await hostCtx.close();
  await attendeeCtx.close();
});

test("a host account is turned away at the attendee portal", async ({ page }) => {
  const stamp = Date.now();
  const email = `portal.${stamp}@e2e.test`;
  await signUp(page, "host", "Portal Host", email);

  // Sign out via the account menu, then try the wrong door.
  await page.getByRole("button", { name: /Portal Host/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("host account");
});
