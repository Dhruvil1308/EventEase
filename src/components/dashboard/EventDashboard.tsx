"use client";

import { animate, stagger } from "animejs";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { RESULT_META } from "@/components/checkin/resultMeta";
import { AnimatedNumber } from "@/components/motion/CountUp";
import { useAnimeScope } from "@/components/motion/useAnimeScope";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton, buttonClasses } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { formatFullDate, formatTimeShort, percent } from "@/lib/format";
import type { EventSummary } from "@/lib/services/events";
import type { EventLiveData } from "@/lib/services/live";
import { getTheme, themeVars } from "@/lib/themes";
import { ActivityFeed } from "./ActivityFeed";
import { ParticipantsTable } from "./ParticipantsTable";

const POLL_MS = 4000;

type Toast = { tone: "success" | "danger" | "warn"; text: string } | null;

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 text-zinc-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

export function EventDashboard({ event, initial }: { event: EventSummary; initial: EventLiveData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justCreated = searchParams.get("created") === "1";
  const [live, setLive] = useState(initial);
  // Next.js keeps visited pages alive (React <Activity>), so this component can
  // come back with old state. Adopt each fresh server snapshot when it arrives.
  const [snapshot, setSnapshot] = useState(initial);
  if (initial !== snapshot) {
    setSnapshot(initial);
    setLive(initial);
  }
  const [online, setOnline] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = getTheme(event.theme);
  const { stats, gate } = live;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${event.id}/live`, { cache: "no-store" });
      if (res.status === 404) {
        router.replace("/events");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setLive(await res.json());
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [event.id, router]);

  // Live polling, paused while the tab is hidden.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(refresh, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
        start();
      } else stop();
    };
    // Fetch right away on first mount and every time the page is shown again
    // after navigating away, instead of waiting for the first poll.
    const kickoff = setTimeout(refresh, 0);
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(kickoff);
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  // Don't bring back a half-finished delete confirmation or an old toast.
  useLayoutEffect(() => {
    return () => {
      setConfirmDelete(false);
      setToast(null);
    };
  }, []);

  const showToast = (t: NonNullable<Toast>) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  async function manualCheckIn(code: string) {
    setBusyCode(code);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, eventId: event.id }),
      });
      const data = await res.json();
      const meta = RESULT_META[data.status as keyof typeof RESULT_META];
      showToast({
        tone: data.status === "SUCCESS" ? "success" : data.status === "DUPLICATE" ? "danger" : "warn",
        text: meta ? `${meta.label} — ${data.participant?.name ?? code}` : (data.error?.message ?? "Check-in failed"),
      });
      await refresh();
    } catch {
      showToast({ tone: "danger", text: "Network error — try again." });
    } finally {
      setBusyCode(null);
    }
  }

  async function deleteEvent() {
    setDeleting(true);
    const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    if (res.ok || res.status === 404) {
      router.push("/events");
      router.refresh();
    } else {
      setDeleting(false);
      showToast({ tone: "danger", text: "Couldn't delete the event." });
    }
  }

  const root = useAnimeScope<HTMLDivElement>(({ root, reduced }) => {
    if (reduced) return;
    animate(root.querySelectorAll("[data-dash]"), {
      opacity: [0, 1],
      y: [40, 0],
      scale: [0.97, 1],
      delay: stagger(90),
      duration: 1000,
      ease: "out(4)",
    });
  });

  // Toast entrance
  const toastRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (toast && toastRef.current) {
      animate(toastRef.current, { opacity: [0, 1], y: [30, 0], scale: [0.9, 1], duration: 500, ease: "outBack(2)" });
    }
  }, [toast]);

  const registrationUrl = `/events/${event.id}/register`;
  const isFull = stats.remaining === 0;

  return (
    <div ref={root} style={themeVars(event.theme) as CSSProperties}>
      {justCreated && (
        <div
          data-dash
          data-intro
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-success">
            <span className="font-semibold">Event created!</span> Share the registration link with participants.
          </p>
          <CopyButton value={registrationUrl} label="Copy registration link" size="sm" />
        </div>
      )}

      {/* Hero banner */}
      <section
        data-dash
        data-intro
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-900"
      >
        <div aria-hidden className="absolute inset-0 bg-theme opacity-30" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(var(--t-glow)/0.45),transparent_60%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,#000,transparent)] opacity-40"
        />
        <div className="relative flex flex-col gap-8 p-7 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={online ? "success" : "warn"} dot={online}>
                {online ? "Live" : "Reconnecting…"}
              </Badge>
              {isFull ? (
                <Badge tone="danger">Full</Badge>
              ) : (
                <Badge tone="info">
                  {stats.remaining} {stats.remaining === 1 ? "seat" : "seats"} left
                </Badge>
              )}
            </div>
            <h1 className="mt-5 font-display text-3xl leading-tight font-bold text-white sm:text-5xl">{event.name}</h1>
            <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-300" suppressHydrationWarning>
              <span className="inline-flex items-center gap-1.5">
                <Icon d="M6 2v3M14 2v3M3 8h14M4 4h12a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
                {formatFullDate(event.startsAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon d="M10 18a8 8 0 100-16 8 8 0 000 16zM10 6v4l2.5 2.5" />
                {formatTimeShort(event.startsAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon d="M10 18s6-5.3 6-10a6 6 0 10-12 0c0 4.7 6 10 6 10zM10 10a2 2 0 100-4 2 2 0 000 4z" />
                {event.venue}
              </span>
            </p>
            {event.description && (
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">{event.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {!isFull && (
              <CopyButton value={registrationUrl} label="Copy registration link" copiedLabel="Link copied!" size="md" />
            )}
            <LinkButton href={`/checkin?event=${event.id}`}>
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden
              >
                <path
                  d="M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16"
                  strokeLinecap="round"
                />
              </svg>
              Open check-in gate
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div data-dash data-intro className="grid min-w-0 gap-6 rounded-3xl p-6 glass sm:grid-cols-2 sm:p-8">
          <div className="flex items-center gap-5">
            <ProgressRing
              value={stats.fillRate}
              size={132}
              stroke={11}
              from={theme.from}
              to={theme.via}
              label={`Capacity ${percent(stats.fillRate)} full`}
            >
              <div>
                <p className="font-display text-2xl font-bold text-white">
                  <AnimatedNumber value={stats.registered} />
                </p>
                <p className="text-[11px] text-zinc-500">of {stats.capacity}</p>
              </div>
            </ProgressRing>
            <div>
              <p className="text-xs tracking-widest text-zinc-500 uppercase">Registered</p>
              <p className="mt-1 font-display text-xl font-semibold text-white">{percent(stats.fillRate)} full</p>
              <p className="mt-1 text-sm text-zinc-400">
                <AnimatedNumber value={stats.remaining} /> {stats.remaining === 1 ? "seat" : "seats"} remaining
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <ProgressRing
              value={stats.attendanceRate}
              size={132}
              stroke={11}
              from="#34d399"
              to="#22d3ee"
              label={`Attendance ${percent(stats.attendanceRate)}`}
            >
              <div>
                <p className="font-display text-2xl font-bold text-white">
                  <AnimatedNumber value={stats.checkedIn} />
                </p>
                <p className="text-[11px] text-zinc-500">checked in</p>
              </div>
            </ProgressRing>
            <div>
              <p className="text-xs tracking-widest text-zinc-500 uppercase">Attendance</p>
              <p className="mt-1 font-display text-xl font-semibold text-white">{percent(stats.attendanceRate)}</p>
              <p className="mt-1 text-sm text-zinc-400">
                <AnimatedNumber value={stats.registered - stats.checkedIn} /> still to arrive
              </p>
            </div>
          </div>
        </div>

        <div data-dash data-intro className="grid grid-cols-2 gap-4">
          {(["SUCCESS", "DUPLICATE", "INVALID", "WRONG_EVENT"] as const).map((key) => {
            const meta = RESULT_META[key];
            return (
              <div key={key} className={`rounded-2xl p-5 glass`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full`} style={{ background: meta.color }} />
                  <p className="text-xs tracking-widest text-zinc-500 uppercase">{meta.short}</p>
                </div>
                <p className={`mt-3 font-display text-3xl font-bold ${meta.text}`}>
                  <AnimatedNumber value={gate[key]} />
                </p>
                <p className="mt-1 text-xs text-zinc-500">gate scans</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Participants + activity */}
      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div data-dash data-intro className="min-w-0 rounded-3xl p-5 glass sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-white">Participants</h2>
            <div className="flex flex-wrap gap-2">
              <a href={`/api/events/${event.id}/export`} download className={buttonClasses("ghost", "sm")}>
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v7.6l2.3-2.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L9 11.6V4a1 1 0 011-1zM4 15a1 1 0 011 1v1h10v-1a1 1 0 112 0v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Export CSV
              </a>
              <CopyButton value={registrationUrl} label="Copy registration link" size="sm" />
            </div>
          </div>
          <ParticipantsTable participants={live.participants} onCheckIn={manualCheckIn} busyCode={busyCode} />
        </div>
        <div data-dash data-intro className="min-w-0 rounded-3xl p-5 glass sm:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-white">Gate activity</h2>
            <span className="text-xs text-zinc-500">auto-refreshing</span>
          </div>
          <ActivityFeed items={live.activity} />
        </div>
      </section>

      {/* Danger zone */}
      <section
        data-dash
        data-intro
        className="mt-6 flex flex-col gap-4 rounded-3xl border border-danger/15 bg-danger/[0.04] p-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="font-semibold text-white">Delete event</h2>
          <p className="text-sm text-zinc-500">
            Removes the event, all registrations and its gate log. This can&apos;t be undone.
          </p>
        </div>
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteEvent} loading={deleting}>
              Yes, delete everything
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete event
          </Button>
        )}
      </section>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div
            ref={toastRef}
            role="status"
            className={`pointer-events-auto rounded-2xl border px-5 py-3 text-sm font-medium shadow-2xl glass-strong ${
              toast.tone === "success"
                ? "border-success/40 text-success"
                : toast.tone === "danger"
                  ? "border-danger/40 text-danger"
                  : "border-warn/40 text-warn"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}
