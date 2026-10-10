import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import { supabase } from "./supabase";
import type { Profile, Role } from "./types";

export type SignUpInput = {
  role: Role;
  name: string;
  email: string;
  password: string;
  organization?: string;
  studentId?: string;
  department?: string;
  phone?: string;
};

type AuthContextValue = {
  status: "loading" | "signedOut" | "signedIn";
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<Profile>;
  signUp: (input: SignUpInput) => Promise<Profile>;
  signOut: () => Promise<void>;
  /** Re-read the profile after editing it. */
  refresh: () => Promise<void>;
  setProfile: (p: Profile) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const loadProfile = () => api<{ profile: Profile }>("/api/profile").then((r) => r.profile);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [profile, setProfileState] = useState<Profile | null>(null);

  const setProfile = useCallback((p: Profile | null) => {
    setProfileState(p);
    setStatus(p ? "signedIn" : "signedOut");
  }, []);

  // On launch: a saved session means we're signed in — confirm it with the API.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return alive && setProfile(null);
      // A shaky network at launch gets a few tries before we give up; only a
      // rejected token (401) actually signs the person out.
      for (let attempt = 1; attempt <= 3 && alive; attempt++) {
        try {
          const p = await loadProfile();
          if (alive) setProfile(p);
          return;
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await supabase.auth.signOut();
            break;
          }
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
      if (alive) setProfile(null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setProfile(null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [setProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        throw new ApiError(
          /invalid login/i.test(error.message)
            ? "That email and password don't match an account."
            : /network|fetch/i.test(error.message)
              ? "Can't reach EventEase. Check your internet connection."
              : error.message,
          401,
          "SIGN_IN_FAILED",
        );
      }
      const p = await loadProfile();
      setProfile(p);
      return p;
    },
    [setProfile],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      await api("/api/auth/signup", { method: "POST", body: input });
      return signIn(input.email, input.password);
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, [setProfile]);

  const refresh = useCallback(async () => {
    setProfile(await loadProfile());
  }, [setProfile]);

  const value = useMemo(
    () => ({ status, profile, signIn, signUp, signOut, refresh, setProfile }),
    [status, profile, signIn, signUp, signOut, refresh, setProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
