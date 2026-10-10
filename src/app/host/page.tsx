import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { EventGrid } from "@/components/events/EventGrid";
import { AnimatedNumber } from "@/components/motion/CountUp";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { requireHost } from "@/lib/auth";
import { getHostStats, listEventsForHost } from "@/lib/services/events";
import { requestTime } from "@/lib/time";

export const metadata: Metadata = { title: "Host dashboard" };

async function HostOverview() {
  await connection();
  const profile = await requireHost("/host");
  const [stats, events] = await Promise.all([getHostStats(profile.id), listEventsForHost(profile.id)]);
  const now = requestTime();

  const tiles = [
    { label: "Your events", value: stats.events, color: "text-violet-soft" },
    { label: "Registrations", value: stats.registrations, color: "text-cyan" },
    { label: "Checked in", value: stats.checkIns, color: "text-success" },
    { label: "Duplicates blocked", value: stats.duplicatesBlocked, color: "text-pink" },
    { label: "Reminder calls", value: stats.reminderCalls, color: "text-warn" },
  ];

  return (
    <>
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl px-5 py-4 glass">
            <dt className="text-xs tracking-widest text-zinc-500 uppercase">{t.label}</dt>
            <dd className={`mt-1 font-display text-3xl font-bold tabular-nums ${t.color}`}>
              <AnimatedNumber from={0} value={t.value} />
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-12">
        {events.length ? (
          <EventGrid events={events} now={now} viewer={{ id: profile.id, role: "HOST" }} />
        ) : (
          <div className="rounded-3xl px-6 py-20 text-center glass">
            <p className="font-display text-2xl text-white">No events yet</p>
            <p className="mx-auto mt-2 max-w-md text-zinc-400">
              Create your first event, set a capacity, and start taking registrations in under a minute.
            </p>
            <LinkButton href="/events/new" className="mt-8">
              Create an event
            </LinkButton>
          </div>
        )}
      </div>
    </>
  );
}

export default function HostDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-36 pb-16">
      <PageHeader
        eyebrow="Host portal"
        eyebrowClass="text-pink"
        title="Run your events."
        description="Everything you host, with live registration and attendance, plus the gate for checking people in."
        actions={
          <>
            <LinkButton href="/checkin" variant="secondary">
              Open check-in gate
            </LinkButton>
            <LinkButton href="/events/new">+ New event</LinkButton>
          </>
        }
      />
      <div className="mt-12">
        <Suspense fallback={<CardGridSkeleton />}>
          <HostOverview />
        </Suspense>
      </div>
    </div>
  );
}
