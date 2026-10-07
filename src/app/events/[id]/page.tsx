import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { EventDashboard } from "@/components/dashboard/EventDashboard";
import { PanelSkeleton } from "@/components/ui/Skeleton";
import { getEventSummary } from "@/lib/services/events";
import { getEventLive } from "@/lib/services/live";

export const metadata: Metadata = { title: "Event dashboard" };

async function Dashboard({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const [event, live] = await Promise.all([getEventSummary(id), getEventLive(id)]);
  if (!event || !live) notFound();
  return <EventDashboard event={event} initial={live} />;
}

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-6 sm:pt-32">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-zinc-500">
        <Link href="/events" className="transition-colors hover:text-white">
          ← All events
        </Link>
      </nav>
      <Suspense fallback={<PanelSkeleton className="h-[640px]" />}>
        <Dashboard params={params} />
      </Suspense>
    </div>
  );
}
