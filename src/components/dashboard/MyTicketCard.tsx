import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { eventEndMs } from "@/lib/event-time";
import { formatDay, formatEndTime, formatFullDate, formatMonth, formatTimeShort } from "@/lib/format";
import { themeVars } from "@/lib/themes";

export type MyTicket = {
  code: string;
  checkedInAt: string | null;
  event: {
    id: string;
    name: string;
    venue: string;
    startsAt: string;
    endsAt: string | null;
    theme: string;
    hostName: string;
    coverUrl: string | null;
  };
};

export function MyTicketCard({ ticket, now }: { ticket: MyTicket; now: number }) {
  const { event } = ticket;
  const ended = eventEndMs(event) < now;

  const status = ticket.checkedInAt
    ? { label: "Checked in", tone: "success" as const }
    : ended
      ? { label: "Missed", tone: "neutral" as const }
      : { label: "Ready to scan", tone: "info" as const };

  return (
    <article
      style={themeVars(event.theme) as CSSProperties}
      className="group relative flex flex-col overflow-hidden rounded-3xl p-6 glass transition-[border-color,box-shadow] duration-500 hover:border-white/20 hover:shadow-[0_30px_80px_-30px_rgb(var(--t-glow)/0.55)]"
    >
      <div
        aria-hidden
        className="absolute -top-20 -right-20 h-52 w-52 rounded-full bg-theme opacity-20 blur-3xl transition-opacity duration-700 group-hover:opacity-40"
      />
      {event.coverUrl && (
        <div aria-hidden className="absolute inset-x-0 top-0 h-32 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- ≤300 KB storage image */}
          <img src={event.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ink-900" />
        </div>
      )}

      <header className="relative flex items-start justify-between gap-3">
        <div className="grid h-16 w-14 shrink-0 place-items-center rounded-2xl bg-theme text-ink-950 shadow-lg">
          <div className="text-center leading-none">
            <div className="font-display text-xl font-bold">{formatDay(event.startsAt)}</div>
            <div className="mt-0.5 text-[0.6rem] font-semibold tracking-widest">{formatMonth(event.startsAt)}</div>
          </div>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>

      <h3 className="relative mt-5 font-display text-lg leading-snug font-semibold text-white">{event.name}</h3>
      <p className="relative mt-1 text-sm text-zinc-400">
        {event.venue} · {formatTimeShort(event.startsAt)}
        {event.endsAt ? ` – ${formatEndTime(event.startsAt, event.endsAt)}` : ""}
      </p>
      <p className="relative mt-0.5 text-xs text-zinc-500">
        {formatFullDate(event.startsAt)} · hosted by {event.hostName}
      </p>

      <div className="relative mt-5 rounded-2xl border border-white/10 bg-ink-950/50 px-4 py-3">
        <p className="text-[0.65rem] tracking-[0.25em] text-zinc-500 uppercase">Entry code</p>
        <p className="mt-1 font-mono text-lg tracking-[0.18em] text-white">{ticket.code}</p>
      </div>

      <Link
        href={`/tickets/${ticket.code}`}
        className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white transition-colors hover:text-cyan"
      >
        View QR ticket
        <span aria-hidden className="transition-transform group-hover:translate-x-1">
          →
        </span>
      </Link>
    </article>
  );
}
