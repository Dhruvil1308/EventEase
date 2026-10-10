/**
 * Unit tests for the reminder-call building blocks and the new validation —
 * pure functions only, no database or network.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.NEXT_PUBLIC_TIMEZONE = "Asia/Kolkata";
process.env.SUPABASE_SECRET_KEY ??= "test-secret-key";

const { normalizePhone, formatPhone, maskPhone } = await import("../src/lib/phone");
const {
  buildReminderScript,
  classifyReplyByKeywords,
  replyWindowSeconds,
  spokenStartTime,
  speakableName,
  matchesScript,
} = await import("../src/lib/voice/script");
const { wavDurationMs, sniffAudio } = await import("../src/lib/voice/wav");
const { sign, verify } = await import("../src/lib/voice/secret");
const { createEventSchema, profileSchema, registerSchema } = await import("../src/lib/validation");
const { sniffImageType } = await import("../src/lib/media");
const { formatEndTime } = await import("../src/lib/format");

/** 10:00 IST on 8 Oct 2026, expressed in UTC. */
const NOW = new Date("2026-10-08T04:30:00Z");
const ist = (iso: string) => new Date(`${iso}+05:30`);

describe("phone numbers", () => {
  it("normalises the ways people type Indian mobiles to E.164", () => {
    for (const raw of ["9876543210", "+91 98765 43210", "919876543210", "098765-43210", " (+91) 98765.43210 "]) {
      assert.equal(normalizePhone(raw), "+919876543210", raw);
    }
  });
  it("keeps valid international numbers and rejects junk", () => {
    assert.equal(normalizePhone("+14155550123"), "+14155550123");
    assert.equal(normalizePhone("12345"), null);
    assert.equal(normalizePhone("5876543210"), null); // Indian mobiles start 6–9
    assert.equal(normalizePhone(""), null);
  });
  it("formats and masks for display", () => {
    assert.equal(formatPhone("+919876543210"), "+91 98765 43210");
    assert.equal(maskPhone("+919876543210"), "+91 98••• •••10");
  });
});

describe("spoken start time", () => {
  it("says today / tomorrow / a date, in each language", () => {
    assert.equal(spokenStartTime(ist("2026-10-08T18:30:00"), "en", NOW), "today at 6:30 PM");
    assert.equal(spokenStartTime(ist("2026-10-09T10:00:00"), "en", NOW), "tomorrow at 10 AM");
    assert.equal(spokenStartTime(ist("2026-10-16T11:00:00"), "en", NOW), "on Friday, 16 October at 11 AM");
    assert.equal(spokenStartTime(ist("2026-10-08T18:30:00"), "hi", NOW), "आज शाम 6:30 बजे");
    assert.equal(spokenStartTime(ist("2026-10-09T10:00:00"), "hi", NOW), "कल सुबह 10 बजे");
    assert.equal(spokenStartTime(ist("2026-10-09T10:00:00"), "gu", NOW), "આવતીકાલે સવારે 10 વાગ્યે");
    assert.equal(spokenStartTime(ist("2026-10-16T21:00:00"), "gu", NOW), "16 ઑક્ટોબર ના રોજ રાત્રે 9 વાગ્યે");
  });
});

describe("reminder script", () => {
  const base = { eventName: "AI & Robotics Workshop", startsAt: ist("2026-10-09T10:00:00"), arriveEarly: 10, now: NOW };

  it("follows the host's Hindi wording", () => {
    const s = buildReminderScript({ ...base, language: "hi" });
    assert.match(s, /^हैलो, मैं आनाया यहाँ से बात कर रही हूँ।/);
    assert.ok(s.includes("AI & Robotics Workshop, कल सुबह 10 बजे"));
    assert.ok(s.includes("तो आप 10 मिनट पहले आ जाना।"));
  });
  it("has Gujarati and English versions", () => {
    assert.ok(buildReminderScript({ ...base, language: "gu" }).includes("10 મિનિટ વહેલા આવી જજો"));
    assert.equal(
      buildReminderScript({ ...base, language: "en" }),
      "Hello, this is Aanaya calling. We're reminding you about AI & Robotics Workshop, tomorrow at 10 AM. Please come 10 minutes early. Thank you!",
    );
  });
  it("drops the 'arrive early' ask when it is 0 minutes", () => {
    assert.ok(buildReminderScript({ ...base, arriveEarly: 0, language: "en" }).includes("on time"));
  });
  it("trims very long event names at a word", () => {
    const name = speakableName("The Annual Inter-College Robotics, Coding and Design Championship Grand Finale 2026");
    assert.ok(name.length <= 60 && !name.endsWith(" "));
  });
  it("checks scripts are in the right writing system", () => {
    assert.ok(matchesScript("नमस्ते", "hi"));
    assert.ok(matchesScript("નમસ્તે", "gu"));
    assert.ok(!matchesScript("Hello", "gu"));
  });
});

describe("understanding replies without the LLM", () => {
  const cases: [string, string][] = [
    ["haan ji, aaunga", "CONFIRMED"],
    ["Yes sure, thank you", "CONFIRMED"],
    ["हाँ, ठीक है", "CONFIRMED"],
    ["હા, આવીશ", "CONFIRMED"],
    ["nahi, main nahi aa paunga", "DECLINED"],
    ["नहीं आ पाऊँगा", "DECLINED"],
    ["ના, નથી આવી શકતો", "DECLINED"],
    ["I can't make it", "DECLINED"],
    ["मैं आ जाना चाहता हूँ", "UNSURE"], // "ना" inside a word is not a "no"
    ["  ", "NO_RESPONSE"],
  ];
  for (const [text, intent] of cases) {
    it(`"${text}" → ${intent}`, () => assert.equal(classifyReplyByKeywords(text), intent));
  }
});

describe("20-second call budget", () => {
  it("fits the reply window into what's left", () => {
    assert.equal(replyWindowSeconds(9_000), 4);
    assert.equal(replyWindowSeconds(14_000), 4);
    assert.equal(replyWindowSeconds(15_500), 2);
    assert.equal(replyWindowSeconds(17_500), 0);
    assert.equal(replyWindowSeconds(25_000), 0);
  });
});

describe("audio and images", () => {
  function wav(sampleRate: number, dataBytes: number) {
    const buf = Buffer.alloc(44 + dataBytes);
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + dataBytes, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(dataBytes, 40);
    return new Uint8Array(buf);
  }
  it("reads WAV duration from the header", () => {
    assert.equal(wavDurationMs(wav(8000, 16_000)), 1000);
    assert.equal(wavDurationMs(wav(8000, 96_000)), 6000);
    assert.equal(wavDurationMs(new Uint8Array(10)), null);
  });
  it("identifies recordings and images by their bytes", () => {
    assert.equal(sniffAudio(wav(8000, 10)).ext, "wav");
    assert.equal(sniffAudio(new Uint8Array([0x49, 0x44, 0x33, 0x04])).ext, "mp3");
    assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
    assert.equal(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
    assert.equal(sniffImageType(new TextEncoder().encode("GIF89a")), null);
  });
});

describe("webhook signatures", () => {
  it("accepts our own signature and rejects tampering", () => {
    const sig = sign("call_123");
    assert.ok(verify("call_123", sig));
    assert.ok(!verify("call_124", sig));
    const flipped = `${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`;
    assert.ok(!verify("call_123", flipped));
    assert.ok(!verify("call_123", null));
  });
});

describe("validation", () => {
  const event = { name: "Hack Night", venue: "Lab 1", startsAt: "2030-01-01T10:00:00Z", capacity: 50 };

  it("accepts an end time after the start, rejects one before", () => {
    assert.ok(createEventSchema.safeParse({ ...event, endsAt: "2030-01-01T18:00:00Z" }).success);
    const bad = createEventSchema.safeParse({ ...event, endsAt: "2030-01-01T09:00:00Z" });
    assert.ok(!bad.success && bad.error.issues.some((i) => i.path[0] === "endsAt"));
    assert.equal(createEventSchema.parse({ ...event, endsAt: "" }).endsAt, null);
  });
  it("validates prizes, fee and reminder settings with sensible defaults", () => {
    const parsed = createEventSchema.parse({
      ...event,
      type: "COMPETITION",
      entryFee: "150",
      prizes: [{ title: " 1st place ", reward: "₹10,000" }],
    });
    assert.deepEqual(parsed.prizes, [{ title: "1st place", reward: "₹10,000" }]);
    assert.equal(parsed.entryFee, 150);
    assert.equal(parsed.reminderEnabled, false);
    assert.equal(parsed.reminderLanguage, "auto");
    assert.ok(!createEventSchema.safeParse({ ...event, reminderLeadMinutes: 2 }).success);
    assert.ok(!createEventSchema.safeParse({ ...event, prizes: [{ title: "", reward: "x" }] }).success);
  });
  it("normalises profile fields", () => {
    const p = profileSchema.parse({
      name: "Aisha Khan",
      phone: "98765 43210",
      skills: ["React", "react", " Python "],
      githubUrl: "aishak",
      linkedinUrl: "linkedin.com/in/aisha",
      bio: "",
    });
    assert.equal(p.phone, "+919876543210");
    assert.deepEqual(p.skills, ["React", "Python"]);
    assert.equal(p.githubUrl, "https://github.com/aishak");
    assert.equal(p.linkedinUrl, "https://linkedin.com/in/aisha");
    assert.equal(p.bio, null);
    assert.ok(!profileSchema.safeParse({ name: "Aisha", phone: "12345" }).success);
  });
  it("takes an optional phone and call language at registration", () => {
    const r = registerSchema.parse({ name: "Aisha", email: "a@x.in", phone: "+91 98765 43210", callLanguage: "gu" });
    assert.equal(r.phone, "+919876543210");
    assert.equal(r.callLanguage, "gu");
  });
});

describe("event time ranges", () => {
  it("shows only the end time on the same day, and the date too when it runs past midnight", () => {
    assert.equal(formatEndTime("2026-11-14T04:30:00Z", "2026-11-14T12:30:00Z"), "6:00 PM");
    assert.equal(formatEndTime("2026-11-14T04:30:00Z", "2026-11-15T04:30:00Z"), "Sun, Nov 15, 10:00 AM");
    // 10:30 PM → 12:30 AM in India is a different day there, though not in UTC.
    assert.equal(formatEndTime("2026-11-14T17:00:00Z", "2026-11-14T19:00:00Z"), "Sun, Nov 15, 12:30 AM");
  });
});
