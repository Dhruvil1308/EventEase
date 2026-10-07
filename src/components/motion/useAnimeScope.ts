"use client";

import { createScope, type Scope } from "animejs";
import { useEffect, useRef, useSyncExternalStore, type DependencyList } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Runs anime.js code inside a scope bound to a React ref. Everything created in
 * `setup` (animations, scroll observers, timelines…) is reverted automatically
 * on unmount, and `reduced` reflects the user's reduced-motion preference.
 */
export function useAnimeScope<T extends HTMLElement = HTMLDivElement>(
  setup: (ctx: { root: T; scope: Scope; reduced: boolean }) => void | (() => void),
  deps: DependencyList = [],
) {
  const ref = useRef<T>(null);
  const setupRef = useRef(setup);

  useEffect(() => {
    setupRef.current = setup;
  });

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const scope = createScope({ root: ref, mediaQueries: { reduced: REDUCED_MOTION_QUERY } }).add((self) => {
      const s = self as Scope;
      return setupRef.current({ root, scope: s, reduced: Boolean(s.matches.reduced) });
    });
    return () => {
      scope.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** Reactive `prefers-reduced-motion` flag (false during SSR). */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
}

/** Intrinsic tags these wrappers can render as. */
export type MotionTag = "div" | "p" | "span" | "ul" | "ol" | "li" | "section" | "header" | "h1" | "h2" | "h3";
