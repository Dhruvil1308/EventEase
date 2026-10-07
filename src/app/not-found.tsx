import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center px-6 pt-24 text-center">
      <div className="relative">
        <p className="text-gradient font-display text-[7rem] leading-none font-bold sm:text-[9rem]">404</p>
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-0.5 animate-[scan-line_2.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan to-transparent shadow-[0_0_14px_#22d3ee]"
        />
      </div>
      <h1 className="mt-6 font-display text-2xl font-semibold text-white">This page didn&apos;t scan.</h1>
      <p className="mt-3 text-zinc-400">
        The event, ticket or page you&apos;re looking for doesn&apos;t exist — it may have been deleted, or the code was
        mistyped.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/events">Browse events</LinkButton>
        <LinkButton href="/" variant="secondary">
          Go home
        </LinkButton>
      </div>
    </div>
  );
}
