import { Suspense } from "react";
import { Features } from "@/components/home/Features";
import { FinalCta } from "@/components/home/FinalCta";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { LiveStats, LiveStatsSkeleton } from "@/components/home/LiveStats";
import { ProblemSolution } from "@/components/home/ProblemSolution";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { Marquee } from "@/components/motion/Marquee";
import { Reveal } from "@/components/motion/Reveal";
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
      <HowItWorks />

      <Suspense fallback={<LiveStatsSkeleton />}>
        <LiveStats />
      </Suspense>

      <Features />

      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal as="p" className="font-mono text-xs tracking-[0.3em] text-cyan uppercase">
              Happening soon
            </Reveal>
            <SplitText
              as="h2"
              text="Upcoming events"
              className="mt-4 block font-display text-3xl font-semibold text-white sm:text-5xl"
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
