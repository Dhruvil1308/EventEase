import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CreateEventForm } from "@/components/events/CreateEventForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelSkeleton } from "@/components/ui/Skeleton";
import { requireHost } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an event" };

/** The session check is request data, so it streams in behind Suspense. */
async function HostOnlyForm() {
  await connection();
  await requireHost("/events/new");
  return <CreateEventForm />;
}

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-36 pb-10">
      <PageHeader
        eyebrow="New event"
        eyebrowClass="text-pink"
        title="Create an event."
        description="Set the basics and a participant capacity. Registration, QR tickets and the check-in gate are ready the moment you hit create."
      />
      <Suspense fallback={<PanelSkeleton className="mt-10 h-[560px]" />}>
        <HostOnlyForm />
      </Suspense>
    </div>
  );
}
