"use client";

import { animate, createTimeline, onScroll, stagger } from "animejs";
import { HeroCanvas } from "@/components/three/HeroCanvas";
import { Magnetic } from "@/components/motion/Magnetic";
import { useAnimeScope } from "@/components/motion/useAnimeScope";
import { LinkButton } from "@/components/ui/Button";

const PROOF = [
  { k: "< 1s", v: "per check-in" },
  { k: "1×", v: "use per ticket" },
  { k: "Live", v: "attendance counts" },
];

export function Hero() {
  const ref = useAnimeScope<HTMLElement>(({ root, reduced }) => {
    const q = (sel: string) => root.querySelectorAll<HTMLElement>(sel);
    if (reduced) return;

    createTimeline({ defaults: { ease: "out(4)", duration: 1100 } })
      .add(q("[data-hero-line]"), { y: ["115%", "0%"], rotate: [4, 0], duration: 1300, delay: stagger(120) })
      .add(q("[data-hero='copy']"), { opacity: [0, 1], filter: ["blur(12px)", "blur(0px)"], y: [20, 0] }, "-=900")
      .add(q("[data-hero='cta'] > *"), { opacity: [0, 1], y: [24, 0], delay: stagger(100) }, "-=850")
      .add(q("[data-hero='proof'] > *"), { opacity: [0, 1], x: [-16, 0], delay: stagger(90) }, "-=800");

    // Scroll-linked parallax: content drifts up and fades as the hero leaves,
    // and comes back exactly as you scroll up.
    const content = root.querySelector("[data-hero-content]");
    if (content) {
      animate(content, {
        y: [0, -120],
        opacity: [1, 0.35],
        ease: "linear",
        autoplay: onScroll({ target: root, enter: "top top", leave: "top bottom", sync: 0.25 }),
      });
    }
  });

  return (
    <section
      ref={ref}
      className="relative isolate flex min-h-[100svh] items-start overflow-hidden pt-28 pb-[min(112vw,470px)] sm:pt-32 lg:items-center lg:pt-24 lg:pb-0"
    >
      <HeroCanvas />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-950" />

      <div data-hero-content className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <div className="max-w-2xl">
          <h1 className="font-display text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-white sm:text-[4.1rem] lg:text-[4.9rem]">
            <span className="block overflow-hidden pb-1">
              <span data-hero-line className="block">
                Register fast.
              </span>
            </span>
            <span className="block overflow-hidden pb-1">
              <span data-hero-line className="block text-gradient">
                Scan once.
              </span>
            </span>
            <span className="block overflow-hidden pb-2">
              <span data-hero-line className="block">
                Zero duplicates.
              </span>
            </span>
          </h1>

          <p data-hero="copy" data-intro className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            EventEase replaces scattered forms and spreadsheets with one flow: create an event with a capacity, give
            every participant a unique QR ticket, and verify it at the door. Second scans are rejected automatically.
          </p>

          <div data-hero="cta" className="mt-9 flex flex-wrap items-center gap-3">
            <div data-intro>
              <Magnetic>
                <LinkButton href="/events/new" size="lg">
                  Create an event
                  <svg
                    viewBox="0 0 20 20"
                    className="h-5 w-5 transition-transform group-hover:translate-x-1"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M10.3 3.3a1 1 0 011.4 0l6 6a1 1 0 010 1.4l-6 6a1 1 0 01-1.4-1.4l4.3-4.3H3a1 1 0 110-2h11.6l-4.3-4.3a1 1 0 010-1.4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </LinkButton>
              </Magnetic>
            </div>
            <div data-intro>
              <Magnetic strength={0.25}>
                <LinkButton href="/checkin" variant="secondary" size="lg">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path
                      d="M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16"
                      strokeLinecap="round"
                    />
                  </svg>
                  Open check-in gate
                </LinkButton>
              </Magnetic>
            </div>
          </div>

          <dl data-hero="proof" className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
            {PROOF.map((p) => (
              <div key={p.v} data-intro className="flex items-baseline gap-2">
                <dt className="font-display text-xl font-semibold text-white">{p.k}</dt>
                <dd className="text-sm text-zinc-500">{p.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
