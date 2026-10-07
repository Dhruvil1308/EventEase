"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Browser-side Supabase client. Only ever sees the publishable key. */
export function createClient() {
  return createBrowserClient(SUPABASE_URL(), SUPABASE_ANON_KEY());
}
