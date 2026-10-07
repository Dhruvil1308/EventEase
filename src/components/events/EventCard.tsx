"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { TiltCard } from "@/components/motion/TiltCard";
import { Badge } from "@/components/ui/Badge";
import { formatDay, formatMonth, formatTimeShort, formatWeekday, percent } from "@/lib/format";
import type { EventSummary } from "@/lib/services/events";
import { themeVars } from "@/lib/themes";

export function eventStatus(event: EventSummary, now: number) {
  if (new Date(event.startsAt).getTime() < now - 6 * 3600_000) return { label: "Ended", tone: "neutral" as const };
  if (event.stats.remaining === 0) return { label: "Full", tone: "danger" as const };
  if (event.stats.fillRate >= 0.85) return { label: "Almost full", tone: "warn" as const };
  return { label: "Open", tone: "success" as const };
}

/** Who is looking at the card. Drives which actions it offers. */
export type CardViewer = { id: string; role: "ATTENDEE" | "HOST" } | null;

export function EventCard({ event, now, viewer }: { event: EventSummary; now: number; viewer?: CardViewer }) {
  const status = eventStatus(event, now);
  const { stats } = event;
  const owns = viewer?.role === "HOST" && viewer.id === event.hostId;
  const isHost = viewer?.role === "HOST";
  const closed = status.label === "Full" || status.label === "Ended";

  return (
    <TiltCard className="h-full rounded-3xl" max={7}>
      <article
        style={themeVars(event.theme) as CSSProperties}
        className="group relative flex h-full flex-col overflow-hidden rounded-3xl p-6 glass transition-[border-color,box-shadow] duration-500 hover:border-white/20 hover:shadow-[0_30px_80px_-30px_rgb(var(--t-glow)/0.6)]"
      >
        <div
          aria-hidden
          className="absolute -top-20 -right-20 h-52 w-52 rounded-full bg-theme opacity-25 blur-3xl transition-opacity duration-700 group-hover:opacity-45"
        />

        <header className="relative flex [transform:translateZ(30px)] items-start justify-between gap-3">
          <div className="grid h-16 w-14 shrink-0 place-items-center rounded-2xl bg-theme text-ink-950 shadow-lg">
            <div className="text-center leading-none">
              <div className="font-display text-xl font-bold">{formatDay(event.startsAt)}</div>
              <div className="mt-1 text-[10px] font-bold tracking-widest">{formatMonth(event.startsAt)}</div>
            </div>
          </div>
          <Badge tone={status.tone} dot={status.tone === "success"}>
            {status.label}
          </Badge>
        </header>

        <div className="relative mt-5 flex-1 [transform:translateZ(20px)]">
          <h3 className="font-display text-lg leading-snug font-semibold text-white">
            <Link
              href={owns ? `/events/${event.id}` : `/events/${event.id}/register`}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {event.name}
            </Link>
          </h3>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-400">
            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 18s6-5.3 6-10A6 6 0 004 8c0 4.7 6 10 6 10zm0-8a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="truncate">{event.venue}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500" suppressHydrationWarning>
            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.3.7l2.8 2.8a1 1 0 001.4-1.4L11 9.6V6z"
                clipRule="evenodd"
              />
            </svg>
            {formatWeekday(event.startsAt)} · {formatTimeShort(event.startsAt)}
          </p>
        </div>

        <div className="relative mt-6 [transform:translateZ(15px)]">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-zinc-400">
              <span className="font-semibold text-white">{stats.registered}</span> / {stats.capacity} registered
            </span>
            <span className="font-mono text-xs text-zinc-500">{percent(stats.fillRate)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              data-bar
              data-value={stats.fillRate}
              className="h-full origin-left rounded-full bg-theme"
              style={{ transform: `scaleX(${stats.fillRate})` }}
            />
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {stats.checkedIn} checked in
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
              {stats.remaining} {stats.remaining === 1 ? "seat" : "seats"} left
            </span>
          </div>
        </div>

        <footer className="relative z-10 mt-6 flex [transform:translateZ(25px)] gap-2">
          {owns ? (
            <>
              <Link
                href={`/events/${event.id}`}
                className="flex h-10 flex-1 items-center justify-center rounded-xl bg-theme text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95"
              >
                Manage
              </Link>
              <Link
                href={`/checkin?event=${event.id}`}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Check-in
              </Link>
            </>
          ) : isHost ? (
            <span className="flex h-10 flex-1 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-sm text-zinc-500">
              Hosted by {event.hostName}
            </span>
          ) : closed ? (
            <span className="flex h-10 flex-1 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-sm text-zinc-500">
              Registration closed
            </span>
          ) : (
            <Link
              href={`/events/${event.id}/register`}
              className="flex h-10 flex-1 items-center justify-center rounded-xl bg-theme text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95"
            >
              Register
            </Link>
          )}
        </footer>
      </article>
    </TiltCard>
  );
}
