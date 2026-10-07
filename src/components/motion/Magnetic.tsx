"use client";

import { createAnimatable } from "animejs";
import { useEffect, useRef, type ReactNode } from "react";
import { prefersReducedMotion } from "./useAnimeScope";

/** Pulls its child toward the cursor with an elastic spring. */
export function Magnetic({
  children,
  strength = 0.35,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || window.matchMedia("(pointer: coarse)").matches) return;
    const animatable = createAnimatable(el, { x: 600, y: 600, ease: "out(3)" });

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      animatable.x((e.clientX - (rect.left + rect.width / 2)) * strength);
      animatable.y((e.clientY - (rect.top + rect.height / 2)) * strength);
    };
    const onLeave = () => {
      animatable.x(0, 900, "outElastic(1, .4)");
      animatable.y(0, 900, "outElastic(1, .4)");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      animatable.revert();
    };
  }, [strength]);

  return (
    <span ref={ref} className={`inline-block will-change-transform ${className ?? ""}`}>
      {children}
    </span>
  );
}
