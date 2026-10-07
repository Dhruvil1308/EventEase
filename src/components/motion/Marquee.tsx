"use client";

import { animate, onScroll } from "animejs";
import type { ReactNode } from "react";
import { useAnimeScope } from "./useAnimeScope";

/**
 * Infinite ticker. The scroll position adds a skew + offset so the strip
 * "leans" into the direction you're scrolling (down → left, up → right).
 */
export function Marquee({
  children,
  speed = 28000,
  reverse = false,
}: {
  children: ReactNode;
  speed?: number;
  reverse?: boolean;
}) {
  const ref = useAnimeScope<HTMLDivElement>(({ root, reduced }) => {
    if (reduced) return;
    const track = root.querySelector<HTMLElement>("[data-track]");
    const lean = root.querySelector<HTMLElement>("[data-lean]");
    if (!track || !lean) return;
    animate(track, {
      x: reverse ? ["-50%", "0%"] : ["0%", "-50%"],
      duration: speed,
      ease: "linear",
      loop: true,
    });
    animate(lean, {
      x: reverse ? ["-6%", "6%"] : ["6%", "-6%"],
      skewX: [reverse ? -4 : 4, reverse ? 4 : -4],
      ease: "linear",
      autoplay: onScroll({ target: root, enter: "bottom top", leave: "top bottom", sync: 0.15 }),
    });
  });

  return (
    <div
      ref={ref}
      className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)] py-4"
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
