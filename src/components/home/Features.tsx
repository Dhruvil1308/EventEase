import { Reveal } from "@/components/motion/Reveal";
import { SplitText } from "@/components/motion/SplitText";
import { TiltCard } from "@/components/motion/TiltCard";

const FEATURES = [
  {
    title: "Camera QR scanner",
    body: "Point any laptop or phone camera at a ticket. Native BarcodeDetector where available, jsQR everywhere else.",
    icon: "M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M4 12h16",
    span: "md:col-span-2",
    accent: "from-violet/30",
  },
  {
    title: "Typo-proof codes",
    body: "8 characters without 0/O or 1/I/L. Lowercase, spaces or dashes — all accepted.",
    icon: "M4 6h16M4 12h10M4 18h7",
    span: "",
    accent: "from-cyan/25",
  },
  {
    title: "Hard capacity limits",
    body: "Seats are enforced in a transaction, so even simultaneous sign-ups can't overbook.",
    icon: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z",
    span: "",
    accent: "from-pink/25",
  },
  {
    title: "Exactly-once check-in",
    body: "A conditional update admits a ticket once. Scan it at two gates at the same instant and only one wins.",
    icon: "M5 13l4 4L19 7",
    span: "md:col-span-2",
    accent: "from-success/25",
  },
  {
    title: "Live dashboard",
    body: "Registered, checked-in and remaining seats refresh automatically for every organizer.",
    icon: "M4 19V9M10 19V5M16 19v-7M22 19H2",
    span: "",
    accent: "from-violet/25",
  },
  {
    title: "Audit trail",
    body: "Every scan is logged: granted, duplicate, wrong event or invalid.",
    icon: "M9 5h10M9 12h10M9 19h10M5 5h.01M5 12h.01M5 19h.01",
    span: "",
    accent: "from-warn/20",
  },
  {
    title: "Shareable tickets",
    body: "Each ticket has its own link with a downloadable QR, ready to print or save.",
    icon: "M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13",
    span: "md:col-span-2",
    accent: "from-cyan/20",
  },
  {
    title: "Any phone is a gate",
    body: "Fully responsive, with sound and haptic feedback on every verdict — a volunteer's phone becomes a scanner.",
    icon: "M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2zM11 18h2",
    span: "md:col-span-2",
    accent: "from-pink/20",
  },
];

export function Features() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-28">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal as="p" className="font-mono text-xs tracking-[0.3em] text-violet-soft uppercase">
          Built for the gate
        </Reveal>
        <SplitText
          as="h2"
          text="Everything a front door needs."
          className="mt-4 block font-display text-3xl leading-tight font-bold tracking-tight text-white sm:text-5xl"
        />
      </div>

      <Reveal stagger={80} className="mt-14 grid gap-5 md:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className={f.span}>
            <TiltCard className="h-full rounded-3xl" max={6}>
              <div
                className={`relative h-full overflow-hidden rounded-3xl bg-gradient-to-br glass ${f.accent} to-transparent p-6`}
              >
                <div className="grid h-11 w-11 [transform:translateZ(30px)] place-items-center rounded-xl border border-white/10 bg-ink-900/70 text-white">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d={f.icon} />
                  </svg>
                </div>
                <h3 className="mt-5 [transform:translateZ(20px)] font-display text-lg font-semibold text-white">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
              </div>
            </TiltCard>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
