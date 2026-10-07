"use client";

import { animate, onScroll } from "animejs";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/components/motion/useAnimeScope";

type ProgressRingProps = {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  from?: string;
  to?: string;
  track?: string;
  children?: ReactNode;
  /** Animate when scrolled into view instead of immediately. */
  onView?: boolean;
  label?: string;
};

/**
 * Animated SVG ring. Re-animates smoothly from the previous value whenever
 * `value` changes, so live counters feel alive.
 */
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  from = "#7c5cff",
  to = "#22d3ee",
  track = "rgba(255,255,255,0.07)",
  children,
  onView = false,
  label,
}: ProgressRingProps) {
  const id = useId().replace(/:/g, "");
  const circle = useRef<SVGCircleElement>(null);
  const last = useRef(0);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));

  // Rings start empty and fill in; anime.js owns the offset after mount.
  const [initialOffset] = useState(circumference);

  useEffect(() => {
    const el = circle.current;
    if (!el) return;
    const target = circumference * (1 - clamped);
    if (prefersReducedMotion()) {
      el.setAttribute("stroke-dashoffset", String(target));
      last.current = clamped;
      return;
    }
    const observer = onView
      ? onScroll({ target: el.ownerSVGElement ?? el, enter: "95% top", leave: "top bottom", sync: "play reverse" })
      : null;
    const anim = animate(el, {
      strokeDashoffset: [circumference * (1 - last.current), target],
      duration: 1400,
      ease: "out(4)",
      autoplay: observer ?? true,
    });
    last.current = clamped;
    return () => {
      observer?.revert();
      anim.pause();
    };
  }, [clamped, circumference, onView]);

  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          ref={circle}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={initialOffset}
          style={{ filter: `drop-shadow(0 0 6px ${to}88)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
