import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MyTicketCard, type MyTicket } from "@/components/dashboard/MyTicketCard";
import { Reveal } from "@/components/motion/Reveal";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { requireAttendee } from "@/lib/auth";
import { listRegistrationsForUser } from "@/lib/services/registrations";
import { requestTime } from "@/lib/time";

export const metadata: Metadata = { title: "Your dashboard" };

async function MyTickets() {
  await connection();
  const profile = await requireAttendee("/dashboard");
  const now = requestTime();
  const rows = await listRegistrationsForUser(profile.id);

  const tickets: MyTicket[] = rows.map((r) => ({
    code: r.code,
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
    event: {
      id: r.event.id,
      name: r.event.name,
      venue: r.event.venue,
      startsAt: r.event.startsAt.toISOString(),
      theme: r.event.theme,
      hostName: r.event.host?.name ?? "EventEase host",
    },
  }));

  if (!tickets.length) {
    return (
      <div className="rounded-3xl px-6 py-20 text-center glass">
        <p className="font-display text-2xl text-white">No tickets yet</p>
        <p className="mx-auto mt-2 max-w-md text-zinc-400">
          Browse what&apos;s happening on campus and register — your QR ticket shows up here instantly.
        </p>
        <LinkButton href="/events" className="mt-8">
          Browse events
        </LinkButton>
      </div>
    );
  }

  const attended = tickets.filter((t) => t.checkedInAt).length;
  const upcoming = tickets.filter((t) => !t.checkedInAt && new Date(t.event.startsAt).getTime() > now).length;
  const tiles = [
    { label: "Tickets", value: tickets.length, color: "text-violet-soft" },
    { label: "Upcoming", value: upcoming, color: "text-cyan" },
    { label: "Attended", value: attended, color: "text-success" },
  ];

  return (
    <>
      <dl className="grid grid-cols-3 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl px-5 py-4 glass">
            <dt className="text-xs tracking-widest text-zinc-500 uppercase">{t.label}</dt>
            <dd className={`mt-1 font-display text-3xl font-bold tabular-nums ${t.color}`}>{t.value}</dd>
          </div>
        ))}
      </dl>

      <Reveal stagger={70} className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tickets.map((t) => (
          <MyTicketCard key={t.code} ticket={t} now={now} />
        ))}
      </Reveal>
    </>
  );
}

export default function AttendeeDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-36 pb-16">
      <PageHeader
        eyebrow="Your dashboard"
        title="Your events, your tickets."
        description="Every event you've registered for, with its entry code and live check-in status."
        actions={
          <LinkButton href="/events" variant="secondary">
            Browse events
          </LinkButton>
        }
      />
      <div className="mt-12">
        <Suspense fallback={<CardGridSkeleton />}>
          <MyTickets />
        </Suspense>
      </div>
    </div>
  );
}
