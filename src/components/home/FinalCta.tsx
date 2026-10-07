import { Magnetic } from "@/components/motion/Magnetic";
import { Reveal } from "@/components/motion/Reveal";
import { LinkButton } from "@/components/ui/Button";

export function FinalCta() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-24">
      <Reveal variant="scale" className="relative overflow-hidden rounded-[2.5rem] p-[1px]">
        <div
          aria-hidden
          className="absolute inset-0 animate-[gradient-pan_6s_ease-in-out_infinite_alternate] bg-aurora bg-[length:200%_100%]"
        />
        <div className="relative overflow-hidden rounded-[2.45rem] bg-ink-900 px-8 py-16 text-center sm:px-16">
          <div
            aria-hidden
            className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,#000,transparent_70%)] opacity-60"
          />
          <div
            aria-hidden
            className="absolute top-0 left-1/2 h-64 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet/40 blur-3xl"
          />
          <h2 className="relative mx-auto max-w-2xl font-display text-3xl leading-tight font-bold tracking-tight text-white sm:text-5xl">
            Your next event, <span className="text-gradient">without the queue.</span>
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-zinc-400">
            Set up in under a minute. Share the registration link, then open the check-in gate on any device with a
            camera.
          </p>
          <div className="relative mt-10 flex flex-wrap justify-center gap-3">
            <Magnetic>
              <LinkButton href="/events/new" size="lg">
                Create an event
              </LinkButton>
            </Magnetic>
            <Magnetic strength={0.25}>
              <LinkButton href="/events" size="lg" variant="secondary">
                Browse events
              </LinkButton>
            </Magnetic>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
