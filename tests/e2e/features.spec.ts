import { expect, test } from "@playwright/test";
import { makePng, signUp } from "./helpers";

/**
 * Smoke tests for the features added after the core demo: rich profiles,
 * 300 KB image uploads, richer events, the edit page and Aanaya's call console.
 *
 * Nothing here dials a phone. Test accounts never get a mobile number, so the
 * call console has nobody to call, and the only Aanaya action exercised is the
 * voice preview (Sarvam + OpenAI, no phone line).
 */

test("signed-out visitors can't reach profiles, event editing or the call console", async ({ page, request }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/signin\?next=%2Fprofile/);

  const fakeId = "00000000-0000-4000-8000-000000000000";
  // Sign-in returns to the page that was asked for, not just the event dashboard.
  for (const path of [`/events/${fakeId}/edit`, `/events/${fakeId}/calls`]) {
    await page.goto(path);
    await expect(page).toHaveURL(`/host/signin?next=${encodeURIComponent(path)}`);
  }

  expect((await request.get("/api/profile")).status()).toBe(401);
  expect((await request.put("/api/profile", { data: { name: "Nobody" } })).status()).toBe(401);
  expect((await request.put("/api/profile/avatar")).status()).toBe(401);
  expect((await request.get(`/api/events/${fakeId}/calls`)).status()).toBe(401);
  expect((await request.post(`/api/events/${fakeId}/calls`, { data: {} })).status()).toBe(401);
  expect((await request.post(`/api/events/${fakeId}/reminders/preview`, { data: {} })).status()).toBe(401);

  // Phone-provider webhooks refuse anything without our signed call id, and the
  // scheduler refuses anyone without its token.
  for (const hook of ["answer", "ring", "hangup", "recording"]) {
    expect((await request.post(`/api/voice/${hook}?id=fake&t=forged`)).status()).toBe(403);
  }
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
  expect((await request.get("/api/cron/reminders", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
});

test("an attendee builds a rich profile with a photo that fits in 300 KB", async ({ page }) => {
  const stamp = Date.now();
  await signUp(page, "attendee", "Priya Shah", `profile.${stamp}@e2e.test`);
  await page.goto("/profile");

  // A large photo is optimised in the browser to fit the limit, then stored.
  // (The size badge appears once it's compressed; wait for the upload itself.)
  const uploaded = page.waitForResponse(
    (r) => r.url().endsWith("/api/profile/avatar") && r.request().method() === "PUT",
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: makePng(1800, 1200, { noise: 40 }),
  });
  await expect(page.getByText(/\d+ KB \/ 300 KB/)).toBeVisible({ timeout: 30_000 });
  expect((await uploaded).status()).toBe(200);

  // A malformed mobile number is refused, and nothing is saved.
  await page.getByLabel("Mobile number").fill("12345");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText(/valid.*(mobile|number)|10-digit|Indian/i).first()).toBeVisible();
  await page.getByLabel("Mobile number").fill("");

  await page.getByLabel("Short description").fill("Final-year CE student who loves hackathons.");
  await page.getByLabel("College").fill("Atmiya University");
  await page.getByLabel("City").fill("Rajkot");
  await page.getByLabel("Department").fill("Computer Engineering");
  for (const skill of ["React", "Python"]) {
    await page.getByLabel("Skills").fill(skill);
    await page.getByLabel("Skills").press("Enter");
  }
  await page.getByLabel("Hobbies").fill("Chess");
  await page.getByLabel("Hobbies").press("Enter");
  await page.getByLabel("LinkedIn").fill("linkedin.com/in/priya-e2e");
  await page.getByLabel("GitHub").fill("priya-e2e");
  await page.getByRole("radio", { name: /Gujarati/ }).click();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved ✓")).toBeVisible();

  // Everything survives a reload.
  await page.reload();
  await expect(page.getByLabel("College")).toHaveValue("Atmiya University");
  await expect(page.getByLabel("City")).toHaveValue("Rajkot");
  await expect(page.getByRole("button", { name: "Remove React" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Chess" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Gujarati/ })).toHaveAttribute("aria-checked", "true");

  const { profile } = await (await page.request.get("/api/profile")).json();
  expect(profile).toMatchObject({ college: "Atmiya University", city: "Rajkot", callLanguage: "gu" });
  expect(profile.skills).toEqual(expect.arrayContaining(["React", "Python"]));
  expect(profile.phone ?? null).toBeNull();
  expect(profile.avatarUrl).toBeTruthy();
  const photo = await page.request.get(profile.avatarUrl);
  expect(photo.status()).toBe(200);
  expect((await photo.body()).length).toBeLessThanOrEqual(300 * 1024);

  // The server enforces the limit and the file type on its own, whatever the browser does.
  const tooBig = await page.request.put("/api/profile/avatar", {
    multipart: { file: { name: "big.png", mimeType: "image/png", buffer: makePng(400, 400, { noise: 256 }) } },
  });
  expect(tooBig.status()).toBe(400);
  expect((await tooBig.json()).error.message).toMatch(/300 KB/);
  const notAnImage = await page.request.put("/api/profile/avatar", {
    multipart: { file: { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("definitely not a png") } },
  });
  expect(notAnImage.status()).toBe(400);
});

test("a host runs a rich event: details, cover, edits and Aanaya's call console", async ({ browser }) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const eventName = `E2E Hack ${stamp}`;
  const hostCtx = await browser.newContext();
  const attendeeCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const attendee = await attendeeCtx.newPage();

  // ── 1. Create an event with every new field ─────────────────────────────
  await signUp(host, "host", "E2E Host", `richhost.${stamp}@e2e.test`);
  await host.goto("/events/new");
  await host.getByLabel("Event name").fill(eventName);
  await host.getByRole("radio", { name: /Hackathon/ }).click();
  // Competitions start with a 1st / 2nd / 3rd prize list.
  await expect(host.getByLabel("Prize 1 name")).toHaveValue("🥇 1st place");
  await expect(host.getByLabel("Prize 3 name")).toHaveValue("🥉 3rd place");
  await host.getByLabel("Venue").fill("Innovation Lab 2");
  await host.getByLabel("Description").fill("24-hour build sprint. Bring a laptop.");
  await host.getByLabel("Starts at").fill("2030-02-10T10:00");
  await host.getByLabel("Ends at").fill("2030-02-10T09:00");
  await host.getByLabel("Participant capacity").fill("50");
  await host.getByLabel("Entry fee (₹)").fill("150");
  await host.locator('input[type="file"]').setInputFiles({
    name: "banner.png",
    mimeType: "image/png",
    buffer: makePng(1200, 400, { noise: 20 }),
  });

  // An end before the start, and prizes without a reward, are refused.
  await host.getByRole("button", { name: "Create event" }).click();
  await expect(host.getByText("The end must be after the start")).toBeVisible();
  await expect(host.getByText("Say what the winner gets")).toBeVisible();
  await expect(host).toHaveURL(/\/events\/new/);

  await host.getByLabel("Ends at").fill("2030-02-10T18:00");
  await host.getByLabel("Prize 1 reward").fill("₹10,000");
  await host.getByLabel("Prize 2 reward").fill("₹5,000");
  await host.getByRole("button", { name: "Remove prize 3" }).click();
  await host.getByRole("button", { name: "Create event" }).click();
  await expect(host).toHaveURL(/\/events\/[^/]+\?created=1/, { timeout: 30_000 });
  const eventId = new URL(host.url()).pathname.split("/").pop()!;

  const { event } = await (await host.request.get(`/api/events/${eventId}`)).json();
  expect(event).toMatchObject({ type: "HACKATHON", entryFee: 150, stats: { capacity: 50 } });
  expect(event.prizes).toEqual([
    { title: "🥇 1st place", reward: "₹10,000" },
    { title: "🥈 2nd place", reward: "₹5,000" },
  ]);
  expect(new Date(event.endsAt).getTime()).toBeGreaterThan(new Date(event.startsAt).getTime());
  expect(event.coverUrl).toBeTruthy();
  expect((await host.request.get(event.coverUrl)).status()).toBe(200);

  // ── 2. An attendee sees the details and registers (no mobile number) ─────
  await signUp(attendee, "attendee", "Rohan Mehta", `richattendee.${stamp}@e2e.test`);
  await attendee.goto(`/events/${eventId}/register`);
  await expect(attendee.getByText(/Hackathon/).first()).toBeVisible();
  await expect(attendee.getByText(/₹150/).first()).toBeVisible();
  await expect(attendee.getByText("₹10,000").first()).toBeVisible();
  await attendee.getByRole("button", { name: /Register & get my QR ticket/ }).click();
  await expect(attendee).toHaveURL(/\/tickets\/EE-/);

  // ── 3. The host edits the event ──────────────────────────────────────────
  await host.goto(`/events/${eventId}/edit`);
  await expect(host.getByLabel("Event name")).toHaveValue(eventName);
  await host.getByLabel("Venue").fill("Innovation Lab 3");
  await host.getByRole("button", { name: "Save changes" }).click();
  await expect(host).toHaveURL(/\?updated=1/);
  await expect(host.getByText("Innovation Lab 3").first()).toBeVisible();

  // ── 4. The call console: list, guards, schedule, voice preview ───────────
  await host.goto(`/events/${eventId}/calls`);
  await expect(host.getByRole("heading", { name: "Reminder calls" })).toBeVisible();
  await expect(host.getByText("Rohan Mehta")).toBeVisible();
  await expect(host.getByText("No number").first()).toBeVisible();

  // Nobody has a number, so "call everyone" has nothing to dial.
  const nobody = await host.request.post(`/api/events/${eventId}/calls`, { data: {} });
  expect(nobody.status()).toBe(409);
  expect((await nobody.json()).error.message).toMatch(/missing a mobile number/);

  // Only the event's host can see or start its calls.
  expect((await attendee.request.get(`/api/events/${eventId}/calls`)).status()).toBe(403);
  expect((await attendee.request.post(`/api/events/${eventId}/calls`, { data: {} })).status()).toBe(403);

  // The schedule validates, saves, and switches off again.
  const reminders = (data: object) => host.request.put(`/api/events/${eventId}/reminders`, { data });
  expect((await reminders({ reminderEnabled: true, reminderLeadMinutes: 2 })).status()).toBe(400);
  const on = await reminders({
    reminderEnabled: true,
    reminderLeadMinutes: 60,
    reminderLanguage: "auto",
    reminderArriveEarly: 10,
  });
  expect(on.status()).toBe(200);
  expect((await reminders({ reminderEnabled: false })).status()).toBe(200);

  // "Hear what Aanaya says": real script + Bulbul v3 voice, no phone call.
  await host.getByRole("button", { name: /Generate Hindi preview/ }).click();
  const audio = host.locator("audio");
  await expect(audio).toHaveAttribute("src", /voice-prompts/, { timeout: 60_000 });
  await expect(host.getByText(/✓ Call ≈ \d+s \/ 20s/)).toBeVisible();
  const clip = await host.request.get((await audio.getAttribute("src"))!);
  expect(clip.status()).toBe(200);
  expect(clip.headers()["content-type"]).toMatch(/audio/);

  await hostCtx.close();
  await attendeeCtx.close();
});
