/** Reads the Supabase env vars once, with a clear error instead of a vague crash. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and fill in your Supabase project values.`);
  }
  return value;
}

export const SUPABASE_URL = () => required("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SUPABASE_SECRET_KEY = () => required("SUPABASE_SECRET_KEY");
