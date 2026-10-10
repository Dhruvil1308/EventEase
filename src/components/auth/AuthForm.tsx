"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signInAction, signUpAction, type AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";

export type Portal = "ATTENDEE" | "HOST";
type Mode = "signin" | "signup";

const COPY = {
  ATTENDEE: {
    accent: "text-cyan",
    ring: "shadow-[0_0_80px_-30px_rgba(34,211,238,0.6)]",
    label: "Attendee portal",
    other: { href: "/host/signin", text: "Organizing an event? Host sign-in →" },
    signin: { title: "Welcome back.", sub: "Sign in to see your tickets and upcoming events." },
    signup: { title: "Create your account.", sub: "Register for events and keep every ticket in one place." },
  },
  HOST: {
    accent: "text-pink",
    ring: "shadow-[0_0_80px_-30px_rgba(244,114,182,0.6)]",
    label: "Host portal",
    other: { href: "/signin", text: "Attending instead? Attendee sign-in →" },
    signin: { title: "Host sign-in.", sub: "Run your events, your gate and your attendance." },
    signup: { title: "Create a host account.", sub: "Publish events, set capacity and check people in." },
  },
} as const;

export function AuthForm({ portal, mode }: { portal: Portal; mode: Mode }) {
  const action = mode === "signup" ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, null);
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const copy = COPY[portal];
  const err = (field: string) => state?.fields?.[field]?.[0];

  const switchTo =
    mode === "signin"
      ? { href: portal === "HOST" ? "/host/signup" : "/signup", text: "Need an account? Create one" }
      : { href: portal === "HOST" ? "/host/signin" : "/signin", text: "Already have an account? Sign in" };

  return (
    <div className={`w-full max-w-md rounded-3xl p-8 glass-strong ${copy.ring}`}>
      <p className={`font-mono text-xs tracking-[0.3em] uppercase ${copy.accent}`}>{copy.label}</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white">{copy[mode].title}</h1>
      <p className="mt-2 text-sm text-zinc-400">{copy[mode].sub}</p>

      <form action={formAction} className="mt-7 space-y-4">
        <input type="hidden" name="role" value={portal} />
        <input type="hidden" name="next" value={next} />

        {mode === "signup" && (
          <InputField
            id="name"
            label="Full name"
            autoComplete="name"
            required
            placeholder="Ada Lovelace"
            error={err("name")}
          />
        )}

        <InputField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@college.edu"
          error={err("email")}
        />

        <InputField
          id="password"
          label="Password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
          error={err("password")}
        />

        {mode === "signup" && portal === "HOST" && (
          <InputField
            id="organization"
            label="Club or department"
            optional
            placeholder="Computer Society"
            error={err("organization")}
          />
        )}

        {mode === "signup" && (
          <InputField
            id="phone"
            label="Mobile number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            optional
            placeholder="+91 98765 43210"
            error={err("phone")}
            hint={portal === "ATTENDEE" ? "Get a reminder call from Aanaya before your events." : undefined}
          />
        )}

        {mode === "signup" && portal === "ATTENDEE" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField id="studentId" label="Student ID" optional placeholder="21CE045" error={err("studentId")} />
            <InputField id="department" label="Department" optional placeholder="Computer" error={err("department")} />
          </div>
        )}

        {state?.error && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" loading={pending} className="w-full">
          {pending ? "Just a moment…" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="mt-6 space-y-2 border-t border-white/10 pt-5 text-sm">
        <Link href={switchTo.href} className="block text-zinc-300 transition-colors hover:text-white">
          {switchTo.text}
        </Link>
        <Link href={copy.other.href} className="block text-zinc-500 transition-colors hover:text-zinc-300">
          {copy.other.text}
        </Link>
      </div>
    </div>
  );
}
