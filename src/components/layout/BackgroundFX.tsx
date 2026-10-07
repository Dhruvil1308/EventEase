"use client";

import { animate, utils } from "animejs";
import { useAnimeScope } from "@/components/motion/useAnimeScope";

const ORBS = [
  { className: "left-[-10%] top-[-15%] h-[60vmax] w-[60vmax]", color: "124 92 255", alpha: 0.32 },
  { className: "right-[-15%] top-[20%] h-[50vmax] w-[50vmax]", color: "34 211 238", alpha: 0.2 },
  { className: "left-[20%] bottom-[-25%] h-[55vmax] w-[55vmax]", color: "244 114 182", alpha: 0.16 },
];

/**
 * Ambient page background: a faint grid plus slowly drifting colour orbs
 * (radial gradients rather than CSS blur — much cheaper to composite).
 */
export function BackgroundFX() {
  const ref = useAnimeScope<HTMLDivElement>(({ root, reduced }) => {
    if (reduced) return;
    root.querySelectorAll<HTMLElement>("[data-orb]").forEach((orb, i) => {
      animate(orb, {
        x: () => `${utils.random(-12, 12)}vw`,
        y: () => `${utils.random(-10, 10)}vh`,
        scale: () => utils.random(0.85, 1.2, 2),
        duration: () => utils.random(14000, 22000),
        delay: i * 600,
        ease: "inOutSine",
        loop: true,
        alternate: true,
      });
    });
  });

  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {ORBS.map((orb, i) => (
        <div
          key={i}
          data-orb
          className={`absolute rounded-full will-change-transform ${orb.className}`}
          style={{
            background: `radial-gradient(circle at center, rgb(${orb.color} / ${orb.alpha}), rgb(${orb.color} / 0) 65%)`,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_50%_0%,#000_10%,transparent_70%)]" />
    </div>
  );
}
