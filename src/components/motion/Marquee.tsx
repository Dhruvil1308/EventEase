"use client";

import { animate, createTimer, utils } from "animejs";
import type { ReactNode } from "react";
import { useAnimeScope } from "./useAnimeScope";

/**
 * Infinite ticker that reacts to how fast you scroll: a quick flick makes it
 * race and lean into the scroll direction, and it eases back to its cruising
 * speed when you stop.
 */
export function Marquee({
  children,
  speed = 28000,
  reverse = false,
  className = "py-4",
}: {
  children: ReactNode;
  speed?: number;
  reverse?: boolean;
  className?: string;
}) {
  const ref = useAnimeScope<HTMLDivElement>(({ root, reduced }) => {
    if (reduced) return;
    const track = root.querySelector<HTMLElement>("[data-track]");
    const lean = root.querySelector<HTMLElement>("[data-lean]");
    if (!track || !lean) return;

    const run = animate(track, {
      x: reverse ? ["-50%", "0%"] : ["0%", "-50%"],
      duration: speed,
      ease: "linear",
      loop: true,
    });

    let lastY = window.scrollY;
    let velocity = 0;
    createTimer({
      onUpdate: () => {
        const y = window.scrollY;
        // Smoothed pixels-per-frame; decays to 0 once scrolling stops.
        velocity += (y - lastY - velocity) * 0.18;
        lastY = y;
        run.speed = 1 + Math.min(Math.abs(velocity) / 6, 5);
        utils.set(lean, { skewX: utils.clamp(-velocity * 0.45, -14, 14) * (reverse ? -1 : 1) });
      },
    });
  });

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)] ${className}`}
    >
      <div data-lean className="will-change-transform">
        <div data-track className="flex w-max gap-10 will-change-transform">
          <div className="flex shrink-0 items-center gap-10">{children}</div>
          <div aria-hidden className="flex shrink-0 items-center gap-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
