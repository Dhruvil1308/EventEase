"use client";

import { createTimeline, stagger, svg } from "animejs";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/components/motion/useAnimeScope";
import { formatRelative, formatTime } from "@/lib/format";
import type { CheckInResult } from "@/lib/services/checkin";
import { RESULT_META } from "./resultMeta";

export type GateResult = CheckInResult & { at: number };

/** Big, colour-coded verdict. Re-animates on every new scan (keyed by `at`). */
export function ResultCard({ result, busy }: { result: GateResult | null; busy: boolean }) {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = card.current;
    if (!el || !result || prefersReducedMotion()) return;
    const icon = el.querySelector<SVGPathElement>("[data-icon-path]");
    const tl = createTimeline({ defaults: { ease: "out(4)" } });
    tl.add(el, { opacity: [0, 1], scale: [0.85, 1], y: [24, 0], duration: 550, ease: "outBack(1.7)" });
    if (result.status !== "SUCCESS") {
      tl.add(el, { x: [0, -16, 14, -10, 7, -3, 0], duration: 520, ease: "inOut(2)" }, "-=250");
    }
    if (icon) {
      tl.add(svg.createDrawable(icon), { draw: ["0 0", "0 1"], duration: 650, ease: "inOut(3)" }, 120);
    }
    tl.add(
      el.querySelectorAll("[data-line]"),
      { opacity: [0, 1], x: [-14, 0], duration: 500, delay: stagger(60) },
      250,
    );
    return () => {
      tl.pause();
    };
  }, [result]);

  if (!result) {
    return (
      <div className="rounded-3xl p-6 text-center glass">
        <p className="font-display text-xl font-semibold text-white">{busy ? "Verifying…" : "Ready to scan"}</p>
        <p className="mt-2 text-sm text-zinc-400">
          Scan a QR ticket or type an entry code. The verdict appears here instantly.
        </p>
      </div>
    );
  }

  const meta = RESULT_META[result.status];
  const hasPerson = result.status !== "INVALID";

  return (
    <div
      key={result.at}
      ref={card}
      role="status"
      aria-live="assertive"
      className={`relative overflow-hidden rounded-3xl border-2 ${meta.border} bg-ink-900/90 p-6 backdrop-blur-xl`}
      style={{ boxShadow: `0 30px 90px -30px ${meta.color}` }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{ background: `radial-gradient(circle at 15% 0%, ${meta.color}, transparent 60%)` }}
      />
      <div className="relative flex items-start gap-4">
        <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${meta.bg} ${meta.text}`}>
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path data-icon-path d={meta.icon} />
          </svg>
        </span>
        <div className="min-w-0">
          <p className={`font-display text-2xl font-bold ${meta.text}`}>{meta.label}</p>
          <p className="mt-1 text-sm text-zinc-300">{result.message}</p>
        </div>
      </div>

      <div className="relative mt-5 space-y-2 border-t border-white/10 pt-5 text-sm">
        {hasPerson && (
          <p data-line className="font-display text-xl font-semibold text-white">
            {result.participant.name}
          </p>
        )}
        {hasPerson && (
          <p data-line className="text-zinc-400">
            {result.event.name}
            {result.participant.studentId ? ` · ${result.participant.studentId}` : ""}
            {result.participant.department ? ` · ${result.participant.department}` : ""}
          </p>
        )}
        {result.status === "SUCCESS" && (
          <p data-line className="text-success" suppressHydrationWarning>
            Checked in at {formatTime(result.checkedInAt)}
          </p>
        )}
        {result.status === "DUPLICATE" && (
          <p data-line className="text-danger" suppressHydrationWarning>
            First used at {formatTime(result.checkedInAt)} ({formatRelative(result.checkedInAt, result.at)})
          </p>
        )}
        <p data-line className="font-mono text-xs text-zinc-500">
          {result.code}
        </p>
      </div>
    </div>
  );
}
