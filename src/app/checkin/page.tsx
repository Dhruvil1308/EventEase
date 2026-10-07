import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckInConsole } from "@/components/checkin/CheckInConsole";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelSkeleton } from "@/components/ui/Skeleton";
import { listEventsForHost } from "@/lib/services/events";
import { requireHost } from "@/lib/auth";

export const metadata: Metadata = { title: "Check-in gate" };

async function Gate({ searchParams }: { searchParams: PageProps<"/checkin">["searchParams"] }) {
  await connection();
  const profile = await requireHost("/checkin");
  // The gate only ever offers events this host actually runs.
  const [query, events] = await Promise.all([searchParams, listEventsForHost(profile.id)]);
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  return (
    <CheckInConsole
      events={events.map((e) => ({ id: e.id, name: e.name, theme: e.theme, stats: e.stats }))}
      initialEventId={pick(query.event)}
      initialCode={pick(query.code)}
    />
  );
}

export default function CheckInPage({ searchParams }: PageProps<"/checkin">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-28 pb-10 sm:px-6 sm:pt-32">
      <PageHeader
        eyebrow="Check-in gate"
        eyebrowClass="text-success"
        compact
        title="Scan. Verify. Admit."
        description="Every ticket works exactly once — a second check-in with the same code is rejected."
      />
      <div className="mt-8">
        <Suspense fallback={<PanelSkeleton className="h-[620px]" />}>
          <Gate searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
