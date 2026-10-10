import { Suspense } from "react";
import { Features } from "@/components/home/Features";
import { FinalCta } from "@/components/home/FinalCta";
import { Hero } from "@/components/home/Hero";
import { StoryScroll } from "@/components/home/StoryScroll";
import { LiveStats, LiveStatsSkeleton } from "@/components/home/LiveStats";
import { ProblemSolution } from "@/components/home/ProblemSolution";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { Marquee } from "@/components/motion/Marquee";
import { Reveal } from "@/components/motion/Reveal";
import { Scramble } from "@/components/motion/Scramble";
import { SplitText } from "@/components/motion/SplitText";
import { LinkButton } from "@/components/ui/Button";
import { CardGridSkeleton } from "@/components/ui/Skeleton";

const TICKER = [
  "QR tickets",
  "Capacity limits",
  "Duplicate protection",
  "Live attendance",
  "Camera scanner",
  "Manual code entry",
  "Audit log",
  "One-tap registration",
];

/** Big outlined words for the band between the features and upcoming events. */
const BAND = ["Register fast", "Scan once", "Zero duplicates", "Aanaya calls", "Live counts"];

export default function HomePage() {
  return (
    <>
      <Hero />

      <div className="relative border-y border-white/5 bg-ink-950/60 backdrop-blur-sm">
        <Marquee>
          {TICKER.map((item) => (
            <span key={item} className="flex items-center gap-10 whitespace-nowrap">
              <span className="font-display text-xl font-semibold tracking-wide text-white/80 uppercase sm:text-2xl">
                {item}
              </span>
              <span className="text-gradient text-2xl" aria-hidden>
                ✦
              </span>
            </span>
          ))}
        </Marquee>
      </div>

      <ProblemSolution />
      <StoryScroll />

      <Suspense fallback={<LiveStatsSkeleton />}>
        <LiveStats />
      </Suspense>

      <Features />

      <div aria-hidden className="relative py-6">
        <Marquee reverse speed={36000} className="py-2">
          {BAND.map((word, i) => (
            <span
              key={word}
              className={`font-display text-6xl font-extrabold tracking-tight whitespace-nowrap uppercase sm:text-8xl ${
                i % 2 ? "text-gradient" : "text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.28)]"
              }`}
            >
              {word}
              <span className="mx-8 text-white/20">✦</span>
            </span>
          ))}
        </Marquee>
      </div>

      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Scramble text="Happening soon" className="font-mono text-xs tracking-[0.3em] text-cyan uppercase" />
            <SplitText
              as="h2"
              text="Upcoming events"
              className="mt-4 block font-display text-3xl font-bold tracking-tight text-white sm:text-5xl"
            />
          </div>
          <Reveal variant="right">
            <LinkButton href="/events" variant="secondary">
              View all events →
            </LinkButton>
          </Reveal>
        </div>
        <div className="mt-12">
          <Suspense fallback={<CardGridSkeleton />}>
            <UpcomingEvents />
          </Suspense>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
