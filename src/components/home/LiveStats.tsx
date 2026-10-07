import { connection } from "next/server";
import type { ReactNode } from "react";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { getGlobalStats } from "@/lib/services/events";

const TILES = [
  { key: "events", label: "Events hosted", color: "text-violet-soft" },
  { key: "registrations", label: "Registrations", color: "text-cyan" },
  { key: "checkIns", label: "Checked in", color: "text-success" },
  { key: "duplicatesBlocked", label: "Duplicates blocked", color: "text-danger" },
] as const;

function Shell({ children }: { children: ReactNode }) {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-10">
      <div className="border-gradient relative overflow-hidden rounded-[2rem] p-8 glass sm:p-10">
        <div aria-hidden className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-aurora opacity-20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-xs tracking-[0.3em] text-zinc-400 uppercase">Live from the database</p>
          <span className="inline-flex items-center gap-2 text-xs text-success">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Real numbers, updated on every visit
          </span>
        </div>
        {children}
      </div>
    </section>
  );
}

export async function LiveStats() {
  await connection();
  const stats = await getGlobalStats();
  return (
    <Shell>
      <Reveal stagger={100} className="relative mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        {TILES.map((t) => (
          <div key={t.key}>
            <CountUp value={stats[t.key]} className={`block font-display text-4xl font-bold sm:text-5xl ${t.color}`} />
            <p className="mt-2 text-sm text-zinc-400">{t.label}</p>
          </div>
        ))}
      </Reveal>
    </Shell>
  );
}

export function LiveStatsSkeleton() {
  return (
    <Shell>
      <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        {TILES.map((t) => (
          <div key={t.key}>
            <Skeleton className="h-12 w-24" />
            <Skeleton className="mt-3 h-4 w-28" />
          </div>
        ))}
      </div>
    </Shell>
  );
}
