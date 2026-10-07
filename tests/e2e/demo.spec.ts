import { expect, test } from "@playwright/test";

/**
 * The hackathon demo scenario, end to end through the UI:
 * create an event → register a participant → check them in →
 * reject a second check-in with the same code.
 */
test("register, check in, and reject a second check-in with the same code", async ({ page }) => {
  const stamp = Date.now();
  const eventName = `E2E Demo ${stamp}`;

  // 1. Create an event with a capacity
  await page.goto("/events/new");
  await page.getByLabel("Event name").fill(eventName);
  await page.getByLabel("Venue").fill("Main Auditorium");
  await page.getByLabel("Starts at").fill("2030-01-15T10:00");
  await page.getByLabel("Participant capacity").fill("2");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/events\/[^/]+\?created=1/);
  await expect(page.getByRole("heading", { name: eventName })).toBeVisible();

  // 2. Register a participant and receive a unique entry code + QR
  await page.getByRole("link", { name: /Register participant/ }).click();
  await page.getByLabel("Full name").fill("Aisha Khan");
  await page.getByLabel("College email").fill(`aisha.${stamp}@campus.edu`);
  await page.getByRole("button", { name: /Register & get my QR ticket/ }).click();
  await expect(page).toHaveURL(/\/tickets\/EE-/);
  const code = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
  expect(code).toMatch(/^EE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await expect(page.locator("[data-code]")).toHaveText(code);
  await expect(page.getByLabel(`Ticket for ${eventName}`).locator("svg").first()).toBeVisible();

  // The same email can't register twice
  const dup = await page.request.post(`/api/events/${await eventIdFromTicket(page)}/registrations`, {
    data: { name: "Aisha Again", email: `AISHA.${stamp}@campus.edu` },
  });
  expect(dup.status()).toBe(409);

  // 3. Check in at the gate
  await page.getByRole("link", { name: /Verify this ticket at the check-in gate/ }).click();
  await expect(page).toHaveURL(/\/checkin\?/);
  await expect(page.locator("#entry-code")).toHaveValue(code.slice(3));
  await page.getByRole("button", { name: /Verify & check in/ }).click();
  const verdict = page.locator('[role="status"][aria-live="assertive"]');
  await expect(verdict).toContainText("Entry granted");
  await expect(verdict).toContainText("Aisha Khan");

  // 4. A second check-in with the same code is rejected
  await page.getByRole("button", { name: /Verify & check in/ }).click();
  await expect(verdict).toContainText("Already checked in");
  await expect(verdict).toContainText("Entry denied");

  // 5. Counts reflect one registration and one attendee
  const eventId = new URL(page.url()).searchParams.get("event")!;
  const live = await (await page.request.get(`/api/events/${eventId}/live`)).json();
  expect(live.stats).toMatchObject({ capacity: 2, registered: 1, checkedIn: 1, remaining: 1 });
  expect(live.gate).toMatchObject({ SUCCESS: 1, DUPLICATE: 1 });
});

async function eventIdFromTicket(page: import("@playwright/test").Page) {
  const href = await page.getByRole("link", { name: /Verify this ticket at the check-in gate/ }).getAttribute("href");
  return new URL(href!, "http://x").searchParams.get("event")!;
}
