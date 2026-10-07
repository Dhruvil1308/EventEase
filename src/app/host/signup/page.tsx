import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getCurrentProfile, HOME_FOR } from "@/lib/auth";

export const metadata: Metadata = { title: "Create a host account" };

/** Reading the session is request data, so it streams in behind Suspense. */
async function Portal() {
  await connection();
  // Already signed in? Go straight to the right dashboard.
  const profile = await getCurrentProfile();
  if (profile) redirect(HOME_FOR[profile.role]);
  return <AuthForm portal="HOST" mode="signup" />;
}

export default function Page() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-[520px] w-full max-w-md rounded-3xl glass-strong" />}>
        <Portal />
      </Suspense>
    </AuthShell>
  );
}
