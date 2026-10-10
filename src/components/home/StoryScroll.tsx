"use client";

import { createTimeline, onScroll, splitText, stagger, svg, utils } from "animejs";
import type { ReactNode } from "react";
import { useAnimeScope } from "@/components/motion/useAnimeScope";

/**
 * The whole EventEase flow as one scroll-driven story, in the spirit of
 * animejs.com: a pinned "stage" (a ring around a 21 × 21 dot grid) morphs as
 * you scroll — seats fill up, become a real QR ticket, Aanaya's call ripples
 * out, the gate scans it, rejects the reuse, and the dashboard rises.
 * Everything is scrubbed to the scroll position, so scrolling up plays it all
 * backwards. With reduced motion it renders as a plain, readable list.
 */

const N = 21;
const CENTER = (N - 1) / 2;

/** A real, scannable QR code for the demo ticket EE-7K2M-Q9XD (version 1, 21 × 21). */
const QR = [
  "111111101011101111111",
  "100000100011001000001",
  "101110101101001011101",
  "101110101100101011101",
  "101110101001001011101",
  "100000100111101000001",
  "111111101010101111111",
  "000000000001100000000",
  "111100101111110011101",
  "100100011001101011000",
  "011110100111010011111",
  "011100011001000101010",
  "100101101110100111001",
  "000000001011001101100",
  "111111100101110000010",
  "100000100100000101001",
  "101110100110101111111",
  "101110101011001100010",
  "101110101010101101100",
  "100000101110010001100",
  "111111101010010010110",
];

type Chapter = {
  id: string;
  color: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  code: string;
  chip: ReactNode;
};

const CHAPTERS: Chapter[] = [
  {
    id: "seats",
    color: "#a78bfa",
    eyebrow: "Create",
    title: "Set the seats.",
    body: "A host creates the event with a hard capacity. Registration closes itself the moment the last seat goes.",
    points: ["Capacity enforced in the database", "No overbooking, even in a rush"],
    code: "createEvent({ capacity: 150 })",
    chip: <span className="text-violet-soft">112 / 150 seats taken</span>,
  },
  {
    id: "qr",
    color: "#22d3ee",
    eyebrow: "Register",
    title: "One QR per student.",
    body: "Every sign-up gets a unique, typo-proof entry code and a QR ticket — one per account, per event.",
    points: ["8.5 × 10¹¹ possible codes", "No 0 / O / 1 / I / L to mistype"],
    code: 'register(aisha) → "EE-7K2M-Q9XD"',
    chip: <span className="font-mono text-cyan">EE-7K2M-Q9XD</span>,
  },
  {
    id: "call",
    color: "#f472b6",
    eyebrow: "Remind",
    title: "Aanaya calls ahead.",
    body: "Before the start, our AI voice agent phones every registrant in Gujarati, Hindi or English — in under 20 seconds.",
    points: ["Sarvam Bulbul v3 voice", "Replies understood: coming or not"],
    code: 'aanaya.call(aisha, { lang: "hi" })',
    chip: <span className="text-pink">“हैलो, मैं आनाया बात कर रही हूँ…”</span>,
  },
  {
    id: "scan",
    color: "#34d399",
    eyebrow: "Scan",
    title: "In, in under a second.",
    body: "Camera, USB scanner or a typed code. The gate verifies the ticket and admits the student on the spot.",
    points: ["One conditional update", "Works on any phone or laptop"],
    code: 'checkIn("EE-7K2M-Q9XD") → SUCCESS',
    chip: <span className="text-success">✓ Entry granted · Aisha K.</span>,
  },
  {
    id: "dup",
    color: "#fb7185",
    eyebrow: "Reject",
    title: "Second scan? Denied.",
    body: "A ticket works exactly once — even when two gates scan it at the same instant. The reuse is logged.",
    points: ["12 simultaneous scans → 1 entry", "Wrong-event tickets aren't burned"],
    code: 'checkIn("EE-7K2M-Q9XD") → DUPLICATE',
    chip: <span className="text-danger">✕ Already checked in · 10:42 AM</span>,
  },
  {
    id: "live",
    color: "#fbbf24",
    eyebrow: "Track",
    title: "Every seat, live.",
    body: "Registered, checked in, seats left and every gate result — on a dashboard that refreshes by itself.",
    points: ["CSV export in one click", "A full audit trail of scans"],
    code: "liveStats() → { checkedIn: 21 }",
    chip: <span className="text-warn">93% full · 21 checked in</span>,
  },
];

// ── Dot-grid shapes, one per chapter ──────────────────────────────────────────

type Dot = { s: number; o: number; c: string; x?: number };

const cells = Array.from({ length: N * N }, (_, i) => ({ r: Math.floor(i / N), c: i % N }));
const dist = (r: number, c: number) => Math.hypot(r - CENTER, c - CENTER);
const isQr = (r: number, c: number) => QR[r][c] === "1";
const BAR_HEIGHTS = [5, 8, 11, 9, 14, 17, 20];

const SHAPES: Record<string, (r: number, c: number, i: number) => Dot> = {
  empty: () => ({ s: 0.32, o: 0.22, c: "#3b3561" }),
  seats: (_r, _c, i) => (i < N * N * 0.76 ? { s: 0.62, o: 1, c: "#a78bfa" } : { s: 0.4, o: 0.28, c: "#4c4380" }),
  qr: (r, c) => (isQr(r, c) ? { s: 1, o: 1, c: "#e6fbff" } : { s: 0.16, o: 0.4, c: "#22d3ee" }),
  call: (r, c) => {
    const ring = Math.round(dist(r, c)) % 4;
    return ring === 0
      ? { s: 0.9, o: 1, c: "#f472b6" }
      : ring === 1
        ? { s: 0.5, o: 0.6, c: "#f9a8d4" }
        : { s: 0.18, o: 0.25, c: "#831843" };
  },
  scan: (r, c) => (isQr(r, c) ? { s: 1, o: 1, c: "#34d399" } : { s: 0.14, o: 0.3, c: "#065f46" }),
  dup: (r, c, i) => {
    const inX = r > 2 && r < N - 3 && (Math.abs(r - c) <= 1 || Math.abs(r + c - (N - 1)) <= 1);
    const jitter = ((i * 37) % 9) - 4;
    return inX ? { s: 0.95, o: 1, c: "#fb7185", x: jitter } : { s: 0.18, o: 0.25, c: "#7f1d1d", x: jitter / 2 };
  },
  live: (r, c) => {
    const bar = Math.floor(c / 3);
    const on = N - 1 - r < BAR_HEIGHTS[bar] && c % 3 !== 2;
    return on ? { s: 0.86, o: 1, c: bar > 4 ? "#fbbf24" : "#22d3ee", x: 0 } : { s: 0.12, o: 0.18, c: "#334155", x: 0 };
  },
};

const shape = (id: string) => cells.map(({ r, c }, i) => SHAPES[id](r, c, i));

/** A per-dot value for anime.js (it passes each target's index). */
const per =
  <T,>(get: (i: number) => T) =>
  (_target?: unknown, i = 0) =>
    get(i);

// ── The stage ring ────────────────────────────────────────────────────────────

const R_ARC = 284;
/** Rounded so the server and the browser render identical SVG (no hydration mismatch). */
const rd = (v: number) => Math.round(v * 100) / 100;
const arcPath = (k: number, total: number) => {
  const gap = 3;
  const a0 = ((k * 360) / total + gap - 90) * (Math.PI / 180);
  const a1 = (((k + 1) * 360) / total - gap - 90) * (Math.PI / 180);
  const p = (a: number) => `${rd(300 + R_ARC * Math.cos(a))} ${rd(300 + R_ARC * Math.sin(a))}`;
  return `M ${p(a0)} A ${R_ARC} ${R_ARC} 0 0 1 ${p(a1)}`;
};
const TICKS = Array.from({ length: 120 }, (_, i) => i);

function Stage() {
  return (
    <div className="relative aspect-square w-[min(84vw,44svh)] lg:w-[min(46vw,74svh)]">
      <svg viewBox="0 0 600 600" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id="story-disc" cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#1b1838" />
            <stop offset="1" stopColor="#0b0a18" />
          </radialGradient>
        </defs>
        <g data-ring style={{ transformOrigin: "300px 300px" }}>
          <circle cx="300" cy="300" r={R_ARC} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          {CHAPTERS.map((ch, k) => (
            <path
              key={ch.id}
              data-arc
              d={arcPath(k, CHAPTERS.length)}
              fill="none"
              stroke={ch.color}
              strokeWidth="10"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 10px ${ch.color})` }}
            />
          ))}
        </g>
        <g data-ticks style={{ transformOrigin: "300px 300px" }}>
          {TICKS.map((t) => {
            const a = (t * 3 * Math.PI) / 180;
            const long = t % 10 === 0;
            const r0 = long ? 246 : 252;
            return (
              <line
                key={t}
                x1={rd(300 + r0 * Math.cos(a))}
                y1={rd(300 + r0 * Math.sin(a))}
                x2={rd(300 + 266 * Math.cos(a))}
                y2={rd(300 + 266 * Math.sin(a))}
                stroke={long ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.14)"}
                strokeWidth={long ? 2 : 1.2}
              />
            );
          })}
        </g>
        <circle cx="300" cy="300" r="232" fill="url(#story-disc)" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <path
          d="M 120 210 A 200 200 0 0 1 260 104"
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="14"
          strokeLinecap="round"
        />
      </svg>

      {/* Aanaya's call: ripples that only show in that chapter */}
      <div data-ripples className="pointer-events-none absolute inset-0 grid place-items-center opacity-0">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute h-[46%] w-[46%] animate-[story-ripple_2.4s_ease-out_infinite] rounded-full border-2 border-pink/70"
            style={{ animationDelay: `${i * 0.8}s` }}
          />
        ))}
      </div>

      <div className="absolute inset-0 grid place-items-center [perspective:1100px]">
        <div data-grid className="relative aspect-square w-[52%] [transform-style:preserve-3d]">
          <div
            className="grid h-full w-full gap-[1.2%]"
            style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}
          >
            {cells.map((_, i) => (
              <span
                key={i}
                data-dot
                className="aspect-square rounded-[24%] bg-[#3b3561]"
                style={{ transform: "scale(0.32)", opacity: 0.22 }}
              />
            ))}
          </div>
          <span
            data-scanline
            className="absolute inset-x-[-6%] top-0 h-[3px] rounded-full bg-success opacity-0 shadow-[0_0_24px_6px_rgba(52,211,153,0.55)]"
          />
        </div>
      </div>
    </div>
  );
}

// ── The section ───────────────────────────────────────────────────────────────

const INTRO = 1250;
const STEP = 1000;

export function StoryScroll() {
  const ref = useAnimeScope<HTMLElement>(({ root, reduced }) => {
    const q = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));
    const dots = q("[data-dot]");
    const panels = q("[data-chapter]");
    const cards = q("[data-card]");
    const tints = q("[data-tint]");

    if (reduced) {
      const qr = shape("qr");
      dots.forEach((d, i) => utils.set(d, { scale: qr[i].s, opacity: qr[i].o, backgroundColor: qr[i].c }));
      utils.set([...panels, ...cards], { opacity: 1 });
      return;
    }

    const titles = q("[data-chapter-title]").map((t) => splitText(t, { words: { wrap: "clip" }, chars: true }));
    const arcs = q<SVGPathElement>("[data-arc]").map((p) => svg.createDrawable(p));
    utils.set(arcs, { draw: "0 0" });
    utils.set([...panels, ...cards], { opacity: 0 });
    utils.set(tints, { opacity: 0 });

    const tl = createTimeline({
      defaults: { ease: "inOut(3)" },
      autoplay: onScroll({ target: root, enter: "end start", leave: "end end", sync: 0.18 }),
    });

    // Intro: as the section rises into view the stage assembles itself.
    tl.add(q("[data-ring]"), { scale: [0.82, 1], rotate: [-30, 0], opacity: [0, 1], duration: 900 }, 0)
      .add(q("[data-ticks]"), { rotate: [0, 360], ease: "linear", duration: INTRO + STEP * CHAPTERS.length }, 0)
      .add(
        dots,
        { scale: [0, 0.32], opacity: [0, 0.22], duration: 500, delay: stagger(14, { grid: [N, N], from: "center" }) },
        250,
      )
      .add(q("[data-ruler-marker]"), { left: ["3%", "97%"], ease: "linear", duration: STEP * CHAPTERS.length }, INTRO);

    let previous = shape("empty");
    CHAPTERS.forEach((ch, k) => {
      const at = INTRO + k * STEP;
      const next = shape(ch.id);

      // Text and code card: the old chapter leaves upward, the new one rises in.
      if (k > 0) {
        tl.add(panels[k - 1], { opacity: [1, 0], y: [0, -48], filter: ["blur(0px)", "blur(10px)"], duration: 300 }, at)
          .add(cards[k - 1], { opacity: [1, 0], x: [0, 40], duration: 260 }, at)
          .add(tints[k - 1], { opacity: [1, 0], duration: 500 }, at);
      }
      const enterAt = k === 0 ? at - 380 : at + 160;
      tl.add(panels[k], { opacity: [0, 1], y: [56, 0], filter: ["blur(10px)", "blur(0px)"], duration: 360 }, enterAt)
        .add(titles[k].chars, { y: ["110%", "0%"], rotate: [10, 0], duration: 360, delay: stagger(9) }, enterAt)
        .add(cards[k], { opacity: [0, 1], x: [-40, 0], duration: 320 }, enterAt + 80)
        .add(tints[k], { opacity: [0, 1], duration: 500 }, Math.max(at - 200, 0))
        .add(arcs[k], { draw: ["0 0", "0 1"], duration: 700, ease: "inOut(2)" }, at);

      // The dots morph from the previous shape into this chapter's.
      const prev = previous;
      tl.add(
        dots,
        {
          scale: { from: per((i) => prev[i].s), to: per((i) => next[i].s) },
          opacity: { from: per((i) => prev[i].o), to: per((i) => next[i].o) },
          backgroundColor: { from: per((i) => prev[i].c), to: per((i) => next[i].c) },
          x: { from: per((i) => prev[i].x ?? 0), to: per((i) => next[i].x ?? 0) },
          duration: 420,
          delay: stagger(ch.id === "seats" || ch.id === "scan" ? 0.9 : 13, {
            grid: [N, N],
            from: ch.id === "seats" || ch.id === "scan" ? "first" : "center",
          }),
        },
        at,
      );
      previous = next;
    });

    // Chapter-specific flourishes.
    const callAt = INTRO + 2 * STEP;
    const scanAt = INTRO + 3 * STEP;
    const liveAt = INTRO + 5 * STEP;
    tl.add(q("[data-ripples]"), { opacity: [0, 1], duration: 300 }, callAt + 100)
      .add(q("[data-ripples]"), { opacity: [1, 0], duration: 300 }, scanAt)
      .add(q("[data-scanline]"), { opacity: [0, 1], duration: 120 }, scanAt + 40)
      .add(q("[data-scanline]"), { top: ["0%", "100%"], duration: 640, ease: "inOut(2)" }, scanAt + 60)
      .add(q("[data-scanline]"), { opacity: [1, 0], duration: 160 }, scanAt + 700)
      .add(q("[data-grid]"), { rotate: [0, 10, -10, 0], duration: 500 }, INTRO + 4 * STEP)
      .add(q("[data-grid]"), { rotateX: [0, 56], rotateZ: [0, -38], scale: [1, 0.94], duration: 700 }, liveAt);

    return () => titles.forEach((t) => t.revert());
  });

  return (
    <section
      ref={ref}
      id="how-it-works"
      aria-label="How EventEase works"
      className="relative h-[580vh] motion-reduce:h-auto"
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden motion-reduce:static motion-reduce:h-auto motion-reduce:py-24">
        {CHAPTERS.map((ch) => (
          <div
            key={ch.id}
            data-tint
            aria-hidden
            className="pointer-events-none absolute inset-0 motion-reduce:hidden"
            style={{ background: `radial-gradient(60% 55% at 70% 50%, ${ch.color}22, transparent 70%)` }}
          />
        ))}

        <div className="relative mx-auto grid h-full max-w-6xl grid-rows-[auto_1fr] items-center gap-6 px-6 pt-24 pb-10 motion-reduce:h-auto lg:grid-cols-[0.85fr_1.15fr] lg:grid-rows-1 lg:pt-16 lg:pb-0">
          {/* Chapter text — stacked, one visible at a time */}
          <div className="relative order-2 min-h-[15rem] motion-reduce:min-h-0 sm:min-h-[17rem] lg:order-1 lg:min-h-[24rem]">
            <p className="hidden font-mono text-xs tracking-[0.3em] text-zinc-500 uppercase motion-reduce:mb-8 motion-reduce:block lg:absolute lg:-top-14 lg:block lg:motion-reduce:static">
              How it works · scroll
            </p>
            {CHAPTERS.map((ch, k) => (
              <article
                key={ch.id}
                data-chapter
                className="absolute inset-x-0 top-0 motion-reduce:relative motion-reduce:top-auto motion-reduce:mb-16 motion-reduce:translate-y-0 lg:top-1/2 lg:-translate-y-1/2 lg:motion-reduce:top-auto lg:motion-reduce:translate-y-0"
              >
                <p className="font-mono text-xs tracking-[0.25em] uppercase" style={{ color: ch.color }}>
                  {String(k + 1).padStart(2, "0")} / {String(CHAPTERS.length).padStart(2, "0")} · {ch.eyebrow}
                </p>
                <h2
                  data-chapter-title
                  className="mt-3 font-display text-3xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl"
                  style={{ color: ch.color }}
                >
                  {ch.title}
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400 sm:text-base">{ch.body}</p>
                <ul className="mt-5 hidden space-y-2 border-t border-white/10 pt-4 sm:block">
                  {ch.points.map((pt) => (
                    <li
                      key={pt}
                      className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-zinc-300 uppercase"
                    >
                      <span style={{ color: ch.color }}>→</span> {pt}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          {/* The stage */}
          <div className="order-1 flex justify-center lg:order-2 lg:justify-end lg:motion-reduce:sticky lg:motion-reduce:top-28 lg:motion-reduce:self-start">
            <Stage />
          </div>
        </div>

        {/* Code card + progress ruler, like a control panel */}
        <div className="absolute right-6 bottom-6 hidden w-80 space-y-2 motion-reduce:hidden lg:block">
          <div className="relative h-[86px]">
            {CHAPTERS.map((ch) => (
              <div
                key={ch.id}
                data-card
                className="absolute inset-0 rounded-2xl border border-white/10 bg-ink-900/80 px-4 py-3 backdrop-blur"
              >
                <p className="truncate font-mono text-xs text-zinc-300">
                  <span style={{ color: ch.color }}>›</span> {ch.code}
                </p>
                <p className="mt-2 truncate text-sm font-semibold">{ch.chip}</p>
              </div>
            ))}
          </div>
          <div className="relative flex h-9 items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-ink-900/80 px-3">
            {Array.from({ length: 48 }, (_, i) => (
              <span key={i} className={`w-px bg-white/20 ${i % 6 === 0 ? "h-4" : "h-2"}`} />
            ))}
            <span
              data-ruler-marker
              className="absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-danger shadow-[0_0_10px_rgba(251,113,133,0.9)]"
              style={{ left: "3%" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
