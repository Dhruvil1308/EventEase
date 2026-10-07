"use client";

import { animate, stagger, utils } from "animejs";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useAnimeScope } from "@/components/motion/useAnimeScope";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import { fieldErrors, registerSchema, type FieldErrors } from "@/lib/validation";

type Props = { eventId: string; seatsLeft: number; closed: boolean; closedReason?: string };

export function RegisterForm({ eventId, seatsLeft, closed, closedReason }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const burstRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState({ name: "", email: "", studentId: "", department: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "submitting" | "done" | "full">(closed ? "full" : "idle");
  const shouldReset = useRef(false);

  // Seats can run out while this page is kept alive in the background.
  const [seenClosed, setSeenClosed] = useState(closed);
  if (closed !== seenClosed) {
    setSeenClosed(closed);
    setState(closed ? "full" : "idle");
  }

  // After a successful registration we navigate to the ticket. Next.js keeps this
  // page alive, so clear the form when it is hidden — the next visit starts fresh.
  useLayoutEffect(() => {
    return () => {
      if (!shouldReset.current) return;
      shouldReset.current = false;
      setValues({ name: "", email: "", studentId: "", department: "" });
      setErrors({});
      setFormError(null);
      setState("idle");
    };
  }, []);

  const root = useAnimeScope<HTMLDivElement>(({ root, reduced }) => {
    if (reduced) return;
    animate(root.querySelectorAll("[data-field]"), {
      opacity: [0, 1],
      x: [30, 0],
      delay: stagger(80, { start: 200 }),
      duration: 800,
      ease: "out(4)",
    });
  });

  const update = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function shake() {
    const invalid = formRef.current?.querySelectorAll('[aria-invalid="true"]');
    if (invalid?.length) {
      animate(invalid, { x: [0, -10, 9, -6, 4, 0], duration: 500, ease: "inOut(2)" });
      (invalid[0] as HTMLElement).focus();
    }
  }

  function celebrate() {
    const host = burstRef.current;
    if (!host) return;
    const colors = ["#7c5cff", "#22d3ee", "#f472b6", "#34d399", "#fbbf24"];
    const bits = Array.from({ length: 36 }, (_, i) => {
      const el = document.createElement("span");
      el.className = "absolute left-1/2 top-1/2 h-2 w-2 rounded-[2px]";
      el.style.background = colors[i % colors.length];
      host.appendChild(el);
      return el;
    });
    animate(bits, {
      x: () => utils.random(-260, 260),
      y: () => utils.random(-220, 120),
      rotate: () => utils.random(-540, 540),
      scale: [
        { to: () => utils.random(0.8, 1.8, 2), duration: 300 },
        { to: 0, duration: 700 },
      ],
      opacity: [1, 0],
      duration: 1100,
      delay: stagger(8),
      ease: "out(3)",
      onComplete: () => bits.forEach((b) => b.remove()),
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      requestAnimationFrame(shake);
      return;
    }
    setState("submitting");
    try {
      const res = await fetch(`/api/events/${eventId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.code === "EVENT_FULL") {
          setState("full");
          return;
        }
        setErrors(data.error?.fields ?? {});
        setFormError(data.error?.fields ? null : (data.error?.message ?? "Registration failed."));
        setState("idle");
        requestAnimationFrame(shake);
        return;
      }
      setState("done");
      shouldReset.current = true;
      celebrate();
      setTimeout(() => router.push(`${data.ticketUrl}?new=1`), 900);
    } catch {
      setFormError("Network error — check your connection and try again.");
      setState("idle");
    }
  }

  if (state === "full") {
    return (
      <div className="rounded-3xl p-8 text-center glass">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-danger/15 text-3xl">🎟️</div>
        <h2 className="mt-5 font-display text-2xl font-semibold text-white">Registration closed</h2>
        <p className="mt-2 text-zinc-400">
          {closedReason ?? "Every seat has been taken. Keep an eye out for the next one!"}
        </p>
      </div>
    );
  }

  return (
    <div ref={root} className="relative">
      <div ref={burstRef} aria-hidden className="pointer-events-none absolute inset-0 z-20" />
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5 rounded-3xl p-6 glass sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-white">Your details</h2>
          <span className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 font-mono text-xs text-cyan">
            {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} left
          </span>
        </div>
        <div data-field data-intro>
          <InputField
            id="name"
            label="Full name"
            autoComplete="name"
            placeholder="Aisha Khan"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            error={errors.name?.[0]}
            autoFocus
          />
        </div>
        <div data-field data-intro>
          <InputField
            id="email"
            type="email"
            label="College email"
            autoComplete="email"
            placeholder="aisha.khan@campus.edu"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            error={errors.email?.[0]}
            hint="One registration per email for each event."
          />
        </div>
        <div data-field data-intro className="grid gap-5 sm:grid-cols-2">
          <InputField
            id="studentId"
            label="Student ID"
            optional
            placeholder="21CS1042"
            value={values.studentId}
            onChange={(e) => update("studentId", e.target.value)}
            error={errors.studentId?.[0]}
          />
          <InputField
            id="department"
            label="Department"
            optional
            placeholder="Computer Science"
            value={values.department}
            onChange={(e) => update("department", e.target.value)}
            error={errors.department?.[0]}
          />
        </div>

        {formError && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formError}
          </p>
        )}

        <div data-field data-intro>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={state === "submitting"}
            disabled={state === "done"}
          >
            {state === "done"
              ? "✓ You're in! Opening your ticket…"
              : state === "submitting"
                ? "Registering…"
                : "Register & get my QR ticket"}
          </Button>
          <p className="mt-3 text-center text-xs text-zinc-500">Your unique entry code works once at the gate.</p>
        </div>
      </form>
    </div>
  );
}
