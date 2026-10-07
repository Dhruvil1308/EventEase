"use client";

import { animate } from "animejs";
import { useEffect, useRef } from "react";
import { RESULT_META } from "@/components/checkin/resultMeta";
import { RelativeTime } from "@/components/ui/RelativeTime";
import type { ActivityItem } from "@/lib/services/checkin";

/** Gate log. Items that arrive via live polling slide in and flash. */
export function ActivityFeed({ items, showEvent = false }: { items: ActivityItem[]; showEvent?: boolean }) {
  const list = useRef<HTMLOListElement>(null);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const known = seen.current;
    const fresh = known ? items.filter((i) => !known.has(i.id)) : [];
    seen.current = new Set(items.map((i) => i.id));
    if (!fresh.length || !list.current) return;
    const els = fresh
      .map((i) => list.current!.querySelector<HTMLElement>(`[data-id="${i.id}"]`))
      .filter((el): el is HTMLElement => Boolean(el));
    animate(els, {
      opacity: [0, 1],
      x: [-30, 0],
      backgroundColor: ["rgba(124,92,255,0.25)", "rgba(124,92,255,0)"],
      duration: 1200,
      ease: "out(4)",
    });
  }, [items]);

  if (!items.length) {
    return (
      <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-zinc-500">
        <div>
          <p>No scans yet.</p>
          <p className="mt-1">Gate activity will appear here in real time.</p>
        </div>
      </div>
    );
  }

  return (
    <ol ref={list} className="space-y-1.5" aria-live="polite">
      {items.map((item) => {
        const meta = RESULT_META[item.result];
        return (
          <li key={item.id} data-id={item.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${meta.border} ${meta.bg} ${meta.text}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={meta.icon} />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white">
                {item.name ?? <span className="font-mono text-zinc-400">{item.code}</span>}
              </p>
              <p className={`truncate text-xs ${meta.text}`}>
                {meta.short}
                {showEvent && item.eventName ? <span className="text-zinc-500"> · {item.eventName}</span> : null}
              </p>
            </div>
            <RelativeTime iso={item.createdAt} className="shrink-0 text-xs text-zinc-500" />
          </li>
        );
      })}
    </ol>
  );
}
