"use client";

import { useEffect, useState } from "react";
import { formatRelative, formatTime } from "@/lib/format";

/** "2 minutes ago", refreshed every 20 s. Server render shows the clock time. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = requestAnimationFrame(tick);
    const id = setInterval(tick, 20_000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(id);
    };
  }, []);

  return (
    <time dateTime={iso} title={formatTime(iso)} className={className} suppressHydrationWarning>
      {now === null ? formatTime(iso) : formatRelative(iso, now)}
    </time>
  );
}
