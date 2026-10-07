"use client";

import { animate } from "animejs";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { EventSummary } from "@/lib/services/events";
import { EventGrid } from "./EventGrid";
import type { CardViewer } from "./EventCard";
import { eventStatus } from "./EventCard";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "full", label: "Full" },
  { id: "ended", label: "Ended" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export function EventsBrowser({ events, now, viewer }: { events: EventSummary[]; now: number; viewer?: CardViewer }) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const tabs = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      const status = eventStatus(e, now).label;
      const matchesFilter =
        filter === "all" ||
        (filter === "open" && (status === "Open" || status === "Almost full")) ||
        (filter === "full" && status === "Full") ||
        (filter === "ended" && status === "Ended");
      const matchesQuery = !q || e.name.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [events, filter, query, now]);

  useLayoutEffect(() => {
    const active = tabs.current?.querySelector<HTMLElement>(`[data-filter="${filter}"]`);
    if (!active || !pill.current) return;
    animate(pill.current, { x: active.offsetLeft, width: active.offsetWidth, duration: 550, ease: "out(4)" });
  }, [filter]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          ref={tabs}
          role="tablist"
          aria-label="Filter events"
          className="relative inline-flex rounded-2xl p-1 glass"
        >
          <span
            ref={pill}
            aria-hidden
            className="absolute top-1 left-0 h-[calc(100%-0.5rem)] rounded-xl bg-aurora opacity-90"
          />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              data-filter={f.id}
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`relative z-10 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                filter === f.id ? "text-ink-950" : "text-zinc-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex h-11 items-center gap-2 rounded-2xl px-4 glass sm:w-72">
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-zinc-500" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.9 3.5l4.3 4.3a1 1 0 01-1.4 1.4l-4.3-4.3A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <span className="sr-only">Search events</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or venue"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
          />
        </label>
      </div>

      <div className="mt-10">
        {visible.length ? (
          <EventGrid events={visible} now={now} viewer={viewer} />
        ) : (
          <div className="rounded-3xl px-6 py-16 text-center glass">
            <p className="font-display text-xl text-white">Nothing here</p>
            <p className="mt-2 text-zinc-400">No events match this filter{query ? ` and “${query}”` : ""}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
