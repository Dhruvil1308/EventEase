import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelSkeleton } from "@/components/ui/Skeleton";
import { getCurrentProfile } from "@/lib/auth";
import { toProfileView } from "@/lib/services/profiles";

export const metadata: Metadata = { title: "Your profile" };

async function Profile() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin?next=/profile");
  return <ProfileForm profile={toProfileView(profile)} />;
}

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-36 pb-16">
      <PageHeader
        eyebrow="Your profile"
        title="Make it yours."
        description="Your photo, mobile number, skills and hobbies — hosts see this when you register, and Aanaya uses your number for reminder calls."
      />
      <Suspense fallback={<PanelSkeleton className="mt-12 h-[720px]" />}>
        <Profile />
      </Suspense>
    </div>
  );
}
