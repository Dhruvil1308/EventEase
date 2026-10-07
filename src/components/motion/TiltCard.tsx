"use client";

import { createAnimatable } from "animejs";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "./useAnimeScope";

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Maximum rotation in degrees */
  max?: number;
  /** Render a moving glare highlight */
  glare?: boolean;
};

/**
 * Perspective tilt that follows the pointer (anime.js animatable for the
 * spring), plus a spotlight driven by CSS variables `--mx` / `--my`.
 */
export function TiltCard({ children, className, style, max = 10, glare = true }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const card = inner.current;
    if (!el || !card) return;
    const reduced = prefersReducedMotion();
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const animatable =
      reduced || coarse ? null : createAnimatable(card, { rotateX: 500, rotateY: 500, ease: "out(3)" });

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.style.setProperty("--mx", `${px * 100}%`);
      card.style.setProperty("--my", `${py * 100}%`);
      animatable?.rotateY((px - 0.5) * max * 2);
      animatable?.rotateX((0.5 - py) * max * 2);
    };
    const onLeave = () => {
      animatable?.rotateX(0, 1000, "outElastic(1, .5)");
      animatable?.rotateY(0, 1000, "outElastic(1, .5)");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      animatable?.revert();
    };
  }, [max]);

  return (
    <div ref={ref} className="h-full [perspective:1100px]" style={style}>
      <div
        ref={inner}
        className={`group/tilt relative will-change-transform [transform-style:preserve-3d] ${className ?? ""}`}
      >
        {children}
        {glare && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] spotlight opacity-0 transition-opacity duration-500 group-hover/tilt:opacity-100"
          />
        )}
      </div>
    </div>
  );
}
