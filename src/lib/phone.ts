/**
 * Mobile numbers are stored in E.164 (`+919876543210`) so the reminder-call
 * feature can dial them without guessing. Indian numbers are accepted the way
 * people actually type them: with or without +91 / 91 / 0, spaces or dashes.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = raw.replace(/[\s\-().]/g, "");
  const indian = compact.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  if (indian) return `+91${indian[1]}`;
  const international = compact.match(/^\+([1-9]\d{7,14})$/);
  if (international) return `+${international[1]}`;
  return null;
}

/** `+919876543210` → `+91 98765 43210`, the way Indian numbers are written. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const indian = e164.match(/^\+91(\d{5})(\d{5})$/);
  return indian ? `+91 ${indian[1]} ${indian[2]}` : e164;
}

/** `+919876543210` → `+91 98••• ••210`, for places that only need to hint at it. */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const indian = e164.match(/^\+91(\d{2})\d{6}(\d{2})$/);
  return indian ? `+91 ${indian[1]}••• •••${indian[2]}` : `${e164.slice(0, 4)}•••${e164.slice(-2)}`;
}
