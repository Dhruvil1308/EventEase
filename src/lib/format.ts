/**
 * Date helpers. Set NEXT_PUBLIC_TIMEZONE (e.g. "Asia/Kolkata") so server- and
 * browser-rendered times always match the venue's local time.
 */
const timeZone = process.env.NEXT_PUBLIC_TIMEZONE || undefined;

const dateTime = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone,
});
const dayMonth = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone });
const dayNum = new Intl.DateTimeFormat("en-US", { day: "2-digit", timeZone });
const monthShort = new Intl.DateTimeFormat("en-US", { month: "short", timeZone });
const weekdayLong = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone });
const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone });
const timeShort = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone });
const fullDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone,
});

const d = (v: string | Date) => (typeof v === "string" ? new Date(v) : v);

export const formatDateTime = (v: string | Date) => dateTime.format(d(v));
export const formatDayMonth = (v: string | Date) => dayMonth.format(d(v));
export const formatDay = (v: string | Date) => dayNum.format(d(v));
export const formatMonth = (v: string | Date) => monthShort.format(d(v)).toUpperCase();
export const formatWeekday = (v: string | Date) => weekdayLong.format(d(v));
export const formatTime = (v: string | Date) => time.format(d(v));
export const formatTimeShort = (v: string | Date) => timeShort.format(d(v));
export const formatFullDate = (v: string | Date) => fullDate.format(d(v));

const calendarDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone });

/** The end of a time range: just the time when it ends the same day, the date as well when it doesn't. */
export const formatEndTime = (start: string | Date, end: string | Date) =>
  calendarDay.format(d(start)) === calendarDay.format(d(end)) ? formatTimeShort(end) : formatDateTime(end);

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelative(v: string | Date, now = Date.now()) {
  const diff = (d(v).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return diff <= 0 ? "just now" : "in a moment";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export const percent = (v: number) => `${Math.round(v * 100)}%`;
