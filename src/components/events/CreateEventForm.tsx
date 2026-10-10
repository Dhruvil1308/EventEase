"use client";

import { animate, stagger } from "animejs";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { TiltCard } from "@/components/motion/TiltCard";
import { useAnimeScope } from "@/components/motion/useAnimeScope";
import { Button } from "@/components/ui/Button";
import { FieldShell, InputField, TextareaField } from "@/components/ui/Field";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ProgressRing } from "@/components/ui/ProgressRing";
import {
  CALL_LANGUAGES,
  CALL_LANGUAGE_IDS,
  formatLead,
  REMINDER_LEAD_PRESETS,
  type ReminderLanguage,
} from "@/lib/call-languages";
import { EVENT_TYPES, EVENT_TYPE_IDS, PRIZE_TYPES, formatFee, type EventTypeId, type Prize } from "@/lib/event-types";
import { formatDateTime, formatEndTime } from "@/lib/format";
import type { EditableEvent } from "@/lib/services/events";
import { THEMES, themeVars, type ThemeId } from "@/lib/themes";
import { createEventSchema, fieldErrors, type FieldErrors } from "@/lib/validation";

const CAPACITY_PRESETS = [30, 60, 120, 250, 500];
const DURATIONS = [
  { hours: 1, label: "1 hr" },
  { hours: 2, label: "2 hrs" },
  { hours: 3, label: "3 hrs" },
  { hours: 8, label: "Full day" },
  { hours: 36, label: "36-hr hack" },
];
const PRIZE_PRESETS: Prize[] = [
  { title: "🥇 1st place", reward: "" },
  { title: "🥈 2nd place", reward: "" },
  { title: "🥉 3rd place", reward: "" },
];

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const QUICK_DATES = [
  {
    label: "Tomorrow, 10 AM",
    get: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      return d;
    },
  },
  {
    label: "Friday, 6 PM",
    get: () => {
      const d = new Date();
      const add = (5 - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + add);
      d.setHours(18, 0, 0, 0);
      return d;
    },
  },
  {
    label: "Next week",
    get: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(11, 0, 0, 0);
      return d;
    },
  },
];

type FormState = {
  name: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity: string;
  theme: ThemeId;
  type: EventTypeId;
  entryFee: string;
  prizes: Prize[];
  reminderEnabled: boolean;
  reminderLeadMinutes: string;
  reminderLanguage: ReminderLanguage;
  reminderArriveEarly: string;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  venue: "",
  startsAt: "",
  endsAt: "",
  capacity: "100",
  theme: "aurora",
  type: "WORKSHOP",
  entryFee: "0",
  prizes: [],
  reminderEnabled: false,
  reminderLeadMinutes: "60",
  reminderLanguage: "auto",
  reminderArriveEarly: "10",
};

function fromEvent(e: EditableEvent): FormState {
  return {
    name: e.name,
    description: e.description,
    venue: e.venue,
    startsAt: toLocalInput(new Date(e.startsAt)),
    endsAt: e.endsAt ? toLocalInput(new Date(e.endsAt)) : "",
    capacity: String(e.capacity),
    theme: (e.theme in THEMES ? e.theme : "aurora") as ThemeId,
    type: (e.type in EVENT_TYPES ? e.type : "OTHER") as EventTypeId,
    entryFee: String(e.entryFee),
    prizes: e.prizes,
    reminderEnabled: e.reminderEnabled,
    reminderLeadMinutes: String(e.reminderLeadMinutes),
    reminderLanguage: (["auto", ...CALL_LANGUAGE_IDS].includes(e.reminderLanguage)
      ? e.reminderLanguage
      : "auto") as ReminderLanguage,
    reminderArriveEarly: String(e.reminderArriveEarly),
  };
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section data-field data-intro className="space-y-6 rounded-3xl p-6 glass sm:p-8">
      <div>
        <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    active
      ? "border-cyan/60 bg-cyan/15 text-cyan"
      : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/25 hover:text-white"
  }`;

export function CreateEventForm({ initial }: { initial?: EditableEvent }) {
  const editing = Boolean(initial);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>(() => (initial ? fromEvent(initial) : EMPTY));
  const [cover, setCover] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(initial?.coverUrl ?? null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initial?.coverUrl ?? null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const shouldReset = useRef(false);

  // Next.js keeps this page alive after we navigate to the new event; clear the
  // form when it is hidden so "Create" starts blank next time.
  useLayoutEffect(() => {
    return () => {
      if (!shouldReset.current) return;
      shouldReset.current = false;
      setForm(EMPTY);
      setCover(null);
      setCoverPreview(null);
      setErrors({});
      setFormError(null);
      setSubmitting(false);
    };
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const pickType = (type: EventTypeId) => {
    set("type", type);
    // Competitions get a prize list to start from.
    if (PRIZE_TYPES.includes(type) && form.prizes.length === 0)
      set(
        "prizes",
        PRIZE_PRESETS.map((p) => ({ ...p })),
      );
  };

  const setDuration = (hours: number) => {
    if (!form.startsAt) {
      setErrors((e) => ({ ...e, startsAt: ["Pick the start first"] }));
      return;
    }
    set("endsAt", toLocalInput(new Date(new Date(form.startsAt).getTime() + hours * 3600_000)));
  };

  const updatePrize = (index: number, patch: Partial<Prize>) => {
    set(
      "prizes",
      form.prizes.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  };

  const wrapper = useAnimeScope<HTMLDivElement>(({ root, reduced }) => {
    if (reduced) return;
    animate(root.querySelectorAll("[data-field]"), {
      opacity: [0, 1],
      y: [24, 0],
      delay: stagger(70, { start: 150 }),
      duration: 800,
      ease: "out(4)",
    });
    animate(root.querySelectorAll("[data-preview]"), {
      opacity: [0, 1],
      rotateY: [-35, 0],
      x: [60, 0],
      duration: 1400,
      delay: 300,
      ease: "out(4)",
    });
  });

  function shakeInvalid() {
    const invalid = formRef.current?.querySelectorAll('[aria-invalid="true"]');
    if (invalid?.length) {
      animate(invalid, { x: [0, -10, 9, -6, 4, 0], duration: 500, ease: "inOut(2)" });
      (invalid[0] as HTMLElement).focus();
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = {
      ...form,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
      // Rows left completely blank are ignored rather than rejected.
      prizes: form.prizes.filter((p) => p.title.trim() || p.reward.trim()),
    };
    const parsed = createEventSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      requestAnimationFrame(shakeInvalid);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(editing ? `/api/events/${initial!.id}` : "/api/events", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.error?.fields ?? {});
        setFormError(data.error?.message ?? (editing ? "Couldn't save the event." : "Couldn't create the event."));
        requestAnimationFrame(shakeInvalid);
        setSubmitting(false);
        return;
      }
      const id = data.event.id as string;
      if (cover) {
        const upload = new FormData();
        upload.append("file", cover);
        // The event exists either way; a failed banner upload can be retried from the edit page.
        await fetch(`/api/events/${id}/cover`, { method: "PUT", body: upload }).catch(() => null);
      }
      shouldReset.current = !editing;
      router.push(editing ? `/events/${id}?updated=1` : `/events/${id}?created=1`);
      router.refresh();
    } catch {
      setFormError("Network error — check your connection and try again.");
      setSubmitting(false);
    }
  }

  const capacity = Math.max(0, Number(form.capacity) || 0);
  const theme = THEMES[form.theme];
  const fee = Math.max(0, Number(form.entryFee) || 0);
  const type = EVENT_TYPES[form.type];
  const lead = Number(form.reminderLeadMinutes) || 0;
  const visiblePrizes = form.prizes.filter((p) => p.title.trim() && p.reward.trim());

  return (
    <div ref={wrapper} className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
        <Section title="The basics">
          <InputField
            id="name"
            label="Event name"
            placeholder="TechFest 2026 — Hackathon Kickoff"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name?.[0]}
            maxLength={80}
            autoFocus={!editing}
          />
          <FieldShell id="type" label="Kind of event">
            <div id="type" role="radiogroup" aria-label="Kind of event" className="flex flex-wrap gap-2">
              {EVENT_TYPE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={form.type === id}
                  onClick={() => pickType(id)}
                  className={`${chip(form.type === id)} text-sm`}
                >
                  <span aria-hidden>{EVENT_TYPES[id].emoji}</span> {EVENT_TYPES[id].label}
                </button>
              ))}
            </div>
          </FieldShell>
          <InputField
            id="venue"
            label="Venue"
            placeholder="Main Auditorium, Block A"
            value={form.venue}
            onChange={(e) => set("venue", e.target.value)}
            error={errors.venue?.[0]}
            maxLength={120}
          />
          <TextareaField
            id="description"
            label="Description"
            optional
            placeholder="What should participants know? Agenda, what to bring, eligibility…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            error={errors.description?.[0]}
            maxLength={600}
          />
        </Section>

        <Section title="When" subtitle="Attendees see the full time range on the event page and their ticket.">
          <div className="grid gap-6 sm:grid-cols-2">
            <InputField
              id="startsAt"
              type="datetime-local"
              label="Starts at"
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
              error={errors.startsAt?.[0]}
              hint={
                <span className="flex flex-wrap gap-1.5">
                  {QUICK_DATES.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => {
                        const start = q.get();
                        set("startsAt", toLocalInput(start));
                        if (!form.endsAt) set("endsAt", toLocalInput(new Date(start.getTime() + 2 * 3600_000)));
                      }}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-violet-soft/50 hover:text-white"
                    >
                      {q.label}
                    </button>
                  ))}
                </span>
              }
            />
            <InputField
              id="endsAt"
              type="datetime-local"
              label="Ends at"
              optional
              min={form.startsAt || undefined}
              value={form.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
              error={errors.endsAt?.[0]}
              hint={
                <span className="flex flex-wrap gap-1.5">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => setDuration(d.hours)}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-violet-soft/50 hover:text-white"
                    >
                      {d.label}
                    </button>
                  ))}
                </span>
              }
            />
          </div>
        </Section>

        <Section title="Tickets & prizes">
          <div className="grid gap-6 sm:grid-cols-2">
            <InputField
              id="capacity"
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              label="Participant capacity"
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              error={errors.capacity?.[0]}
              hint={
                <span className="flex flex-wrap items-center gap-1.5">
                  {CAPACITY_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set("capacity", String(n))}
                      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                        capacity === n
                          ? "border-cyan/60 bg-cyan/15 text-cyan"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:text-white"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </span>
              }
            />
            <InputField
              id="entryFee"
              type="number"
              inputMode="numeric"
              min={0}
              label="Entry fee (₹)"
              value={form.entryFee}
              onChange={(e) => set("entryFee", e.target.value)}
              error={errors.entryFee?.[0]}
              hint={fee > 0 ? `Shown as ${formatFee(fee)} — collected at the venue.` : "0 means the event is free."}
            />
          </div>

          <FieldShell id="prizes" label="Prizes & special awards" optional error={errors.prizes?.[0]}>
            <div id="prizes" className="space-y-2">
              {form.prizes.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.3fr_auto] gap-2">
                  <input
                    aria-label={`Prize ${i + 1} name`}
                    value={p.title}
                    maxLength={40}
                    placeholder="Best UI/UX"
                    onChange={(e) => updatePrize(i, { title: e.target.value })}
                    className="h-11 rounded-xl border border-white/10 bg-ink-900/70 px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-soft"
                  />
                  <input
                    aria-label={`Prize ${i + 1} reward`}
                    value={p.reward}
                    maxLength={80}
                    placeholder="₹10,000 + internship"
                    onChange={(e) => updatePrize(i, { reward: e.target.value })}
                    className="h-11 rounded-xl border border-white/10 bg-ink-900/70 px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-soft"
                  />
                  <button
                    type="button"
                    aria-label={`Remove prize ${i + 1}`}
                    onClick={() =>
                      set(
                        "prizes",
                        form.prizes.filter((_, j) => j !== i),
                      )
                    }
                    className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-zinc-400 transition-colors hover:border-danger/40 hover:text-danger"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={form.prizes.length >= 10}
                  onClick={() => set("prizes", [...form.prizes, { title: "", reward: "" }])}
                  className={chip(false)}
                >
                  + Add prize
                </button>
                {form.prizes.length === 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "prizes",
                        PRIZE_PRESETS.map((p) => ({ ...p })),
                      )
                    }
                    className={chip(false)}
                  >
                    🏆 Add 1st / 2nd / 3rd
                  </button>
                )}
              </div>
            </div>
          </FieldShell>
        </Section>

        <Section title="Cover image" subtitle="Shown on the event card, the registration page and your dashboard.">
          <ImageUpload
            label="Banner"
            shape="banner"
            value={coverUrl}
            endpoint={editing ? `/api/events/${initial!.id}/cover` : undefined}
            onFile={(file) => {
              setCover(file);
              setCoverPreview(file ? URL.createObjectURL(file) : null);
            }}
            onChange={(url) => {
              setCoverUrl(url);
              setCoverPreview(url);
            }}
          />
        </Section>

        <Section
          title="📞 Reminder call by Aanaya"
          subtitle="Aanaya, our voice agent, phones every registrant before the start — in Gujarati, Hindi or English."
        >
          <button
            type="button"
            role="switch"
            aria-checked={form.reminderEnabled}
            onClick={() => set("reminderEnabled", !form.reminderEnabled)}
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-white">Schedule automatic reminder calls</span>
              <span className="block text-xs text-zinc-500">
                You can also call people one by one from the event&apos;s call console.
              </span>
            </span>
            <span
              aria-hidden
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${form.reminderEnabled ? "bg-success/80" : "bg-white/10"}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.reminderEnabled ? "translate-x-6" : "translate-x-1"}`}
              />
            </span>
          </button>

          {form.reminderEnabled && (
            <div className="space-y-6">
              <FieldShell id="reminderLeadMinutes" label="Call them" error={errors.reminderLeadMinutes?.[0]}>
                <div className="flex flex-wrap items-center gap-2">
                  {REMINDER_LEAD_PRESETS.map((p) => (
                    <button
                      key={p.minutes}
                      type="button"
                      onClick={() => set("reminderLeadMinutes", String(p.minutes))}
                      className={chip(lead === p.minutes)}
                    >
                      {p.label}
                    </button>
                  ))}
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    or
                    <input
                      id="reminderLeadMinutes"
                      type="number"
                      min={5}
                      max={10080}
                      value={form.reminderLeadMinutes}
                      onChange={(e) => set("reminderLeadMinutes", e.target.value)}
                      aria-invalid={Boolean(errors.reminderLeadMinutes)}
                      className="h-9 w-20 rounded-lg border border-white/10 bg-ink-900/70 px-2 text-sm text-white outline-none focus:border-violet-soft"
                    />
                    min before the start
                  </label>
                </div>
              </FieldShell>
              <div className="grid gap-6 sm:grid-cols-2">
                <FieldShell id="reminderLanguage" label="Language">
                  <div id="reminderLanguage" role="radiogroup" className="flex flex-wrap gap-2">
                    {(["auto", ...CALL_LANGUAGE_IDS] as const).map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={form.reminderLanguage === id}
                        onClick={() => set("reminderLanguage", id)}
                        className={chip(form.reminderLanguage === id)}
                      >
                        {id === "auto" ? "Each attendee's choice" : CALL_LANGUAGES[id].native}
                      </button>
                    ))}
                  </div>
                </FieldShell>
                <InputField
                  id="reminderArriveEarly"
                  type="number"
                  min={0}
                  max={120}
                  label="Ask them to arrive early by (min)"
                  value={form.reminderArriveEarly}
                  onChange={(e) => set("reminderArriveEarly", e.target.value)}
                  error={errors.reminderArriveEarly?.[0]}
                />
              </div>
              <p
                className="rounded-xl border border-cyan/20 bg-cyan/[0.06] px-4 py-3 text-sm text-zinc-300"
                suppressHydrationWarning
              >
                Aanaya will call everyone with a mobile number{" "}
                <span className="font-semibold text-white">{lead > 0 ? formatLead(lead) : "—"} before the start</span>
                {form.startsAt && lead > 0 ? (
                  <> (at {formatDateTime(new Date(new Date(form.startsAt).getTime() - lead * 60_000))})</>
                ) : null}
                , one by one, in under 20 seconds each.
              </p>
            </div>
          )}
        </Section>

        <Section title="Theme">
          <div id="theme" role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-3">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => {
              const t = THEMES[id];
              const active = form.theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => set("theme", id)}
                  className={`relative h-11 w-11 rounded-2xl transition-transform duration-300 hover:scale-110 ${active ? "scale-110" : ""}`}
                  style={{ backgroundImage: `linear-gradient(135deg, ${t.from}, ${t.via}, ${t.to})` }}
                >
                  {active && (
                    <span className="absolute -inset-1.5 rounded-[1.1rem] border-2 border-white/80" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        {formError && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formError}
          </p>
        )}

        <div data-field data-intro className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <p className="text-xs text-zinc-500">
            {editing
              ? "Changes show up for attendees immediately."
              : "You can share the registration link right after creating."}
          </p>
          <Button type="submit" size="lg" loading={submitting}>
            {editing ? (submitting ? "Saving…" : "Save changes") : submitting ? "Creating…" : "Create event"}
          </Button>
        </div>
      </form>

      {/* Live preview */}
      <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Preview">
        <p className="mb-4 font-mono text-xs tracking-[0.3em] text-zinc-500 uppercase">Live preview</p>
        <div data-preview data-intro className="[perspective:1200px]">
          <TiltCard className="rounded-[2rem]" max={12}>
            <div
              style={themeVars(form.theme) as CSSProperties}
              className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-900 shadow-[0_40px_100px_-40px_rgb(var(--t-glow)/0.8)]"
            >
              {coverPreview ? (
                <div className="relative h-36 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                  <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent to-ink-900" />
                </div>
              ) : (
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-40 bg-theme [mask-image:linear-gradient(#000,transparent)] opacity-90"
                />
              )}
              <div aria-hidden className="holo absolute inset-0 animate-[holo-shift_6s_linear_infinite] opacity-40" />
              <div className={`relative [transform:translateZ(40px)] px-7 ${coverPreview ? "pt-2" : "pt-7"}`}>
                <p
                  className={`text-xs font-semibold tracking-[0.25em] uppercase ${coverPreview ? "text-zinc-300" : "text-ink-950/80"}`}
                >
                  {type.emoji} {type.label} · {fee > 0 ? formatFee(fee) : "Free entry"}
                </p>
                <h3
                  className={`${coverPreview ? "mt-4" : "mt-10"} min-h-[3.5rem] font-display text-2xl leading-tight font-bold text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.4)]`}
                >
                  {form.name || "Your event name"}
                </h3>
                <p className="mt-3 text-sm text-zinc-300" suppressHydrationWarning>
                  {form.startsAt ? formatDateTime(new Date(form.startsAt)) : "Pick a date & time"}
                  {form.startsAt && form.endsAt
                    ? ` – ${formatEndTime(new Date(form.startsAt), new Date(form.endsAt))}`
                    : ""}
                </p>
                <p className="text-sm text-zinc-400">{form.venue || "Venue"}</p>
                {visiblePrizes.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {visiblePrizes.slice(0, 3).map((p, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-xl border border-warn/20 bg-warn/[0.07] px-3 py-1.5 text-xs"
                      >
                        <span className="truncate text-zinc-200">{p.title}</span>
                        <span className="shrink-0 font-semibold text-warn">{p.reward}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="relative mx-7 mt-6 mb-7 flex [transform:translateZ(25px)] items-center justify-between gap-4 border-t border-dashed border-white/15 pt-6">
                <div>
                  <p className="text-xs tracking-widest text-zinc-500 uppercase">Capacity</p>
                  <p className="font-display text-3xl font-bold text-white">{capacity.toLocaleString("en-US")}</p>
                  <p className="text-xs text-zinc-500">
                    {form.reminderEnabled && lead > 0
                      ? `📞 Reminder ${formatLead(lead)} before`
                      : "seats · 0 registered"}
                  </p>
                </div>
                <ProgressRing value={0.02} size={84} stroke={8} from={theme.from} to={theme.via}>
                  <span className="font-mono text-xs text-zinc-400">0%</span>
                </ProgressRing>
              </div>
            </div>
          </TiltCard>
        </div>
        <p className="mt-4 text-center text-xs text-zinc-500">Tilt me ✦ this is how your event card will glow.</p>
      </aside>
    </div>
  );
}
