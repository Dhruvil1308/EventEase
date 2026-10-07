"use client";

import { animate, createTimeline, scrambleText, stagger, utils } from "animejs";
import { useRef, type CSSProperties } from "react";
import { TiltCard } from "@/components/motion/TiltCard";
import { useAnimeScope } from "@/components/motion/useAnimeScope";
import { buttonClasses, LinkButton } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { formatDayMonth, formatFullDate, formatTimeShort } from "@/lib/format";
import { getTheme, themeVars } from "@/lib/themes";

export type TicketData = {
  code: string;
  name: string;
  email: string;
  studentId: string | null;
  department: string | null;
  checkedInAt: string | null;
  createdAt: string;
  event: { id: string; name: string; venue: string; startsAt: string; theme: string };
};

export function TicketView({ ticket, qrSvg, isNew }: { ticket: TicketData; qrSvg: string; isNew: boolean }) {
  const theme = getTheme(ticket.event.theme);
  const burst = useRef<HTMLDivElement>(null);
  const used = Boolean(ticket.checkedInAt);

  const root = useAnimeScope<HTMLDivElement>(({ root, reduced }) => {
    const q = (s: string) => root.querySelector<HTMLElement>(s);
    if (reduced) return;
    const tl = createTimeline({ defaults: { ease: "out(4)" } });
    tl.add(q("[data-ticket]")!, {
      opacity: [0, 1],
      y: isNew ? [260, 0] : [60, 0],
      rotateX: isNew ? [65, 0] : [20, 0],
      scale: [0.9, 1],
      duration: isNew ? 1500 : 1100,
    })
      .add(
        q("[data-code]")!,
        {
          innerHTML: scrambleText({ text: ticket.code, chars: "A-Z0-9", duration: 1100 }),
          duration: 1100,
        },
        "-=700",
      )
      .add(
        root.querySelectorAll("[data-qr-reveal]"),
        { opacity: [0, 1], scale: [0.6, 1], duration: 900, ease: "outBack(1.6)" },
        "-=1100",
      )
      .add(
        root.querySelectorAll("[data-action]"),
        { opacity: [0, 1], y: [20, 0], delay: stagger(70), duration: 700 },
        "-=600",
      );
    if (used) {
      tl.add(
        q("[data-stamp]")!,
        { opacity: [0, 1], scale: [2.4, 1], rotate: [-30, -12], duration: 600, ease: "outBack(2)" },
        "-=300",
      );
    }

    // Holographic shimmer loop
    animate(root.querySelectorAll("[data-holo]"), {
      backgroundPosition: ["0% 50%", "200% 50%"],
      duration: 6000,
      loop: true,
      ease: "linear",
    });

    if (isNew && burst.current) {
      const colors = [theme.from, theme.via, theme.to, "#ffffff"];
      const bits = Array.from({ length: 48 }, (_, i) => {
        const el = document.createElement("span");
        el.className = "absolute left-1/2 top-1/3 h-2.5 w-1.5 rounded-[2px]";
        el.style.background = colors[i % colors.length];
        burst.current!.appendChild(el);
        return el;
      });
      animate(bits, {
        x: () => utils.random(-420, 420),
        y: () => [utils.random(-260, -60), utils.random(200, 480)],
        rotate: () => utils.random(-720, 720),
        opacity: [
          { to: 1, duration: 100 },
          { to: 0, delay: 900, duration: 700 },
        ],
        duration: 1800,
        delay: stagger(10, { start: 700 }),
        ease: "out(2)",
        onComplete: () => bits.forEach((b) => b.remove()),
      });
    }
  });

  return (
    <div ref={root} className="relative" style={themeVars(ticket.event.theme) as CSSProperties}>
      <div ref={burst} aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-visible" />

      {isNew && (
        <div data-action data-intro className="mb-8 text-center">
          <p className="font-display text-2xl font-semibold text-white sm:text-3xl">
            You&apos;re registered, <span className="text-gradient-theme">{ticket.name.split(" ")[0]}</span>! 🎉
          </p>
          <p className="mt-2 text-zinc-400">
            Show this QR code (or the entry code) at the gate. Save it or take a screenshot.
          </p>
        </div>
      )}

      <div className="mx-auto max-w-md [perspective:1400px]">
        <div data-ticket data-intro>
          <TiltCard className="rounded-[2rem]" max={9}>
            <article
              className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-900 shadow-[0_50px_120px_-40px_rgb(var(--t-glow)/0.75)] print:shadow-none"
              aria-label={`Ticket for ${ticket.event.name}`}
            >
              {/* Header */}
              <div className="relative bg-theme px-7 pt-7 pb-8 text-ink-950">
                <div data-holo className="holo absolute inset-0 opacity-60" aria-hidden />
                <div className="relative flex [transform:translateZ(40px)] items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.3em] uppercase opacity-70">EventEase · Admit one</p>
                    <h1 className="mt-3 font-display text-2xl leading-tight font-bold">{ticket.event.name}</h1>
                  </div>
                  <div
                    className="shrink-0 rounded-xl bg-ink-950/15 px-3 py-2 text-center backdrop-blur-sm"
                    suppressHydrationWarning
                  >
                    <p className="font-display text-lg leading-none font-bold">
                      {formatDayMonth(ticket.event.startsAt)}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold">{formatTimeShort(ticket.event.startsAt)}</p>
                  </div>
                </div>
              </div>

              {/* Perforation */}
              <div className="relative h-0" aria-hidden>
                <span className="absolute -top-4 -left-4 h-8 w-8 rounded-full bg-ink-950" />
                <span className="absolute -top-4 -right-4 h-8 w-8 rounded-full bg-ink-950" />
                <span className="absolute top-0 right-6 left-6 border-t-2 border-dashed border-white/15" />
              </div>

              {/* Body */}
              <div className="relative px-7 pt-8 pb-7">
                <div className="grid [transform:translateZ(25px)] grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <div className="col-span-2">
                    <p className="text-[11px] tracking-widest text-zinc-500 uppercase">Attendee</p>
                    <p className="mt-1 font-display text-lg font-semibold text-white">{ticket.name}</p>
                  </div>
                  <div>
                    <p className="text-[11px] tracking-widest text-zinc-500 uppercase">Venue</p>
                    <p className="mt-1 text-zinc-200">{ticket.event.venue}</p>
                  </div>
                  <div>
                    <p className="text-[11px] tracking-widest text-zinc-500 uppercase">
                      {ticket.studentId ? "Student ID" : "Date"}
                    </p>
                    <p className="mt-1 text-zinc-200" suppressHydrationWarning>
                      {ticket.studentId ?? formatFullDate(ticket.event.startsAt)}
                    </p>
                  </div>
                </div>

                <div className="relative mt-7 flex [transform:translateZ(50px)] flex-col items-center">
                  <div
                    data-qr-reveal
                    data-intro
                    className="relative rounded-2xl bg-white p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
                  >
                    <div
                      className={`h-52 w-52 ${used ? "opacity-40 grayscale" : ""}`}
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                    {!used && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-3 top-3 h-0.5 animate-[scan-line_2.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan to-transparent shadow-[0_0_12px_#22d3ee]"
                      />
                    )}
                  </div>
                  <p className="mt-5 text-[11px] tracking-[0.3em] text-zinc-500 uppercase">Entry code</p>
                  <p
                    data-code
                    className="mt-1 font-mono text-3xl font-bold tracking-wider text-white"
                    aria-label={`Entry code ${ticket.code.split("").join(" ")}`}
                  >
                    {ticket.code}
                  </p>
                </div>

                {used && (
                  <div className="pointer-events-none absolute inset-0 grid [transform:translateZ(80px)] place-items-center">
                    <div
                      data-stamp
                      data-intro
                      className="rounded-xl border-4 border-success px-5 py-2 text-center font-display text-success shadow-[0_0_40px_rgba(52,211,153,0.4)]"
                      style={{ background: "rgba(4,4,11,0.75)", transform: "rotate(-12deg)" }}
                    >
                      <p className="text-xl font-bold tracking-widest">CHECKED IN</p>
                      <p className="font-mono text-xs" suppressHydrationWarning>
                        {formatTimeShort(ticket.checkedInAt!)} · ticket used
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div
                className={`flex items-center justify-center gap-2 border-t border-white/5 px-7 py-3 text-xs ${used ? "text-success" : "text-cyan"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${used ? "bg-success" : "animate-pulse bg-cyan"}`} />
                {used ? "Already used — this ticket can't be scanned again" : "Valid for one entry"}
              </div>
            </article>
          </TiltCard>
        </div>

        <div className="no-print mt-8 grid grid-cols-2 gap-3">
          <a
            data-action
            data-intro
            href={`/api/tickets/${ticket.code}/qr?download`}
            download
            className={buttonClasses("primary", "md", "w-full")}
          >
            <span className="relative">Download QR</span>
          </a>
          <div data-action data-intro>
            <CopyButton value={ticket.code} label="Copy code" size="md" className="w-full" />
          </div>
          <div data-action data-intro>
            <CopyButton value={`/tickets/${ticket.code}`} label="Copy ticket link" size="md" className="w-full" />
          </div>
          <div data-action data-intro>
            <button type="button" onClick={() => window.print()} className={buttonClasses("secondary", "md", "w-full")}>
              <span className="relative">Print</span>
            </button>
          </div>
        </div>

        <div
          data-action
          data-intro
          className="no-print mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-center"
        >
          <p className="text-xs text-zinc-500">Organizer at the gate?</p>
          <LinkButton
            href={`/checkin?event=${ticket.event.id}&code=${ticket.code}`}
            variant="ghost"
            size="sm"
            className="mt-1"
          >
            Verify this ticket at the check-in gate →
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
