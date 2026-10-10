"use client";

import { createTimeline, onScroll, utils } from "animejs";
import { createElement, type ReactNode } from "react";
import { useAnimeScope, type MotionTag } from "./useAnimeScope";

export type FxMove = "rise" | "drop" | "left" | "right" | "zoom" | "tilt" | "swing" | "flip" | "spin" | "blur" | "none";

type Pose = Record<string, number | string>;

/** At rest: where every element ends up while it's on screen. */
const REST: Pose = { x: 0, y: 0, rotate: 0, rotateX: 0, rotateY: 0, scale: 1, opacity: 1, filter: "blur(0px)" };

/** Where an element comes from as it scrolls in. */
const IN: Record<Exclude<FxMove, "none">, Pose> = {
  rise: { y: 140, opacity: 0 },
  drop: { y: -110, opacity: 0 },
  left: { x: -180, rotate: -7, opacity: 0 },
  right: { x: 180, rotate: 7, opacity: 0 },
  zoom: { scale: 0.55, opacity: 0 },
  tilt: { rotateX: 62, y: 90, opacity: 0 },
  swing: { rotateY: -62, x: -70, opacity: 0 },
  flip: { rotateY: 90, scale: 0.9, opacity: 0 },
  spin: { rotate: -20, scale: 0.7, y: 70, opacity: 0 },
  blur: { filter: "blur(20px)", y: 50, scale: 1.06, opacity: 0 },
};

/** Where it drifts to as it scrolls out of the top — the motion keeps going. */
const OUT: Record<Exclude<FxMove, "none">, Pose> = {
  rise: { y: -90, opacity: 0 },
  drop: { y: 70, opacity: 0 },
  left: { x: 120, rotate: 4, opacity: 0 },
  right: { x: -120, rotate: -4, opacity: 0 },
  zoom: { scale: 1.12, opacity: 0 },
  tilt: { rotateX: -48, y: -60, opacity: 0 },
  swing: { rotateY: 48, x: 50, opacity: 0 },
  flip: { rotateY: -70, opacity: 0 },
  spin: { rotate: 14, scale: 0.85, y: -50, opacity: 0 },
  blur: { filter: "blur(14px)", y: -40, opacity: 0 },
};

const IS_3D = new Set<FxMove>(["tilt", "swing", "flip"]);

/**
 * Tween params between a pose and rest — only for the properties that pose
 * changes, so e.g. a slide never pays for an unused blur filter.
 */
const fromPose = (pose: Pose) => Object.fromEntries(Object.entries(pose).map(([k, v]) => [k, [v, REST[k]]]));
const toPose = (pose: Pose) => Object.fromEntries(Object.entries(pose).map(([k, v]) => [k, [REST[k], v]]));

type ScrollFXProps = {
  as?: MotionTag;
  /** How it comes in. */
  move?: FxMove;
  /** How it leaves at the top; defaults to continuing `move`. `"none"` keeps it in place. */
  out?: FxMove;
  /** Animate each direct child on its own instead of the wrapper. */
  group?: boolean;
  /** With `group`: cycle through these moves, so neighbours enter differently. */
  moves?: FxMove[];
  /** With `group`: offset children in the same row so they cascade (in % of the in-phase). */
  cascade?: number;
  /** Children per row, for `cascade`. */
  columns?: number;
  /** Smoothing of the scroll scrub: higher is snappier. */
  smooth?: number;
  className?: string;
  id?: string;
  children: ReactNode;
};

/**
 * Scroll-scrubbed entrances and exits, in the style of animejs.com: an element
 * travels in from its `move` as it rises into view, rests while it's on screen,
 * and drifts away as it leaves the top. It's tied to the scroll position, so
 * scrolling back up plays every step in reverse.
 */
export function ScrollFX({
  as = "div",
  move = "rise",
  out,
  group = false,
  moves,
  cascade = 6,
  columns = 4,
  smooth = 0.14,
  className,
  id,
  children,
}: ScrollFXProps) {
  const ref = useAnimeScope<HTMLElement>(({ root, reduced }) => {
    if (reduced) return;
    const targets = group ? (Array.from(root.children) as HTMLElement[]) : [root];

    targets.forEach((el, i) => {
      const m = moves?.length ? moves[i % moves.length] : move;
      const o = out ?? m;
      if (IS_3D.has(m) || IS_3D.has(o)) utils.set(el, { perspective: 1200 });
      const shift = group ? (i % columns) * cascade : 0;

      const tl = createTimeline({
        defaults: { ease: "linear" },
        autoplay: onScroll({ target: el, enter: "end start", leave: "start end", sync: smooth }),
      });
      if (m !== "none") tl.add(el, { ...fromPose(IN[m]), duration: 30, ease: "out(3)" }, shift);
      if (o !== "none") tl.add(el, { ...toPose(OUT[o]), duration: 26, ease: "in(2)" }, 74);
      // Keep the timeline 100 units long, so the phases line up with the scroll.
      tl.add({ duration: 1 }, 99);
    });
  });

  return createElement(as, { ref, id, className }, children);
}
