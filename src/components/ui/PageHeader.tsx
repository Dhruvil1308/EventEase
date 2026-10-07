import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { SplitText } from "@/components/motion/SplitText";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  eyebrowClass = "text-cyan",
  compact = false,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrowClass?: string;
  /** Smaller title for task-focused screens like the check-in gate. */
  compact?: boolean;
}) {
  return (
    <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <Reveal as="p" className={`font-mono text-xs tracking-[0.3em] uppercase ${eyebrowClass}`}>
          {eyebrow}
        </Reveal>
        <SplitText
          as="h1"
          trigger="mount"
          text={title}
          className={`mt-4 block font-display leading-[1.05] font-bold tracking-tight text-white ${
            compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl"
          }`}
        />
        {description && (
          <Reveal
            as="p"
            variant="blur"
            delay={200}
            className={compact ? "mt-3 text-zinc-400" : "mt-5 text-lg text-zinc-400"}
          >
            {description}
          </Reveal>
        )}
      </div>
      {actions && (
        <Reveal variant="right" delay={250} className="flex flex-wrap gap-3">
          {actions}
        </Reveal>
      )}
    </header>
  );
}
