"use client";

import { animate, stagger } from "animejs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LogoMark, Wordmark } from "./Logo";
import { Magnetic } from "@/components/motion/Magnetic";
import { prefersReducedMotion } from "@/components/motion/useAnimeScope";
import { AccountMenu, SignOutButton } from "./AccountMenu";

export type Viewer = { name: string; role: "ATTENDEE" | "HOST" } | null;

/** The nav only ever offers what this visitor is actually allowed to open. */
function linksFor(viewer: Viewer) {
  if (viewer?.role === "HOST") {
    return [
      { href: "/host", label: "Your events" },
      { href: "/events", label: "Browse" },
      { href: "/events/new", label: "Create" },
      { href: "/checkin", label: "Check-in" },
    ];
  }
  if (viewer?.role === "ATTENDEE") {
    return [
      { href: "/dashboard", label: "My tickets" },
      { href: "/events", label: "Browse events" },
    ];
  }
  return [
    { href: "/", label: "Home" },
    { href: "/events", label: "Events" },
  ];
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/events")
    return pathname === "/events" || (pathname.startsWith("/events/") && pathname !== "/events/new");
  if (href === "/host") return pathname === "/host";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * `usePathname()` is request data under Cache Components, so the active-link
 * state streams in behind Suspense; the fallback is the same bar without it.
 */
export function NavbarShell({ viewer }: { viewer: Viewer }) {
  return (
    <Suspense fallback={<NavbarView pathname="" viewer={viewer} />}>
      <NavbarWithPath viewer={viewer} />
    </Suspense>
  );
}

function NavbarWithPath({ viewer }: { viewer: Viewer }) {
  return <NavbarView pathname={usePathname()} viewer={viewer} />;
}

function NavbarView({ pathname, viewer }: { pathname: string; viewer: Viewer }) {
  const links = linksFor(viewer);
  const header = useRef<HTMLElement>(null);
  const linksWrap = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Hide while scrolling down, reveal as soon as the user scrolls up.
  useEffect(() => {
    let lastY = window.scrollY;
    let hidden = false;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 12);
      const goingDown = y > lastY + 4;
      const goingUp = y < lastY - 4;
      if (Math.abs(y - lastY) > 4) lastY = y;
      if (!header.current || open) return;
      if (goingDown && y > 140 && !hidden) {
        hidden = true;
        animate(header.current, { y: "-130%", duration: 450, ease: "inOut(3)" });
      } else if (goingUp && hidden) {
        hidden = false;
        animate(header.current, { y: "0%", duration: 600, ease: "out(4)" });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  // Slide the active pill under the current link.
  const movePill = useCallback((instant = false) => {
    const wrap = linksWrap.current;
    const el = pill.current;
    if (!wrap || !el) return;
    const active = wrap.querySelector<HTMLElement>("[data-active='true']");
    if (!active) {
      animate(el, { opacity: 0, duration: 200 });
      return;
    }
    animate(el, {
      x: active.offsetLeft,
      width: active.offsetWidth,
      opacity: 1,
      duration: instant || prefersReducedMotion() ? 0 : 650,
      ease: "out(4)",
    });
  }, []);

  useLayoutEffect(() => {
    movePill(!pill.current?.dataset.ready);
    if (pill.current) pill.current.dataset.ready = "1";
  }, [pathname, movePill]);

  useEffect(() => {
    const onResize = () => movePill(true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [movePill]);

  useEffect(() => {
    if (!open || !menu.current) return;
    animate(menu.current.querySelectorAll("[data-menu-item]"), {
      opacity: [0, 1],
      y: [30, 0],
      delay: stagger(60),
      duration: 700,
      ease: "out(4)",
    });
  }, [open]);

  return (
    <>
      <header ref={header} className="no-print fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
        <nav
          aria-label="Main"
          className={`mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-3 py-2 transition-[background,box-shadow,border-color] duration-500 sm:px-4 ${
            scrolled || open ? "shadow-[0_10px_40px_-15px_rgba(0,0,0,0.8)] glass-strong" : "border border-transparent"
          }`}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="EventEase home"
            onClick={() => setOpen(false)}
          >
            <LogoMark className="h-9 w-9 transition-transform duration-500 hover:scale-110 hover:rotate-[-8deg]" />
            <Wordmark />
          </Link>

          <div ref={linksWrap} className="relative hidden items-center gap-1 md:flex">
            <span
              ref={pill}
              aria-hidden
              className="absolute top-0 left-0 h-full rounded-xl border border-white/10 bg-white/[0.07] opacity-0"
            />
            {links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                  className={`relative z-10 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    active ? "text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              {viewer ? (
                <AccountMenu viewer={viewer} />
              ) : (
                <>
                  <Link
                    href="/host/signin"
                    className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
                  >
                    Host portal
                  </Link>
                  <Magnetic>
                    <Link
                      href="/signin"
                      className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-aurora px-4 py-2 text-sm font-semibold text-ink-950 shadow-[0_8px_30px_-8px_rgba(124,92,255,0.8)]"
                    >
                      <span className="absolute inset-0 translate-x-[-120%] [transform:skewX(-20deg)] bg-white/40 transition-transform duration-700 group-hover:translate-x-[120%]" />
                      <span className="relative">Sign in</span>
                    </Link>
                  </Magnetic>
                </>
              )}
            </div>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 md:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="relative block h-3 w-5">
                <span
                  className={`absolute top-0 left-0 h-0.5 w-5 rounded bg-white transition-transform duration-300 ${open ? "translate-y-[5px] rotate-45" : ""}`}
                />
                <span
                  className={`absolute bottom-0 left-0 h-0.5 w-5 rounded bg-white transition-transform duration-300 ${open ? "-translate-y-[5px] -rotate-45" : ""}`}
                />
              </span>
            </button>
          </div>
        </nav>
      </header>

      {open && (
        <div
          id="mobile-menu"
          ref={menu}
          className="fixed inset-0 z-40 flex flex-col justify-center gap-2 px-8 pt-20 glass-strong md:hidden"
        >
          {links.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              data-menu-item
              onClick={() => setOpen(false)}
              className="flex items-baseline gap-4 border-b border-white/5 py-4 opacity-0"
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
            >
              <span className="font-mono text-xs text-cyan">0{i + 1}</span>
              <span
                className={`font-display text-3xl ${isActive(pathname, link.href) ? "text-gradient" : "text-white"}`}
              >
                {link.label}
              </span>
            </Link>
          ))}

          <div data-menu-item className="mt-6 opacity-0">
            {viewer ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">
                  Signed in as <span className="text-white">{viewer.name}</span>
                </p>
                <SignOutButton className="text-lg font-semibold text-danger" />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link href="/signin" onClick={() => setOpen(false)} className="font-display text-2xl text-white">
                  Attendee sign-in
                </Link>
                <Link href="/host/signin" onClick={() => setOpen(false)} className="font-display text-2xl text-pink">
                  Host sign-in
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
