"use client";

import { animate, stagger } from "animejs";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatedNumber } from "@/components/motion/CountUp";
import { useAnimeScope } from "@/components/motion/useAnimeScope";
import type { PortalStatus } from "@/components/three/PortalScene";
import { Button } from "@/components/ui/Button";
import { formatPartialCode, normalizeEntryCode } from "@/lib/codes";
import { formatTimeShort, percent } from "@/lib/format";
import type { CheckInResult } from "@/lib/services/checkin";
import type { EventStats } from "@/lib/services/events";
import { decodeQrFromFile, QrScanner } from "./QrScanner";
import { ResultCard, type GateResult } from "./ResultCard";
import { RESULT_META } from "./resultMeta";
import { useGateFeedback } from "./useGateFeedback";

const PortalScene = dynamic(() => import("@/components/three/PortalScene"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-full bg-[radial-gradient(circle,rgba(124,92,255,0.3),transparent_65%)]" />
  ),
});

export type GateEvent = { id: string; name: string; theme: string; stats: EventStats };

type Mode = "manual" | "camera";

export function CheckInConsole({
  events,
  initialEventId,
  initialCode,
}: {
  events: GateEvent[];
  initialEventId: string | null;
  initialCode: string | null;
}) {
  const [eventId, setEventId] = useState<string>(
    initialEventId && events.some((e) => e.id === initialEventId) ? initialEventId : "",
  );
  const [eventStats, setEventStats] = useState<Record<string, EventStats>>(() =>
    Object.fromEntries(events.map((e) => [e.id, e.stats])),
  );
  const [mode, setMode] = useState<Mode>("manual");
  const [code, setCode] = useState(() => (initialCode ? formatPartialCode(initialCode) : ""));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GateResult | null>(null);
  const [history, setHistory] = useState<GateResult[]>([]);
  const [session, setSession] = useState({ scanned: 0, admitted: 0, rejected: 0 });
  const [sound, setSound] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const feedback = useGateFeedback(sound);

  // The gate page stays alive between navigations (React <Activity>). When it is
  // opened again with a different ticket or event, or with fresh counts from the
  // server, take those over instead of showing the previous visit's values.
  const [seenProps, setSeenProps] = useState({ events, initialEventId, initialCode });
  if (
    seenProps.events !== events ||
    seenProps.initialEventId !== initialEventId ||
    seenProps.initialCode !== initialCode
  ) {
    setSeenProps({ events, initialEventId, initialCode });
    setEventStats(Object.fromEntries(events.map((e) => [e.id, e.stats])));
    if (initialEventId !== seenProps.initialEventId) {
      setEventId(initialEventId && events.some((e) => e.id === initialEventId) ? initialEventId : "");
    }
    if (initialCode !== seenProps.initialCode) {
      setCode(initialCode ? formatPartialCode(initialCode) : "");
      setResult(null);
      setError(null);
    }
  }

  const selected = events.find((e) => e.id === eventId) ?? null;
  const selectedStats = selected ? eventStats[selected.id] : null;

  const root = useAnimeScope<HTMLDivElement>(({ root, reduced }) => {
    if (reduced) return;
    animate(root.querySelectorAll("[data-panel]"), {
      opacity: [0, 1],
      y: [40, 0],
      delay: stagger(110, { start: 100 }),
      duration: 1000,
      ease: "out(4)",
    });
  });

  const changeEvent = (id: string) => {
    setEventId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("event", id);
    else url.searchParams.delete("event");
    url.searchParams.delete("code");
    window.history.replaceState(null, "", url);
  };

  const verify = useCallback(
    async (raw: string) => {
      if (busyRef.current) return;
      setError(null);
      const trimmed = raw.trim();
      if (!trimmed) {
        setError("Enter or scan an entry code.");
        return;
      }
      busyRef.current = true;
      setBusy(true);
      try {
        const res = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: trimmed, eventId: eventId || undefined }),
        });
        const data = (await res.json()) as CheckInResult | { error: { message: string } };
        if ("error" in data) {
          setError(data.error.message);
          return;
        }
        const entry: GateResult = { ...data, at: Date.now() };
        setResult(entry);
        setHistory((h) => [entry, ...h].slice(0, 8));
        setSession((s) => ({
          scanned: s.scanned + 1,
          admitted: s.admitted + (data.status === "SUCCESS" ? 1 : 0),
          rejected: s.rejected + (data.status === "SUCCESS" ? 0 : 1),
        }));
        if ("stats" in data) {
          const stats = data.stats;
          setEventStats((all) => ({ ...all, [data.event.id]: stats }));
        }
        setPulse((p) => p + 1);
        feedback(data.status);
        if (flashRef.current) {
          flashRef.current.style.background = RESULT_META[data.status].color;
          animate(flashRef.current, { opacity: [0.28, 0], duration: 900, ease: "out(3)" });
        }
      } catch {
        setError("Network error — check the connection and try again.");
      } finally {
        busyRef.current = false;
        setBusy(false);
        if (mode === "manual") requestAnimationFrame(() => inputRef.current?.select());
      }
    },
    [eventId, feedback, mode],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    verify(code ? `EE-${code}` : "");
  }

  async function onImage(file: File | undefined) {
    if (!file) return;
    setError(null);
    const text = await decodeQrFromFile(file).catch(() => null);
    if (!text) {
      setError("Couldn't find a QR code in that image.");
      return;
    }
    const normalized = normalizeEntryCode(text);
    if (normalized) setCode(formatPartialCode(normalized));
    verify(text);
  }

  // Keyboard-wedge USB scanners type the code + Enter into the focused input.
  useEffect(() => {
    if (mode === "manual") inputRef.current?.focus();
  }, [mode]);

  const portalStatus: PortalStatus = busy ? "busy" : result ? result.status : "idle";

  return (
    <div ref={root}>
      <div ref={flashRef} aria-hidden className="pointer-events-none fixed inset-0 z-[55] opacity-0" />

      {/* Gate settings */}
      <div
        data-panel
        data-intro
        className="flex flex-col gap-4 rounded-3xl p-4 glass sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <label className="flex flex-1 flex-col gap-1.5 sm:max-w-md">
          <span className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Gate is checking in for</span>
          <select
            value={eventId}
            onChange={(e) => changeEvent(e.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-ink-900 px-4 text-sm font-medium text-white outline-none focus:border-violet-soft"
          >
            <option value="">Any event (accept every valid ticket)</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-6">
          {selectedStats ? (
            <div className="text-right">
              <p className="font-display text-2xl font-bold text-white">
                <AnimatedNumber value={selectedStats.checkedIn} />
                <span className="text-zinc-500"> / {selectedStats.registered}</span>
              </p>
              <p className="text-xs text-zinc-500">checked in · {percent(selectedStats.attendanceRate)} attendance</p>
            </div>
          ) : (
            <p className="max-w-[16rem] text-xs text-zinc-500">
              Pick an event to also reject tickets that belong to other events.
            </p>
          )}
          <button
            type="button"
            onClick={() => setSound((s) => !s)}
            aria-pressed={sound}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg transition-colors hover:bg-white/10"
            title={sound ? "Mute gate sounds" : "Unmute gate sounds"}
          >
            <span aria-hidden>{sound ? "🔊" : "🔇"}</span>
            <span className="sr-only">{sound ? "Mute" : "Unmute"} gate sounds</span>
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Input side */}
        <section data-panel data-intro className="rounded-3xl p-5 glass sm:p-7" aria-label="Scan or enter a code">
          <div
            role="tablist"
            aria-label="Input method"
            className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-ink-900/70 p-1"
          >
            {(
              [
                ["manual", "⌨️  Enter code"],
                ["camera", "📷  Scan QR"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
                className={`rounded-xl py-2.5 text-sm font-semibold transition-all ${
                  mode === id ? "bg-aurora text-ink-950 shadow-lg" : "text-zinc-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {mode === "manual" ? (
              <form onSubmit={onSubmit} className="space-y-4">
                <label htmlFor="entry-code" className="block text-sm font-medium text-zinc-300">
                  Entry code
                </label>
                <div className="flex h-20 items-center rounded-2xl border border-white/10 bg-ink-900 px-5 font-mono text-3xl font-bold tracking-[0.18em] transition-[border-color,box-shadow] focus-within:border-violet-soft focus-within:shadow-[0_0_0_5px_rgba(124,92,255,0.18)] sm:text-4xl">
                  <span className="text-zinc-500 select-none">EE-</span>
                  <input
                    ref={inputRef}
                    id="entry-code"
                    value={code}
                    onChange={(e) => setCode(formatPartialCode(e.target.value))}
                    onPaste={(e) => {
                      e.preventDefault();
                      setCode(formatPartialCode(e.clipboardData.getData("text")));
                    }}
                    placeholder="XXXX-XXXX"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="w-full min-w-0 bg-transparent text-white uppercase outline-none placeholder:text-zinc-700"
                    aria-describedby="code-help"
                  />
                </div>
                <p id="code-help" className="text-xs text-zinc-500">
                  Case and dashes don&apos;t matter. Codes never contain 0, O, 1, I or L. USB barcode scanners work here
                  too.
                </p>
                <Button type="submit" size="lg" className="w-full" loading={busy}>
                  Verify &amp; check in
                </Button>
              </form>
            ) : (
              <QrScanner onResult={verify} paused={busy} />
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-5">
            <label className="cursor-pointer text-sm text-zinc-400 transition-colors hover:text-white">
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onImage(e.target.files?.[0])} />
              🖼️ Scan from an image…
            </label>
            {selected && (
              <Link
                href={`/events/${selected.id}`}
                className="text-sm text-zinc-400 transition-colors hover:text-white"
              >
                Event dashboard →
              </Link>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
              {error}
            </p>
          )}
        </section>

        {/* Verdict side */}
        <section data-panel data-intro className="relative flex flex-col gap-4" aria-label="Verification result">
          <div className="relative mx-auto -mt-4 -mb-12 aspect-square w-full max-w-[300px]">
            <PortalScene status={portalStatus} pulse={pulse} />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="font-mono text-[11px] tracking-[0.35em] text-zinc-400 uppercase">
                {busy ? "Verifying" : result ? RESULT_META[result.status].short : "Gate ready"}
              </span>
            </div>
          </div>
          <div className="relative z-10">
            <ResultCard result={result} busy={busy} />
          </div>
        </section>
      </div>

      {/* Session */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section
          data-panel
          data-intro
          className="grid grid-cols-3 gap-2 rounded-3xl p-5 text-center glass"
          aria-label="This session"
        >
          {(
            [
              ["Scanned", session.scanned, "text-white"],
              ["Admitted", session.admitted, "text-success"],
              ["Rejected", session.rejected, "text-danger"],
            ] as const
          ).map(([label, value, color]) => (
            <div key={label}>
              <p className={`font-display text-3xl font-bold ${color}`}>
                <AnimatedNumber value={value} />
              </p>
              <p className="mt-1 text-xs tracking-widest text-zinc-500 uppercase">{label}</p>
            </div>
          ))}
        </section>
        <section data-panel data-intro className="rounded-3xl p-5 glass" aria-label="Recent scans">
          <h2 className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Recent scans at this gate</h2>
          {history.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {history.map((h) => {
                const meta = RESULT_META[h.status];
                return (
                  <li
                    key={h.at}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${meta.border} ${meta.bg}`}
                  >
                    <span className={`font-semibold ${meta.text}`}>{meta.short}</span>
                    <span className="text-zinc-300">{"participant" in h ? h.participant.name : h.code}</span>
                    <span className="text-zinc-500" suppressHydrationWarning>
                      {formatTimeShort(new Date(h.at))}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">Nothing yet. Results from this device will be listed here.</p>
          )}
        </section>
      </div>
    </div>
  );
}
