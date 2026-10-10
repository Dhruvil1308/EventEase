import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * The app signs in with Supabase directly (same project as the website). The
 * session is kept on the device, so people stay signed in between launches,
 * and its access token is what the API checks on every request.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the token only while the app is on screen (Supabase's advice for React Native).
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
