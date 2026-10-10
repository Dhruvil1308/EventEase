"use client";

import { animate, onScroll, splitText, stagger, utils } from "animejs";
import { createElement } from "react";
import { useAnimeScope, type MotionTag } from "./useAnimeScope";

export type SplitEffect = "roll" | "scatter" | "wave";

type SplitTextProps = {
  text: string;
  as?: MotionTag;
  className?: string;
  /** Animate on mount (hero) or when scrolled into view (sections). */
  trigger?: "mount" | "scroll";
  /**
   * `roll`: characters roll up from a clipped baseline (plays and reverses).
   * `scatter`: characters fly in from random spots and assemble as you scroll —
   * scrubbed, so scrolling up scatters them again.
   * `wave`: characters rise in a wave from the middle out.
   */
  effect?: SplitEffect;
  delay?: number;
};

/** Splits text into characters with anime.js. Screen readers still get the original sentence. */
export function SplitText({
  text,
  as = "span",
  className,
  trigger = "scroll",
  effect = "roll",
  delay = 0,
}: SplitTextProps) {
  const ref = useAnimeScope<HTMLElement>(
    ({ root, reduced }) => {
      if (reduced) {
        utils.set(root, { opacity: 1 });
        return;
      }
      const splitter = splitText(root, {
        // Scattered letters must be free to leave their word; the others roll out of a clipped line.
        words: effect === "scatter" ? true : { wrap: "clip" },
        chars: true,
      });
      utils.set(root, { opacity: 1 });
      const replay = () =>
        trigger === "scroll"
          ? onScroll({ target: root, enter: "90% top", leave: "top bottom", sync: "play reverse" })
          : true;

      if (effect === "scatter") {
        animate(splitter.chars, {
          x: () => [utils.random(-260, 260), 0],
          y: () => [utils.random(-180, 180), 0],
          rotate: () => [utils.random(-90, 90), 0],
          scale: () => [utils.random(0.2, 1.8, 2), 1],
          opacity: [0, 1],
          ease: "out(3)",
          delay: stagger(6, { from: "random" }),
          duration: 1000,
          autoplay: onScroll({ target: root, enter: "end start", leave: "60% start", sync: 0.2 }),
        });
      } else if (effect === "wave") {
        animate(splitter.chars, {
          y: ["120%", "0%"],
          scaleY: [2.2, 1],
          opacity: [0, 1],
          duration: 900,
          delay: stagger(26, { from: "center", start: delay }),
          ease: "out(4)",
          autoplay: replay(),
        });
      } else {
        animate(splitter.chars, {
          y: ["110%", "0%"],
          rotate: [12, 0],
          opacity: [0, 1],
          duration: 900,
          delay: stagger(18, { start: delay }),
          ease: "out(4)",
          autoplay: replay(),
        });
      }
      return () => splitter.revert();
    },
    [text, effect],
  );

  return createElement(as, { ref, className, style: { opacity: 0 } }, text);
}
