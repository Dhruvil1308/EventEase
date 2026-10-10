/**
 * Where the app talks to. The defaults are the live EventEase deployment; set
 * EXPO_PUBLIC_API_URL (e.g. an ngrok URL) at build time to point a test build
 * at a laptop instead. The Supabase URL and publishable key are public values
 * — the website ships the same ones to every browser.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://event-ease-zeta-sage.vercel.app").replace(/\/$/, "");

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Public link to an event's registration page on the website, for sharing. */
export const registrationLink = (eventId: string) => `${API_URL}/events/${eventId}/register`;
