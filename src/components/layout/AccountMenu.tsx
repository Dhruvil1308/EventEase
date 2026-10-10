"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/lib/actions/auth";
import type { Viewer } from "./NavbarView";

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={`transition-colors hover:text-white ${className}`}>
        Sign out
      </button>
    </form>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "U";

export function AccountMenu({ viewer }: { viewer: NonNullable<Viewer> }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const isHost = viewer.role === "HOST";

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1.5 pr-3 pl-1.5 text-sm transition-colors hover:border-white/20"
      >
        {viewer.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ≤300 KB storage image
          <img src={viewer.avatarUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />
        ) : (
          <span
            className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-ink-950 ${
              isHost ? "bg-pink" : "bg-cyan"
            }`}
          >
            {initials(viewer.name)}
          </span>
        )}
        <span className="max-w-28 truncate font-medium text-white">{viewer.name}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-zinc-500" fill="currentColor" aria-hidden>
          <path d="M5.5 7.5L10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] glass-strong"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-white">{viewer.name}</p>
            <p className={`text-xs ${isHost ? "text-pink" : "text-cyan"}`}>
              {isHost ? "Host account" : "Attendee account"}
            </p>
          </div>
          <div className="my-1 h-px bg-white/10" />
          <Link
            href={isHost ? "/host" : "/dashboard"}
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            {isHost ? "Your events" : "My tickets"}
          </Link>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            Your profile
          </Link>
          <Link
            href="/events"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            Browse events
          </Link>
          <div className="my-1 h-px bg-white/10" />
          <div className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5">
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}
