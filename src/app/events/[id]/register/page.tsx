import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type CSSProperties } from "react";
import { RegisterForm } from "@/components/events/RegisterForm";
import { Reveal } from "@/components/motion/Reveal";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { PanelSkeleton } from "@/components/ui/Skeleton";
import { eventEndMs } from "@/lib/event-time";
import { formatFee, getEventType } from "@/lib/event-types";
import { formatEndTime, formatFullDate, formatTimeShort, percent } from "@/lib/format";
import { getEventSummary } from "@/lib/services/events";
import { getRegistrationFor } from "@/lib/services/registrations";
import { requireAttendee } from "@/lib/auth";
import { getTheme, themeVars } from "@/lib/themes";
import { requestTime } from "@/lib/time";

export const metadata: Metadata = { title: "Register" };

async function Registration({ params }: { params: PageProps<"/events/[id]/register">["params"] }) {
  await connection();
  const { id } = await params;
  // Registration requires an attendee account — no anonymous sign-ups.
  const profile = await requireAttendee(`/events/${id}/register`);
  const event = await getEventSummary(id);
  if (!event) notFound();

  // Already holding a ticket? Send them to it instead of letting them try again.
  const existing = await getRegistrationFor(id, profile.id);
  if (existing) redirect(`/tickets/${existing.code}`);
  const theme = getTheme(event.theme);
  const type = getEventType(event.type);
  const ended = eventEndMs(event) < requestTime();
  const closed = ended || event.stats.remaining === 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]" style={themeVars(event.theme) as CSSProperties}>
      <Reveal
        variant="left"
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-900 p-7 sm:p-9"
      >
        {event.coverUrl && (
          <div aria-hidden className="absolute inset-x-0 top-0 h-56 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- ≤300 KB storage image */}
            <img src={event.coverUrl} alt="" className="h-full w-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ink-900" />
          </div>
        )}
        <div aria-hidden className="absolute inset-0 bg-theme opacity-25" />
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(var(--t-glow)/0.6),transparent_65%)]"
        />
        <div className="relative">
          <p className="font-mono text-xs tracking-[0.3em] text-zinc-300 uppercase">
            {type.emoji} {type.label} · You&apos;re registering for
          </p>
          <h1 className="mt-4 font-display text-3xl leading-tight font-bold text-white sm:text-4xl">{event.name}</h1>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-zinc-500">When</dt>
              <dd className="text-zinc-200" suppressHydrationWarning>
                {formatFullDate(event.startsAt)} · {formatTimeShort(event.startsAt)}
                {event.endsAt ? ` – ${formatEndTime(event.startsAt, event.endsAt)}` : ""}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-zinc-500">Where</dt>
              <dd className="text-zinc-200">{event.venue}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-zinc-500">Entry</dt>
              <dd className="text-zinc-200">
                {event.entryFee > 0 ? `${formatFee(event.entryFee)} at the venue` : "Free"}
              </dd>
            </div>
          </dl>
          {event.prizes.length > 0 && (
            <div className="mt-6">
              <p className="text-xs tracking-widest text-zinc-500 uppercase">🏆 Prizes</p>
              <ul className="mt-3 space-y-2">
                {event.prizes.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-warn/20 bg-warn/[0.07] px-4 py-2.5 text-sm"
                  >
                    <span className="text-zinc-200">{p.title}</span>
                    <span className="font-semibold text-warn">{p.reward}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {event.description && <p className="mt-6 text-sm leading-relaxed text-zinc-400">{event.description}</p>}

          <div className="mt-8 flex items-center gap-5 border-t border-white/10 pt-6">
            <ProgressRing value={event.stats.fillRate} size={96} stroke={9} from={theme.from} to={theme.via}>
              <span className="font-mono text-sm text-white">{percent(event.stats.fillRate)}</span>
            </ProgressRing>
            <div>
              <p className="font-display text-2xl font-semibold text-white">
                {event.stats.registered} / {event.stats.capacity}
              </p>
              <p className="text-sm text-zinc-400">seats taken</p>
            </div>
          </div>
        </div>
      </Reveal>

      <RegisterForm
        eventId={event.id}
        attendee={{
          name: profile.name,
          email: profile.email,
          studentId: profile.studentId,
          department: profile.department,
          phone: profile.phone,
          callLanguage: profile.callLanguage,
        }}
        seatsLeft={event.stats.remaining}
        closed={closed}
        closedReason={ended ? "This event has already taken place." : undefined}
      />
    </div>
  );
}

export default function RegisterPage({ params }: PageProps<"/events/[id]/register">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-28 pb-10 sm:px-6 sm:pt-32">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-zinc-500">
        <Link href="/events" className="transition-colors hover:text-white">
          ← All events
        </Link>
      </nav>
      <Suspense fallback={<PanelSkeleton className="h-[520px]" />}>
        <Registration params={params} />
      </Suspense>
    </div>
  );
}
