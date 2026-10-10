"use client";

import { animate, onScroll, scrambleText } from "animejs";
import { createElement } from "react";
import { useAnimeScope, type MotionTag } from "./useAnimeScope";

/**
 * A label that decodes itself letter by letter, terminal-style, every time it
 * scrolls into view. Screen readers get the plain text; the scrambling copy is
 * hidden from them.
 */
export function Scramble({ text, as = "p", className }: { text: string; as?: MotionTag; className?: string }) {
  const ref = useAnimeScope<HTMLSpanElement>(
    ({ root, reduced }) => {
      if (reduced) return;
      const decode = animate(root, {
        innerHTML: scrambleText({ text, chars: "A-Z0-9#%&", revealRate: 45, settleDuration: 260, cursor: "▌" }),
        autoplay: false,
      });
      onScroll({ target: root, enter: "end start", leave: "start end", onEnter: () => decode.restart() });
    },
    [text],
  );

  return createElement(
    as,
    { className },
    <span className="sr-only">{text}</span>,
    <span ref={ref} aria-hidden>
      {text}
    </span>,
  );
}
