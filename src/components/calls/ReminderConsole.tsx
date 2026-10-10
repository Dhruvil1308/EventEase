"use client";

import { animate, stagger } from "animejs";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAnimeScope } from "@/components/motion/useAnimeScope";
import { AnimatedNumber } from "@/components/motion/CountUp";
import { Badge } from "@/components/ui/Badge";
import { Button, Spinner } from "@/components/ui/Button";
import {
  CALL_LANGUAGES,
  CALL_LANGUAGE_IDS,
  formatLead,
  REMINDER_LEAD_PRESETS,
  type CallLanguage,
  type ReminderLanguage,
} from "@/lib/call-languages";
import { formatDateTime, formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { CallConsoleData, CallRow, CallStatus, PromptView } from "@/lib/services/reminders";
import { themeVars } from "@/lib/themes";

type Toast = { tone: "success" | "danger" | "warn"; text: string } | null;
type Filter = "all" | "todo" | "reached" | "confirmed" | "unreachable" | "nophone";

const STATUS: Record<
  CallStatus,
  { label: string; tone: "neutral" | "success" | "danger" | "warn" | "info" | "violet"; live?: boolean }
> = {
  QUEUED: { label: "In queue", tone: "violet" },
  DIALING: { label: "Dialling…", tone: "info", live: true },
  RINGING: { label: "Ringing…", tone: "info", live: true },
  IN_PROGRESS: { label: "On the call", tone: "success", live: true },
  COMPLETED: { label: "Reached", tone: "success" },
  NO_ANSWER: { label: "No answer", tone: "warn" },
  BUSY: { label: "Busy / declined", tone: "warn" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELED: { label: "Canceled", tone: "neutral" },
};

const INTENT = {
  CONFIRMED: { label: "👍 Coming", tone: "success" },
  DECLINED: { label: "✋ Can't come", tone: "danger" },
  UNSURE: { label: "🤔 Unsure", tone: "warn" },
  NO_RESPONSE: { label: "No reply", tone: "neutral" },
} as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const isLive = (r: CallRow) => Boolean(r.lastCall && STATUS[r.lastCall.status]?.live);
const isBusy = (r: CallRow) => Boolean(r.lastCall && (r.lastCall.status === "QUEUED" || isLive(r)));

/** Aanaya's animated presence — calm rings when idle, a live waveform while she's on a call. */
function VoiceOrb({ speaking }: { speaking: boolean }) {
  return (
    <div className="relative grid h-28 w-28 shrink-0 place-items-center" aria-hidden>
      <span
        className={`absolute inset-0 rounded-full bg-aurora opacity-30 blur-2xl ${speaking ? "animate-pulse" : ""}`}
      />
      <span className="absolute inset-2 animate-[spin_9s_linear_infinite] rounded-full border border-dashed border-cyan/40" />
      <span className="absolute inset-5 animate-[spin_14s_linear_infinite_reverse] rounded-full border border-violet-soft/40" />
      <span className="relative grid h-16 w-16 place-items-center rounded-full bg-aurora shadow-[0_0_40px_-6px_rgba(34,211,238,0.8)]">
        <span className="flex h-6 items-center gap-[3px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-ink-950"
              style={{
                height: speaking ? undefined : `${[8, 14, 20, 14, 8][i]}px`,
                animation: speaking ? `voice-bar 0.9s ease-in-out ${i * 0.12}s infinite alternate` : undefined,
              }}
            />
          ))}
        </span>
      </span>
    </div>
  );
}

export function ReminderConsole({ initial }: { initial: CallConsoleData }) {
  const [data, setData] = useState(initial);
  const [snapshot, setSnapshot] = useState(initial);
  if (initial !== snapshot) {
    setSnapshot(initial);
    setData(initial);
  }
  const { event, stats, setup } = data;

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [batchLanguage, setBatchLanguage] = useState<CallLanguage | "event">("event");
  const [skipReached, setSkipReached] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (t: NonNullable<Toast>) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  };

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${event.id}/calls`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // Keep the last good snapshot; the next poll retries.
    }
  }, [event.id]);

  // Poll quickly while calls are queued or live, slowly otherwise.
  const active = stats.queued + stats.live > 0;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(
        async () => {
          if (document.visibilityState === "visible") await refresh();
          loop();
        },
        active ? 2500 : 10_000,
      );
    };
    loop();
    return () => clearTimeout(timer);
  }, [active, refresh]);

  const root = useAnimeScope<HTMLDivElement>(({ root, reduced }) => {
    if (reduced) return;
    animate(root.querySelectorAll("[data-panel]"), {
      opacity: [0, 1],
      y: [32, 0],
      delay: stagger(80),
      duration: 900,
      ease: "out(4)",
    });
  });

  async function startCalls(registrationIds?: string[]) {
    const key = registrationIds?.[0] ?? "all";
    setBusy(key);
    try {
      const res = await fetch(`/api/events/${event.id}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationIds,
          language: batchLanguage === "event" ? undefined : batchLanguage,
          skipReached: registrationIds ? false : skipReached,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        showToast({
          tone: res.status === 503 ? "warn" : "danger",
          text: body.error?.message ?? "Couldn't start the calls.",
        });
      } else {
        const extra = [
          body.noPhone ? `${body.noPhone} without a number` : "",
          body.alreadyReached ? `${body.alreadyReached} already reached` : "",
        ]
          .filter(Boolean)
          .join(", ");
        showToast({
          tone: "success",
          text: `📞 ${body.queued} call${body.queued === 1 ? "" : "s"} queued — Aanaya dials them one by one.${extra ? ` (Skipped ${extra}.)` : ""}`,
        });
      }
      await refresh();
    } catch {
      showToast({ tone: "danger", text: "Network error — try again." });
    } finally {
      setBusy(null);
    }
  }

  async function stopQueue() {
    setBusy("stop");
    const res = await fetch(`/api/events/${event.id}/calls`, { method: "DELETE" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    showToast({
      tone: "warn",
      text: res?.ok ? `Stopped — ${body?.canceled ?? 0} queued call(s) canceled.` : "Couldn't stop the queue.",
    });
    setBusy(null);
    await refresh();
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return data.rows.filter((r) => {
      const s = r.lastCall?.status;
      if (filter === "todo" && (!r.phone || s === "COMPLETED")) return false;
      if (filter === "reached" && s !== "COMPLETED") return false;
      if (filter === "confirmed" && r.lastCall?.intent !== "CONFIRMED") return false;
      if (filter === "unreachable" && !["NO_ANSWER", "BUSY", "FAILED"].includes(s ?? "")) return false;
      if (filter === "nophone" && r.phone) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.includes(q) ||
        (digits.length > 2 && (r.phone ?? "").includes(digits))
      );
    });
  }, [data.rows, filter, query]);

  const liveRow = data.rows.find(isLive);
  const toCall = data.rows.filter(
    (r) => r.phone && !isBusy(r) && (!skipReached || r.lastCall?.status !== "COMPLETED"),
  ).length;

  const tiles = [
    { label: "Registrants", value: stats.registrants, color: "text-white" },
    { label: "With mobile", value: stats.withPhone, color: "text-cyan" },
    { label: "Reached", value: stats.reached, color: "text-success" },
    { label: "Coming 👍", value: stats.confirmed, color: "text-success" },
    { label: "Can't come", value: stats.declined, color: "text-danger" },
    { label: "Unreachable", value: stats.unreachable, color: "text-warn" },
  ];

  return (
    <div ref={root} style={themeVars(event.theme) as CSSProperties} className="space-y-6">
      {/* Hero */}
      <section
        data-panel
        data-intro
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-900 p-7 sm:p-10"
      >
        <div aria-hidden className="absolute inset-0 bg-theme opacity-20" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.25),transparent_55%)]"
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-6">
            <VoiceOrb speaking={Boolean(liveRow)} />
            <div>
              <p className="font-mono text-xs tracking-[0.3em] text-cyan uppercase">Aanaya · AI voice agent</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">Reminder calls</h1>
              <p className="mt-1 text-zinc-300">{event.name}</p>
              <p className="mt-2 text-sm text-zinc-400" role="status" aria-live="polite">
                {liveRow ? (
                  <>
                    <span className="text-success">●</span> {STATUS[liveRow.lastCall!.status].label} {liveRow.name} ·{" "}
                    {formatPhone(liveRow.phone)}
                  </>
                ) : stats.queued ? (
                  `${stats.queued} waiting in the queue`
                ) : (
                  "Gujarati · Hindi · English — every call under 20 seconds."
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-3">
              {stats.queued > 0 && (
                <Button variant="danger" onClick={stopQueue} loading={busy === "stop"}>
                  Stop queue
                </Button>
              )}
              <Button
                size="lg"
                onClick={() => startCalls()}
                loading={busy === "all"}
                disabled={!setup.canCall || toCall === 0}
                title={!setup.canCall ? "Finish the setup below first" : undefined}
              >
                📞 Call everyone one by one{toCall ? ` (${toCall})` : ""}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              <label className="flex items-center gap-2">
                Language
                <select
                  value={batchLanguage}
                  onChange={(e) => setBatchLanguage(e.target.value as CallLanguage | "event")}
                  className="h-8 rounded-lg border border-white/10 bg-ink-900 px-2 text-xs text-white outline-none focus:border-violet-soft"
                >
                  <option value="event">Event setting</option>
                  {CALL_LANGUAGE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {CALL_LANGUAGES[id].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipReached}
                  onChange={(e) => setSkipReached(e.target.checked)}
                  className="accent-cyan"
                />
                Skip people already reached
              </label>
            </div>
          </div>
        </div>
      </section>

      {!setup.canCall && <SetupChecklist items={setup.items} />}

      {/* Stats */}
      <dl data-panel data-intro className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl px-5 py-4 glass">
            <dt className="text-xs tracking-widest text-zinc-500 uppercase">{t.label}</dt>
            <dd className={`mt-1 font-display text-3xl font-bold tabular-nums ${t.color}`}>
              <AnimatedNumber value={t.value} />
            </dd>
          </div>
        ))}
      </dl>

      <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Registrants */}
        <div data-panel data-intro className="min-w-0 rounded-3xl p-5 glass sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-white">
              Registrants <span className="font-mono text-sm text-zinc-500">{data.rows.length}</span>
            </h2>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-ink-900/60 px-3 sm:w-64">
              <span className="sr-only">Search registrants</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email or number"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </label>
          </div>
          <div
            className="mb-4 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-ink-900/60 p-1"
            role="tablist"
            aria-label="Filter registrants"
          >
            {(
              [
                ["all", "All"],
                ["todo", "To call"],
                ["reached", "Reached"],
                ["confirmed", "Coming"],
                ["unreachable", "Unreachable"],
                ["nophone", "No number"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === id ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-[640px] overflow-auto rounded-2xl border border-white/5">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-ink-850/95 text-xs tracking-wider text-zinc-500 uppercase backdrop-blur">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Attendee
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Mobile
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Call
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Reply
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => {
                  const status = r.lastCall ? STATUS[r.lastCall.status] : null;
                  const intent = r.lastCall?.intent ? INTENT[r.lastCall.intent] : null;
                  return (
                    <tr
                      key={r.registrationId}
                      className={`transition-colors hover:bg-white/[0.03] ${isLive(r) ? "bg-success/[0.05]" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {r.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- ≤300 KB storage image
                            <img src={r.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                          ) : (
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-aurora text-xs font-bold text-ink-950">
                              {initials(r.name)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">
                              {r.name} {r.checkedIn && <span title="Checked in at the gate">✅</span>}
                            </p>
                            <p className="truncate text-xs text-zinc-500">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.phone ? (
                          <div>
                            <a
                              href={`tel:${r.phone}`}
                              className="font-mono text-xs text-zinc-200 transition-colors hover:text-cyan"
                            >
                              {formatPhone(r.phone)}
                            </a>
                            <p className="text-[11px] text-zinc-500">{CALL_LANGUAGES[r.language].native}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600">No number</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {status ? (
                          <div className="space-y-1">
                            <Badge tone={status.tone} dot={status.live}>
                              {status.label}
                            </Badge>
                            <p
                              className="text-[11px] text-zinc-500"
                              suppressHydrationWarning
                              title={r.lastCall?.error ?? undefined}
                            >
                              {r.lastCall?.durationSec ? `${r.lastCall.durationSec}s · ` : ""}
                              {r.lastCall?.trigger === "SCHEDULED" ? "scheduled · " : ""}
                              {formatRelative(r.lastCall!.at, new Date(data.now).getTime())}
                              {r.attempts > 1 ? ` · ${r.attempts} calls` : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600">Not called</span>
                        )}
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        {intent ? (
                          <div className="space-y-1">
                            <Badge tone={intent.tone}>{intent.label}</Badge>
                            {r.lastCall?.transcript && (
                              <p className="truncate text-[11px] text-zinc-400 italic" title={r.lastCall.transcript}>
                                “{r.lastCall.transcript}”
                              </p>
                            )}
                          </div>
                        ) : r.lastCall?.status === "COMPLETED" ? (
                          <span className="text-xs text-zinc-500">Listening…</span>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => startCalls([r.registrationId])}
                            disabled={!r.phone || !setup.canCall || isBusy(r) || busy !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan/15 px-3 py-1.5 text-xs font-semibold text-cyan transition-colors hover:bg-cyan/25 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy === r.registrationId ? <Spinner className="h-3 w-3" /> : <span aria-hidden>📞</span>}
                            {r.lastCall && ["COMPLETED", "NO_ANSWER", "BUSY", "FAILED"].includes(r.lastCall.status)
                              ? "Call again"
                              : "Call"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                      {data.rows.length
                        ? "Nobody matches."
                        : "No registrations yet — share the registration link first."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <ScheduleCard data={data} onSaved={refresh} showToast={showToast} />
          <VoicePreview eventId={event.id} canPreview={setup.canPreview} />
        </div>
      </section>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div
            role="status"
            className={`pointer-events-auto max-w-xl rounded-2xl border px-5 py-3 text-sm font-medium shadow-2xl glass-strong ${
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

function SetupChecklist({ items }: { items: CallConsoleData["setup"]["items"] }) {
  return (
    <section data-panel data-intro className="rounded-3xl border border-warn/25 bg-warn/[0.05] p-6">
      <h2 className="font-display text-lg font-semibold text-white">Finish setting up Aanaya</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Add these to your <code className="font-mono text-zinc-300">.env</code> and restart the server.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key} className="flex gap-3 rounded-2xl border border-white/5 bg-ink-900/60 px-4 py-3">
            <span className={i.ok ? "text-success" : i.required ? "text-danger" : "text-zinc-500"} aria-hidden>
              {i.ok ? "✓" : i.required ? "✕" : "○"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{i.label}</p>
              {!i.ok && <p className="text-xs text-zinc-500">{i.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScheduleCard({
  data,
  onSaved,
  showToast,
}: {
  data: CallConsoleData;
  onSaved: () => Promise<void>;
  showToast: (t: NonNullable<Toast>) => void;
}) {
  const { event } = data;
  const [enabled, setEnabled] = useState(event.reminderEnabled);
  const [lead, setLead] = useState(String(event.reminderLeadMinutes));
  const [language, setLanguage] = useState<ReminderLanguage>((event.reminderLanguage as ReminderLanguage) ?? "auto");
  const [early, setEarly] = useState(String(event.reminderArriveEarly));
  const [saving, setSaving] = useState(false);
  const leadMin = Number(lead) || 0;
  const fireAt = new Date(new Date(event.startsAt).getTime() - leadMin * 60_000);
  const dirty =
    enabled !== event.reminderEnabled ||
    leadMin !== event.reminderLeadMinutes ||
    language !== event.reminderLanguage ||
    Number(early) !== event.reminderArriveEarly;

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/events/${event.id}/reminders`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reminderEnabled: enabled,
        reminderLeadMinutes: leadMin,
        reminderLanguage: language,
        reminderArriveEarly: Number(early) || 0,
      }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const field = body?.error?.fields && Object.values(body.error.fields as Record<string, string[]>)[0]?.[0];
      showToast({ tone: "danger", text: field ?? body?.error?.message ?? "Couldn't save the schedule." });
      return;
    }
    showToast({
      tone: "success",
      text: enabled
        ? `Scheduled — Aanaya calls ${formatLead(leadMin)} before the start.`
        : "Scheduled reminders turned off.",
    });
    await onSaved();
  }

  const state = !event.reminderEnabled
    ? { text: "Off", tone: "neutral" as const }
    : event.reminderQueuedAt
      ? { text: "Calls sent", tone: "success" as const }
      : new Date(event.startsAt).getTime() < new Date(data.now).getTime()
        ? { text: "Event started", tone: "neutral" as const }
        : { text: "Armed", tone: "info" as const };

  return (
    <div data-panel data-intro className="space-y-5 rounded-3xl p-6 glass">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-white">⏰ Scheduled reminder</h2>
        <Badge tone={state.tone} dot={state.tone === "info"}>
          {state.text}
        </Badge>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => setEnabled((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white"
      >
        Call everyone automatically
        <span
          aria-hidden
          className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? "bg-success/80" : "bg-white/10"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
          />
        </span>
      </button>
      <div className={enabled ? "space-y-5" : "pointer-events-none space-y-5 opacity-40"}>
        <div>
          <p className="mb-2 text-xs tracking-widest text-zinc-500 uppercase">Before the start</p>
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_LEAD_PRESETS.map((p) => (
              <button
                key={p.minutes}
                type="button"
                onClick={() => setLead(String(p.minutes))}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  leadMin === p.minutes
                    ? "border-cyan/60 bg-cyan/15 text-cyan"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
            <input
              type="number"
              min={5}
              max={10080}
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              aria-label="Minutes before the start"
              className="h-7 w-20 rounded-full border border-white/10 bg-ink-900 px-3 text-xs text-white outline-none focus:border-violet-soft"
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs tracking-widest text-zinc-500 uppercase">Language</p>
          <div className="flex flex-wrap gap-1.5">
            {(["auto", ...CALL_LANGUAGE_IDS] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setLanguage(id)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  language === id
                    ? "border-cyan/60 bg-cyan/15 text-cyan"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:text-white"
                }`}
              >
                {id === "auto" ? "Attendee's choice" : CALL_LANGUAGES[id].native}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">
          Ask them to arrive early by
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={120}
              value={early}
              onChange={(e) => setEarly(e.target.value)}
              className="h-9 w-16 rounded-lg border border-white/10 bg-ink-900 px-2 text-sm text-white outline-none focus:border-violet-soft"
            />
            min
          </span>
        </label>
        <p
          className="rounded-xl border border-cyan/20 bg-cyan/[0.06] px-3 py-2 text-xs text-zinc-300"
          suppressHydrationWarning
        >
          Fires {formatDateTime(fireAt)} ({formatRelative(fireAt, new Date(data.now).getTime())})
        </p>
      </div>
      <Button
        onClick={save}
        loading={saving}
        disabled={!dirty}
        className="w-full"
        variant={dirty ? "primary" : "secondary"}
      >
        {dirty ? "Save schedule" : "Saved"}
      </Button>
    </div>
  );
}

function VoicePreview({ eventId, canPreview }: { eventId: string; canPreview: boolean }) {
  const [language, setLanguage] = useState<CallLanguage>("hi");
  const [prompts, setPrompts] = useState<Partial<Record<CallLanguage, PromptView>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const prompt = prompts[language];

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/reminders/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message ?? "Couldn't generate the preview.");
      setPrompts((p) => ({ ...p, [language]: body.prompt }));
      requestAnimationFrame(() => audio.current?.play().catch(() => {}));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the preview.");
    } finally {
      setLoading(false);
    }
  }

  const totalSeconds = prompt ? Math.ceil(prompt.durationMs / 1000) + prompt.replySeconds + 1 : 0;

  return (
    <div data-panel data-intro className="space-y-4 rounded-3xl p-6 glass">
      <h2 className="font-display text-lg font-semibold text-white">🎧 Hear what Aanaya says</h2>
      <div
        className="flex gap-1 rounded-xl border border-white/10 bg-ink-900/60 p-1"
        role="tablist"
        aria-label="Preview language"
      >
        {CALL_LANGUAGE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={language === id}
            onClick={() => setLanguage(id)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              language === id ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            {CALL_LANGUAGES[id].native}
          </button>
        ))}
      </div>
      {prompt ? (
        <div className="space-y-3">
          <p className="rounded-2xl border border-white/5 bg-ink-900/60 px-4 py-3 text-sm leading-relaxed text-zinc-200">
            {prompt.script}
          </p>
          <audio ref={audio} src={prompt.audioUrl} controls className="w-full" />
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Badge tone="info">Message {(prompt.durationMs / 1000).toFixed(1)}s</Badge>
            <Badge tone="violet">Reply window {prompt.replySeconds}s</Badge>
            <Badge tone={totalSeconds <= 20 ? "success" : "danger"}>
              {totalSeconds <= 20 ? "✓" : "!"} Call ≈ {totalSeconds}s / 20s
            </Badge>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">
          Generates the exact script and Bulbul v3 voice the call will use — so you can listen before anyone is dialled.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button variant="secondary" className="w-full" onClick={generate} loading={loading} disabled={!canPreview}>
        {prompt ? "Regenerate & play" : `Generate ${CALL_LANGUAGES[language].label} preview`}
      </Button>
      {!canPreview && <p className="text-xs text-zinc-500">Add SARVAM_API_KEY to enable voice previews.</p>}
    </div>
  );
}
