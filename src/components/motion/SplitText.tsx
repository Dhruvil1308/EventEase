"use client";

import { animate, onScroll, splitText, stagger, utils } from "animejs";
import { createElement } from "react";
import { useAnimeScope, type MotionTag } from "./useAnimeScope";

type SplitTextProps = {
  text: string;
  as?: MotionTag;
  className?: string;
  /** Animate on mount (hero) or when scrolled into view (sections). */
  trigger?: "mount" | "scroll";
  delay?: number;
};

/**
 * Splits text into characters with anime.js and rolls each one up from a
 * clipped baseline. Screen readers still get the original sentence.
 */
export function SplitText({ text, as = "span", className, trigger = "scroll", delay = 0 }: SplitTextProps) {
  const ref = useAnimeScope<HTMLElement>(
    ({ root, reduced }) => {
      if (reduced) {
        utils.set(root, { opacity: 1 });
        return;
      }
      const splitter = splitText(root, { words: { wrap: "clip" }, chars: true });
      utils.set(root, { opacity: 1 });
      animate(splitter.chars, {
        y: ["110%", "0%"],
        rotate: [12, 0],
        opacity: [0, 1],
        duration: 900,
        delay: stagger(18, { start: delay }),
        ease: "out(4)",
        autoplay:
          trigger === "scroll"
            ? onScroll({ target: root, enter: "90% top", leave: "top bottom", sync: "play reverse" })
            : true,
      });
      return () => splitter.revert();
    },
    [text],
  );

  return createElement(as, { ref, className, style: { opacity: 0 } }, text);
}
