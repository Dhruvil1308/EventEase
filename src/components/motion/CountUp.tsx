"use client";

import { animate, onScroll } from "animejs";
import { useEffect, useRef } from "react";
import { prefersReducedMotion, useAnimeScope } from "./useAnimeScope";

const fmt = new Intl.NumberFormat("en-US");

function render(el: HTMLElement, value: number, decimals: number, suffix: string) {
  el.textContent = (decimals ? value.toFixed(decimals) : fmt.format(Math.round(value))) + suffix;
}

/** Counts from 0 to `value` when scrolled into view, and back down when scrolled away. */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  duration = 1800,
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useAnimeScope<HTMLSpanElement>(
    ({ root, reduced }) => {
      if (reduced) {
        render(root, value, decimals, suffix);
        return;
      }
      const counter = { v: 0 };
      render(root, 0, decimals, suffix);
      animate(counter, {
        v: value,
        duration,
        ease: "out(3)",
        onUpdate: () => render(root, counter.v, decimals, suffix),
        autoplay: onScroll({ target: root, enter: "95% top", leave: "top bottom", sync: "play reverse" }),
      });
    },
    [value, decimals, suffix],
  );

  return (
    <span ref={ref} className={className}>
      {decimals ? value.toFixed(decimals) : fmt.format(value)}
      {suffix}
    </span>
  );
}

/**
 * Animates smoothly from the previous value to the new one whenever `value`
 * changes — used for live dashboard counters.
 */
export function AnimatedNumber({
  value,
  from,
  decimals = 0,
  suffix = "",
  className,
}: {
  value: number;
  /** Start value for the first animation (defaults to `value`, i.e. no intro). */
  from?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef({ v: from ?? value });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      current.current.v = value;
      render(el, value, decimals, suffix);
      return;
    }
    const anim = animate(current.current, {
      v: value,
      duration: 900,
      ease: "out(4)",
      onUpdate: () => render(el, current.current.v, decimals, suffix),
    });
    return () => {
      anim.pause();
    };
  }, [value, decimals, suffix]);

  const initial = from ?? value;
  return (
    <span ref={ref} className={className}>
      {decimals ? initial.toFixed(decimals) : fmt.format(initial)}
      {suffix}
    </span>
  );
}
