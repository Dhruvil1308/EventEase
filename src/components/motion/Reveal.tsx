"use client";

import { animate, onScroll, stagger, utils } from "animejs";
import { createElement, type ReactNode } from "react";
import { useAnimeScope, type MotionTag } from "./useAnimeScope";

export type RevealVariant = "up" | "down" | "left" | "right" | "scale" | "blur" | "flip";

const FROM: Record<RevealVariant, Record<string, [number | string, number | string]>> = {
  up: { y: [56, 0] },
  down: { y: [-56, 0] },
  left: { x: [-72, 0] },
  right: { x: [72, 0] },
  scale: { scale: [0.82, 1], y: [24, 0] },
  blur: { filter: ["blur(16px)", "blur(0px)"], y: [24, 0] },
  flip: { rotateX: [-75, 0], y: [40, 0] },
};

type RevealProps = {
  as?: MotionTag;
  variant?: RevealVariant;
  /** Stagger direct children by this many ms instead of revealing the wrapper as one block. */
  stagger?: number;
  delay?: number;
  duration?: number;
  /**
   * `true` (default): plays when scrolled into view and reverses when it scrolls
   * back out, so the motion works both scrolling down and scrolling up.
   * `false`: plays once.
   */
  replay?: boolean;
  className?: string;
  id?: string;
  children: ReactNode;
};

export function Reveal({
  as = "div",
  variant = "up",
  stagger: each,
  delay = 0,
  duration = 1100,
  replay = true,
  className,
  id,
  children,
}: RevealProps) {
  const ref = useAnimeScope<HTMLElement>(({ root, reduced }) => {
    const targets = each ? Array.from(root.children) : root;
    if (reduced) {
      utils.set(targets, { opacity: 1 });
      return;
    }
    animate(targets, {
      opacity: [0, 1],
      ...FROM[variant],
      duration,
      delay: each ? stagger(each, { start: delay }) : delay,
      ease: "out(4)",
      autoplay: onScroll({
        target: root,
        enter: "92% top",
        leave: "top bottom",
        sync: replay ? "play reverse" : "play",
        repeat: replay,
      }),
    });
  });

  return createElement(as, { ref, id, className, "data-reveal": each ? "group" : "self" }, children);
}
