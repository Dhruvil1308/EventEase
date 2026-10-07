"use client";

import { animate, stagger } from "animejs";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { TiltCard } from "@/components/motion/TiltCard";
import { useAnimeScope } from "@/components/motion/useAnimeScope";
import { Button } from "@/components/ui/Button";
import { FieldShell, InputField, TextareaField } from "@/components/ui/Field";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { formatDateTime } from "@/lib/format";
import { THEMES, themeVars, type ThemeId } from "@/lib/themes";
import { createEventSchema, fieldErrors, type FieldErrors } from "@/lib/validation";

const CAPACITY_PRESETS = [30, 60, 120, 250, 500];

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
  capacity: string;
  theme: ThemeId;
};

export function CreateEventForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    venue: "",
    startsAt: "",
    capacity: "100",
    theme: "aurora",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
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
    };
    const parsed = createEventSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      requestAnimationFrame(shakeInvalid);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.error?.fields ?? {});
        setFormError(data.error?.message ?? "Couldn't create the event.");
        requestAnimationFrame(shakeInvalid);
        setSubmitting(false);
        return;
      }
      router.push(`/events/${data.event.id}?created=1`);
    } catch {
      setFormError("Network error — check your connection and try again.");
      setSubmitting(false);
    }
  }

  const capacity = Math.max(0, Number(form.capacity) || 0);
  const theme = THEMES[form.theme];

  return (
    <div ref={wrapper} className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6 rounded-3xl p-6 glass sm:p-8">
        <div data-field data-intro>
          <InputField
            id="name"
            label="Event name"
            placeholder="TechFest 2026 — Hackathon Kickoff"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name?.[0]}
            maxLength={80}
            autoFocus
          />
        </div>

        <div data-field data-intro className="grid gap-6 sm:grid-cols-2">
          <InputField
            id="venue"
            label="Venue"
            placeholder="Main Auditorium, Block A"
            value={form.venue}
            onChange={(e) => set("venue", e.target.value)}
            error={errors.venue?.[0]}
            maxLength={120}
          />
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
                    onClick={() => set("startsAt", toLocalInput(q.get()))}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-violet-soft/50 hover:text-white"
                  >
                    {q.label}
                  </button>
                ))}
              </span>
            }
          />
        </div>

        <div data-field data-intro>
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
                <span className="mr-1">Registration closes automatically when full.</span>
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
        </div>

        <div data-field data-intro>
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
        </div>

        <div data-field data-intro>
          <FieldShell id="theme" label="Theme">
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
          </FieldShell>
        </div>

        {formError && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formError}
          </p>
        )}

        <div data-field data-intro className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <p className="text-xs text-zinc-500">You can share the registration link right after creating.</p>
          <Button type="submit" size="lg" loading={submitting}>
            {submitting ? "Creating…" : "Create event"}
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
              className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-900 p-7 shadow-[0_40px_100px_-40px_rgb(var(--t-glow)/0.8)]"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-40 bg-theme [mask-image:linear-gradient(#000,transparent)] opacity-90"
              />
              <div aria-hidden className="holo absolute inset-0 animate-[holo-shift_6s_linear_infinite] opacity-40" />
              <div className="relative [transform:translateZ(40px)]">
                <p className="text-xs font-semibold tracking-[0.25em] text-ink-950/80 uppercase">
                  {theme.label} · Admit one
                </p>
                <h3 className="mt-10 min-h-[3.5rem] font-display text-2xl leading-tight font-bold text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.4)]">
                  {form.name || "Your event name"}
                </h3>
                <p className="mt-3 text-sm text-zinc-300" suppressHydrationWarning>
                  {form.startsAt ? formatDateTime(new Date(form.startsAt)) : "Pick a date & time"}
                </p>
                <p className="text-sm text-zinc-400">{form.venue || "Venue"}</p>
              </div>
              <div className="relative mt-8 flex [transform:translateZ(25px)] items-center justify-between gap-4 border-t border-dashed border-white/15 pt-6">
                <div>
                  <p className="text-xs tracking-widest text-zinc-500 uppercase">Capacity</p>
                  <p className="font-display text-3xl font-bold text-white">{capacity.toLocaleString("en-US")}</p>
                  <p className="text-xs text-zinc-500">seats · 0 registered</p>
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
