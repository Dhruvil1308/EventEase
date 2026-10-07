import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "./env";

/**
 * Privileged client used only for account creation and deletion.
 *
 * Creating the user here with `email_confirm: true` means a new account can
 * sign in immediately — no confirmation email round-trip, which would otherwise
 * stall a live demo. This key must never reach the browser.
 */
export function createSupabaseAdminClient() {
  return createClient(SUPABASE_URL(), SUPABASE_SECRET_KEY(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
