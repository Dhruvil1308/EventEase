import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CreateEventForm } from "@/components/events/CreateEventForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelSkeleton } from "@/components/ui/Skeleton";
import { requireEventOwner } from "@/lib/auth";
import { getEventForEdit } from "@/lib/services/events";

export const metadata: Metadata = { title: "Edit event" };

async function EditForm({ params }: { params: PageProps<"/events/[id]/edit">["params"] }) {
  await connection();
  const { id } = await params;
  const profile = await requireEventOwner(id, `/events/${id}/edit`);
  const event = await getEventForEdit(id, profile.id);
  if (!event) notFound();
  return <CreateEventForm initial={event} />;
}

export default function EditEventPage({ params }: PageProps<"/events/[id]/edit">) {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-32 pb-10">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-zinc-500">
        <Link href="/host" className="transition-colors hover:text-white">
          ← Your events
        </Link>
      </nav>
      <PageHeader
        eyebrow="Edit event"
        eyebrowClass="text-pink"
        title="Fine-tune it."
        description="Update the timing, prizes, cover image or reminder calls. Registered attendees keep their tickets."
      />
      <Suspense fallback={<PanelSkeleton className="mt-10 h-[560px]" />}>
        <EditForm params={params} />
      </Suspense>
    </div>
  );
}
