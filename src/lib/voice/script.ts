import type { CallLanguage } from "@/lib/call-languages";

/**
 * Aanaya's reminder script, in plain code so it is predictable and testable.
 * When an OpenAI key is configured the agent polishes this draft (see
 * agent.ts); this version is always the fallback.
 */

/** Calls go to Indian numbers, so times are spoken in the venue's zone. */
const voiceTimeZone = () => process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kolkata";

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: string };

function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "long",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

const MONTHS: Record<CallLanguage, string[]> = {
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  hi: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
  gu: [
    "જાન્યુઆરી",
    "ફેબ્રુઆરી",
    "માર્ચ",
    "એપ્રિલ",
    "મે",
    "જૂન",
    "જુલાઈ",
    "ઑગસ્ટ",
    "સપ્ટેમ્બર",
    "ઑક્ટોબર",
    "નવેમ્બર",
    "ડિસેમ્બર",
  ],
};

/** "6:30" or "10" — minutes only when they matter. */
const clock = (hour: number, minute: number) => {
  const h12 = hour % 12 || 12;
  return minute ? `${h12}:${String(minute).padStart(2, "0")}` : String(h12);
};

function dayPeriod(hour: number, language: "hi" | "gu") {
  const words = language === "hi" ? ["सुबह", "दोपहर", "शाम", "रात"] : ["સવારે", "બપોરે", "સાંજે", "રાત્રે"];
  if (hour >= 4 && hour < 12) return words[0];
  if (hour >= 12 && hour < 16) return words[1];
  if (hour >= 16 && hour < 20) return words[2];
  return words[3];
}

/**
 * When the event starts, the way a person would say it on the phone:
 * "tomorrow at 10 AM", "आज शाम 6:30 बजे", "આવતીકાલે સવારે 10 વાગ્યે".
 */
export function spokenStartTime(startsAt: Date, language: CallLanguage, now = new Date()): string {
  const tz = voiceTimeZone();
  const e = localParts(startsAt, tz);
  const n = localParts(now, tz);
  const dayDiff = Math.round(
    (Date.UTC(e.year, e.month - 1, e.day) - Date.UTC(n.year, n.month - 1, n.day)) / 86_400_000,
  );
  const month = MONTHS[language][e.month - 1];
  const time = clock(e.hour, e.minute);

  if (language === "en") {
    const at = `${time} ${e.hour < 12 ? "AM" : "PM"}`;
    if (dayDiff === 0) return `today at ${at}`;
    if (dayDiff === 1) return `tomorrow at ${at}`;
    return `on ${e.weekday}, ${e.day} ${month} at ${at}`;
  }
  if (language === "hi") {
    const at = `${dayPeriod(e.hour, "hi")} ${time} बजे`;
    if (dayDiff === 0) return `आज ${at}`;
    if (dayDiff === 1) return `कल ${at}`;
    return `${e.day} ${month} को ${at}`;
  }
  const at = `${dayPeriod(e.hour, "gu")} ${time} વાગ્યે`;
  if (dayDiff === 0) return `આજે ${at}`;
  if (dayDiff === 1) return `આવતીકાલે ${at}`;
  return `${e.day} ${month} ના રોજ ${at}`;
}

/** A local-date key ("2026-10-08"), so cached audio is re-made when "tomorrow" becomes "today". */
export function localDayKey(now = new Date()): string {
  const p = localParts(now, voiceTimeZone());
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export type ScriptInput = {
  eventName: string;
  startsAt: Date;
  arriveEarly: number;
  language: CallLanguage;
  now?: Date;
};

/** Long names are trimmed at a word boundary — the whole call has to fit in 20 seconds. */
export function speakableName(name: string, max = 60): string {
  const clean = name.replace(/[—–]/g, ",").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : max).replace(/[,\s]+$/, "");
}

/**
 * The reminder, following the host's own wording:
 * "Hello, main Aanaya yahan se baat kar rahi hoon. Humne aapko [event]
 *  [start time] ka reminder dene ke liye call kiya hai, to aap 10 minute
 *  pehle aa jaana."
 */
export function buildReminderScript({ eventName, startsAt, arriveEarly, language, now }: ScriptInput): string {
  const event = speakableName(eventName);
  const when = spokenStartTime(startsAt, language, now);
  const n = Math.max(0, Math.round(arriveEarly));

  if (language === "hi") {
    const early = n > 0 ? `तो आप ${n} मिनट पहले आ जाना।` : "तो आप समय पर आ जाना।";
    return `हैलो, मैं आनाया यहाँ से बात कर रही हूँ। हमने आपको ${event}, ${when}, का रिमाइंडर देने के लिए कॉल किया है। ${early} धन्यवाद!`;
  }
  if (language === "gu") {
    const early = n > 0 ? `તો તમે ${n} મિનિટ વહેલા આવી જજો.` : "તો તમે સમયસર આવી જજો.";
    return `હેલો, હું આનાયા અહીંથી વાત કરું છું. અમે તમને ${event}, ${when}, નું રિમાઇન્ડર આપવા માટે કૉલ કર્યો છે. ${early} આભાર!`;
  }
  const early = n > 0 ? `Please come ${n} minutes early.` : "Please be there on time.";
  return `Hello, this is Aanaya calling. We're reminding you about ${event}, ${when}. ${early} Thank you!`;
}

/** Does `text` look like it is written in the script `language` needs? Used to vet LLM output. */
export function matchesScript(text: string, language: CallLanguage): boolean {
  if (language === "hi") return /[ऀ-ॿ]/.test(text);
  if (language === "gu") return /[઀-૿]/.test(text);
  return /[a-z]/i.test(text);
}

export type ReplyIntent = "CONFIRMED" | "DECLINED" | "UNSURE" | "NO_RESPONSE";

const DECLINED_WORDS = new Set([
  "no",
  "nope",
  "not",
  "cant",
  "can't",
  "cannot",
  "wont",
  "won't",
  "unable",
  "nahi",
  "nahin",
  "nai",
  "nathi",
  "नहीं",
  "नही",
  "नहि",
  "ना",
  "ના",
  "નહીં",
  "નહિ",
  "નથી",
]);
const CONFIRMED_WORDS = new Set([
  "yes",
  "yeah",
  "yep",
  "ok",
  "okay",
  "sure",
  "coming",
  "haan",
  "han",
  "ha",
  "ji",
  "theek",
  "thik",
  "aaunga",
  "aaungi",
  "aaenge",
  "aavish",
  "aavu",
  "done",
  "हाँ",
  "हां",
  "हा",
  "जी",
  "ठीक",
  "ओके",
  "आऊँगा",
  "आऊंगा",
  "आऊँगी",
  "आऊंगी",
  "आएंगे",
  "ज़रूर",
  "जरूर",
  "હા",
  "હાં",
  "ઓકે",
  "આવીશ",
  "આવીશું",
  "ચોક્કસ",
  "જરૂર",
  "બરાબર",
]);

/**
 * Keyword-level reading of a reply, used when the LLM isn't available. Works
 * on whole words: a regex `\b` doesn't understand Devanagari or Gujarati, and
 * "ना" inside "आ जाना" must not count as a "no".
 */
export function classifyReplyByKeywords(transcript: string): ReplyIntent {
  const words = transcript
    .toLowerCase()
    .split(/[\s,.!?।"“”()]+/u)
    .filter(Boolean);
  if (!words.length) return "NO_RESPONSE";
  if (words.some((w) => DECLINED_WORDS.has(w))) return "DECLINED";
  if (words.some((w) => CONFIRMED_WORDS.has(w)) || /will come|see you/i.test(transcript)) return "CONFIRMED";
  return "UNSURE";
}

/**
 * How long the attendee gets to answer, given how long the message is. The
 * whole call — message, reply window, hang-up — stays inside 20 seconds.
 */
export const CALL_LIMIT_SECONDS = 20;
export function replyWindowSeconds(messageMs: number): number {
  const remaining = CALL_LIMIT_SECONDS - 2 - messageMs / 1000;
  return Math.max(0, Math.min(4, Math.floor(remaining)));
}
