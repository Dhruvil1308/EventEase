"use client";

import { animate, onScroll, stagger } from "animejs";
import { useAnimeScope } from "@/components/motion/useAnimeScope";
import type { EventSummary } from "@/lib/services/events";
import { EventCard, type CardViewer } from "./EventCard";

/**
 * Cards rise in with a staggered 3D flip as the grid scrolls into view and
 * fold back when it scrolls out (both directions), capacity bars fill after.
 */
export function EventGrid({ events, now, viewer }: { events: EventSummary[]; now: number; viewer?: CardViewer }) {
  const ref = useAnimeScope<HTMLDivElement>(
    ({ root, reduced }) => {
      const cards = root.querySelectorAll<HTMLElement>("[data-card]");
      if (reduced) return;
      animate(cards, {
        opacity: [0, 1],
        y: [70, 0],
        rotateX: [-25, 0],
        scale: [0.94, 1],
        duration: 1100,
        delay: stagger(110, { grid: [3, Math.ceil(cards.length / 3)], from: "first" }),
        ease: "out(4)",
        autoplay: onScroll({ target: root, enter: "92% top", leave: "top bottom", sync: "play reverse" }),
      });
      root.querySelectorAll<HTMLElement>("[data-bar]").forEach((bar, i) => {
        const value = Number(bar.dataset.value ?? 0);
        animate(bar, {
          scaleX: [0, value],
          duration: 1400,
          delay: 400 + i * 110,
          ease: "out(4)",
          autoplay: onScroll({ target: root, enter: "92% top", leave: "top bottom", sync: "play reverse" }),
        });
      });
    },
    [events],
  );

  return (
    <div ref={ref} className="grid gap-6 [perspective:1400px] sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <div key={event.id} data-card data-intro className="h-full">
          <EventCard event={event} now={now} viewer={viewer} />
        </div>
      ))}
    </div>
  );
}
