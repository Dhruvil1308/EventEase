/** Dates and numbers, in the venue's time zone (India) like the website. */
const TZ = "Asia/Kolkata";

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...opts });
const dayKey = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });
const time = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
const dateShort = fmt({ weekday: "short", day: "numeric", month: "short" });
const dateLong = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const monthShort = fmt({ month: "short" });
const dayNum = fmt({ day: "2-digit" });

const d = (v: string | Date) => (typeof v === "string" ? new Date(v) : v);

export const formatTime = (v: string | Date) => time.format(d(v));
export const formatDate = (v: string | Date) => dateShort.format(d(v));
export const formatDateLong = (v: string | Date) => dateLong.format(d(v));
export const formatMonth = (v: string | Date) => monthShort.format(d(v)).toUpperCase();
export const formatDay = (v: string | Date) => dayNum.format(d(v));
export const formatDateTime = (v: string | Date) => `${formatDate(v)} · ${formatTime(v)}`;

/** "10:00 AM – 6:00 PM", or "10:00 AM – Sun, 15 Nov · 10:00 AM" when it ends on another day. */
export function formatRange(start: string, end: string | null) {
  if (!end) return formatTime(start);
  const sameDay = dayKey.format(d(start)) === dayKey.format(d(end));
  return `${formatTime(start)} – ${sameDay ? formatTime(end) : formatDateTime(end)}`;
}

export const formatFee = (rupees: number) => (rupees > 0 ? `₹${rupees.toLocaleString("en-IN")}` : "Free");

export function timeAgo(v: string | Date, now = Date.now()) {
  const s = Math.round((now - d(v).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return formatDate(v);
}

/** Has the event finished (its end, or start + 3 h when it has no end)? */
export const hasEnded = (startsAt: string, endsAt: string | null, now = Date.now()) =>
  (endsAt ? d(endsAt).getTime() : d(startsAt).getTime() + 3 * 3600_000) < now;

export const percent = (v: number) => `${Math.round(v * 100)}%`;

/** Turn "ee 7k2m-q9xd" into "EE-7K2M-Q9XD" (same alphabet rules as the website). */
export function normalizeCode(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("EE") && s.length > 8 ? s.slice(2) : s;
  if (body.length !== 8) return raw.trim().toUpperCase();
  return `EE-${body.slice(0, 4)}-${body.slice(4)}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
