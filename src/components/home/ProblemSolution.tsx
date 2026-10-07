import { Reveal } from "@/components/motion/Reveal";
import { SplitText } from "@/components/motion/SplitText";

const BEFORE = [
  "Google Forms for sign-ups, a spreadsheet for the gate",
  "The same student registered three times and nobody noticed",
  "Volunteers scrolling a sheet to find a name while the queue grows",
  "Screenshots of tickets reused by friends — no way to tell",
  "Headcount reconciled by hand after the event",
];

const AFTER = [
  "One place to create events, register and check in",
  "Duplicate registrations blocked per event, case-insensitive",
  "Scan a QR or type an 8-character code: verified in under a second",
  "Every ticket works exactly once; reuse is rejected and logged",
  "Registered vs. attended counts update live on the dashboard",
];

export function ProblemSolution() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-28">
      <div className="max-w-3xl">
        <Reveal as="p" className="font-mono text-xs tracking-[0.3em] text-pink uppercase">
          The problem
        </Reveal>
        <SplitText
          as="h2"
          text="Spreadsheets weren't built for the front door."
          className="mt-4 block font-display text-3xl leading-tight font-semibold text-white sm:text-5xl"
        />
        <Reveal as="p" variant="blur" delay={150} className="mt-5 text-lg text-zinc-400">
          Disconnected forms and sheets cause duplicate entries and slow check-ins. EventEase keeps registration and
          attendance in one source of truth.
        </Reveal>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        <Reveal variant="left" className="relative overflow-hidden rounded-3xl p-7 glass">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-danger/10 blur-3xl" />
          <p className="flex items-center gap-2 text-sm font-semibold tracking-widest text-danger uppercase">
            <span className="h-2 w-2 rounded-full bg-danger" /> Before
          </p>
          <Reveal as="ul" stagger={90} delay={200} className="mt-6 space-y-4">
            {BEFORE.map((item) => (
              <li key={item} className="flex gap-3 text-zinc-400">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-danger/40 text-[10px] text-danger">
                  ✕
                </span>
                <span className="line-through decoration-danger/40">{item}</span>
              </li>
            ))}
          </Reveal>
        </Reveal>

        <Reveal variant="right" className="border-gradient relative overflow-hidden rounded-3xl p-7 shadow-glow glass">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-success/15 blur-3xl" />
          <p className="flex items-center gap-2 text-sm font-semibold tracking-widest text-success uppercase">
            <span className="h-2 w-2 rounded-full bg-success" /> With EventEase
          </p>
          <Reveal as="ul" stagger={90} delay={300} className="mt-6 space-y-4">
            {AFTER.map((item) => (
              <li key={item} className="flex gap-3 text-zinc-200">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success text-[10px] font-bold text-ink-950">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </Reveal>
        </Reveal>
      </div>
    </section>
  );
}
