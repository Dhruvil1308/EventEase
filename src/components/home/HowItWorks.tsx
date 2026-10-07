"use client";

import { animate, onScroll, stagger, svg } from "animejs";
import { useAnimeScope } from "@/components/motion/useAnimeScope";
import { Reveal } from "@/components/motion/Reveal";
import { SplitText } from "@/components/motion/SplitText";

function MiniCreate() {
  return (
    <div className="space-y-3 text-left">
      <div className="rounded-lg border border-white/10 bg-ink-900/80 px-3 py-2 text-xs text-zinc-300">
        TechFest Hackathon Kickoff
      </div>
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-ink-900/80 px-3 py-2 text-xs">
        <span className="text-zinc-500">Capacity</span>
        <span className="font-mono text-cyan">150 seats</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full w-2/3 rounded-full bg-aurora" />
      </div>
    </div>
  );
}

const QR_PATTERN = ["1110101", "1010011", "1110110", "0001010", "1011101", "0110011", "1101011"];

function MiniTicket() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-gradient-to-br from-violet/30 to-cyan/10 p-3">
      <div className="grid grid-cols-7 gap-[2px] rounded-md bg-white p-1.5">
        {QR_PATTERN.join("")
          .split("")
          .map((c, i) => (
            <span key={i} className={`h-1.5 w-1.5 ${c === "1" ? "bg-ink-950" : "bg-white"}`} />
          ))}
      </div>
      <div className="text-left">
        <p className="text-[10px] tracking-widest text-zinc-400 uppercase">Entry code</p>
        <p className="font-mono text-sm font-semibold text-white">EE-7K2M-Q9XD</p>
      </div>
    </div>
  );
}

function MiniCheckin() {
  return (
    <div className="space-y-2 text-left text-xs">
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-success">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-success text-[10px] text-ink-950">✓</span>
        Entry granted · Aisha K.
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-danger">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-danger text-[10px] text-ink-950">✕</span>
        Already checked in · 10:42 AM
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Create the event",
    body: "Name, venue, time and a hard participant capacity. Registration closes itself when seats run out.",
    visual: <MiniCreate />,
  },
  {
    n: "02",
    title: "Register & get a QR",
    body: "Each participant gets a unique entry code and QR ticket instantly. Same email twice? Blocked.",
    visual: <MiniTicket />,
  },
  {
    n: "03",
    title: "Scan at the gate",
    body: "Scan the QR or type the code. Valid tickets get in once; a second scan is rejected on the spot.",
    visual: <MiniCheckin />,
  },
];

/**
 * Three steps joined by a path that draws itself as you scroll down and
 * un-draws as you scroll back up (anime.js drawable synced to scroll).
 */
export function HowItWorks() {
  const ref = useAnimeScope<HTMLElement>(({ root, reduced }) => {
    const paths = root.querySelectorAll<SVGPathElement>("[data-draw]");
    if (reduced) return;
    paths.forEach((p) => {
      animate(svg.createDrawable(p), {
        draw: ["0 0", "0 1"],
        ease: "linear",
        autoplay: onScroll({ target: root, enter: "80% top", leave: "30% bottom", sync: 0.3 }),
      });
    });
    animate(root.querySelectorAll("[data-node]"), {
      scale: [0.6, 1],
      boxShadow: ["0 0 0px rgba(34,211,238,0)", "0 0 30px rgba(34,211,238,0.6)"],
      delay: stagger(220),
      duration: 800,
      ease: "out(3)",
      autoplay: onScroll({ target: root, enter: "70% top", leave: "top bottom", sync: "play reverse" }),
    });
  });

  return (
    <section ref={ref} id="how-it-works" className="relative mx-auto max-w-6xl px-6 py-28">
      <div className="max-w-2xl">
        <Reveal as="p" className="font-mono text-xs tracking-[0.3em] text-cyan uppercase">
          How it works
        </Reveal>
        <SplitText
          as="h2"
          text="From sign-up to doorway in three steps."
          className="mt-4 block font-display text-3xl leading-tight font-semibold text-white sm:text-5xl"
        />
      </div>

      <div className="relative mt-16">
        {/* Desktop connector */}
        <svg
          className="pointer-events-none absolute top-[26px] left-0 hidden h-16 w-full lg:block"
          viewBox="0 0 1000 60"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="how-line" x1="0" x2="1">
              <stop offset="0" stopColor="#7c5cff" />
              <stop offset="0.5" stopColor="#22d3ee" />
              <stop offset="1" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          <path
            d="M60 10 C 250 10, 250 50, 500 30 S 750 10, 940 10"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <path
            data-draw
            d="M60 10 C 250 10, 250 50, 500 30 S 750 10, 940 10"
            fill="none"
            stroke="url(#how-line)"
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Mobile connector */}
        <svg
          className="pointer-events-none absolute top-10 bottom-10 left-[26px] w-2 lg:hidden"
          viewBox="0 0 4 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M2 0 L2 100" stroke="rgba(255,255,255,0.06)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path data-draw d="M2 0 L2 100" stroke="#22d3ee" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>

        <ol className="relative grid gap-10 lg:grid-cols-3 lg:gap-8">
          {STEPS.map((step, i) => (
            <li key={step.n} className="relative pl-20 lg:pl-0">
              <div
                data-node
                className="absolute top-0 left-0 grid h-[54px] w-[54px] place-items-center rounded-2xl font-mono text-sm font-semibold text-white glass-strong lg:relative"
              >
                <span className="text-gradient">{step.n}</span>
              </div>
              <Reveal variant={i % 2 ? "up" : "blur"} delay={i * 120} className="lg:mt-8">
                <div className="border-gradient rounded-3xl p-6 glass transition-transform duration-500 hover:-translate-y-1">
                  <h3 className="font-display text-xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>
                  <div className="mt-6">{step.visual}</div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
