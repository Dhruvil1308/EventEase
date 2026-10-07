"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/motion/useAnimeScope";

const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => <SceneGlow />,
});

function SceneGlow() {
  return (
    <div className="absolute inset-0 grid place-items-center lg:pl-[45%]">
      <div className="h-72 w-72 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(124,92,255,0.35),transparent_65%)]" />
    </div>
  );
}

/**
 * Hosts the WebGL hero. Tracks how far the hero has been scrolled (0 → 1) for
 * the scroll-driven 3D choreography, and stops rendering when off-screen.
 */
export function HeroCanvas() {
  const wrap = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [active, setActive] = useState(true);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const span = Math.max(rect.height * 0.85, 1);
      progress.current = Math.min(Math.max(-rect.top / span, 0), 1);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      io.disconnect();
    };
  }, []);

  return (
    <div ref={wrap} aria-hidden className="absolute inset-x-0 bottom-0 h-[min(118vw,500px)] lg:inset-0 lg:h-auto">
      <HeroScene scroll={progress} reduced={reduced} active={active} />
    </div>
  );
}
