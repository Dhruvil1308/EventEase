import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type CSSProperties } from "react";
import { RegisterForm } from "@/components/events/RegisterForm";
import { Reveal } from "@/components/motion/Reveal";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { PanelSkeleton } from "@/components/ui/Skeleton";
import { formatFullDate, formatTimeShort, percent } from "@/lib/format";
import { getEventSummary } from "@/lib/services/events";
import { getTheme, themeVars } from "@/lib/themes";
import { requestTime } from "@/lib/time";

export const metadata: Metadata = { title: "Register" };

async function Registration({ params }: { params: PageProps<"/events/[id]/register">["params"] }) {
  await connection();
  const { id } = await params;
  const event = await getEventSummary(id);
  if (!event) notFound();
  const theme = getTheme(event.theme);
  const ended = new Date(event.startsAt).getTime() < requestTime() - 6 * 3600_000;
  const closed = ended || event.stats.remaining === 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]" style={themeVars(event.theme) as CSSProperties}>
      <Reveal
        variant="left"
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-900 p-7 sm:p-9"
      >
        <div aria-hidden className="absolute inset-0 bg-theme opacity-25" />
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(var(--t-glow)/0.6),transparent_65%)]"
        />
        <div className="relative">
          <p className="font-mono text-xs tracking-[0.3em] text-zinc-300 uppercase">You&apos;re registering for</p>
          <h1 className="mt-4 font-display text-3xl leading-tight font-bold text-white sm:text-4xl">{event.name}</h1>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-zinc-500">When</dt>
              <dd className="text-zinc-200" suppressHydrationWarning>
                {formatFullDate(event.startsAt)} · {formatTimeShort(event.startsAt)}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-zinc-500">Where</dt>
              <dd className="text-zinc-200">{event.venue}</dd>
            </div>
          </dl>
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
