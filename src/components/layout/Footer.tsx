import Link from "next/link";
import { LogoMark, Wordmark } from "./Logo";

export function Footer() {
  return (
    <footer className="no-print relative z-10 mt-24 border-t border-white/5">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="h-8 w-8" />
          <div>
            <Wordmark />
            <p className="mt-1 text-sm text-zinc-500">
              College event registration &amp; check-in, without the spreadsheets.
            </p>
          </div>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
          <Link className="hover:text-white" href="/events">
            Events
          </Link>
          <Link className="hover:text-white" href="/events/new">
            Create an event
          </Link>
          <Link className="hover:text-white" href="/checkin">
            Check-in gate
          </Link>
        </nav>
      </div>
    </footer>
  );
}
