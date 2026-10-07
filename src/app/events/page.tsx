import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { EventsBrowser } from "@/components/events/EventsBrowser";
import { AnimatedNumber } from "@/components/motion/CountUp";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { CardGridSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { getGlobalStats, listEvents } from "@/lib/services/events";
import { requestTime } from "@/lib/time";

export const metadata: Metadata = { title: "Events" };

async function Overview() {
  await connection();
  const stats = await getGlobalStats();
  const tiles = [
    { label: "Events", value: stats.events, color: "text-violet-soft" },
    { label: "Registrations", value: stats.registrations, color: "text-cyan" },
    { label: "Checked in", value: stats.checkIns, color: "text-success" },
    {
      label: "Attendance",
      value: stats.registrations ? (stats.checkIns / stats.registrations) * 100 : 0,
      suffix: "%",
      color: "text-pink",
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl px-5 py-4 glass">
          <dt className="text-xs tracking-widest text-zinc-500 uppercase">{t.label}</dt>
          <dd className={`mt-1 font-display text-3xl font-bold ${t.color}`}>
            <AnimatedNumber from={0} value={Math.round(t.value)} suffix={t.suffix} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

async function AllEvents() {
  await connection();
  const now = requestTime();
  const events = await listEvents();
  if (!events.length) {
    return (
      <div className="rounded-3xl px-6 py-20 text-center glass">
        <p className="font-display text-2xl text-white">No events yet</p>
        <p className="mt-2 text-zinc-400">Create your first event to start taking registrations.</p>
        <LinkButton href="/events/new" className="mt-8">
          Create an event
        </LinkButton>
      </div>
    );
  }
  return <EventsBrowser events={events} now={now} />;
}

export default function EventsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-36 pb-10">
      <PageHeader
        eyebrow="All events"
        title="Every event, one place."
        description="Track capacity, registrations and live attendance across every event on campus."
        actions={
          <>
            <LinkButton href="/checkin" variant="secondary">
              Open check-in
            </LinkButton>
            <LinkButton href="/events/new">+ New event</LinkButton>
          </>
        }
      />

      <div className="mt-12">
        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[86px] rounded-2xl" />
              ))}
            </div>
          }
        >
          <Overview />
        </Suspense>
      </div>

      <div className="mt-12">
        <Suspense fallback={<CardGridSkeleton count={6} />}>
          <AllEvents />
        </Suspense>
      </div>
    </div>
  );
}
