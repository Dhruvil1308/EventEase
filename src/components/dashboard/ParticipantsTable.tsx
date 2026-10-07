"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Button";
import { formatTimeShort } from "@/lib/format";
import type { ParticipantRow } from "@/lib/services/registrations";

type Filter = "all" | "in" | "pending";

export function ParticipantsTable({
  participants,
  onCheckIn,
  busyCode,
}: {
  participants: ParticipantRow[];
  onCheckIn: (code: string) => void;
  busyCode: string | null;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^ee-?/, "");
    return participants.filter((p) => {
      if (filter === "in" && !p.checkedInAt) return false;
      if (filter === "pending" && p.checkedInAt) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.email.includes(q) ||
        (p.studentId ?? "").toLowerCase().includes(q) ||
        p.code.toLowerCase().replace(/-/g, "").includes(q.replace(/-/g, ""))
      );
    });
  }, [participants, query, filter]);

  const counts = {
    all: participants.length,
    in: participants.filter((p) => p.checkedInAt).length,
    pending: participants.filter((p) => !p.checkedInAt).length,
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex gap-1 rounded-xl border border-white/10 bg-ink-900/60 p-1"
          role="tablist"
          aria-label="Filter participants"
        >
          {(
            [
              ["all", "All"],
              ["in", "Checked in"],
              ["pending", "Not yet"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === id ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {label} <span className="ml-1 font-mono text-zinc-500">{counts[id]}</span>
            </button>
          ))}
        </div>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-ink-900/60 px-3 sm:w-72">
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-zinc-500" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.9 3.5l4.3 4.3a1 1 0 01-1.4 1.4l-4.3-4.3A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <span className="sr-only">Search participants</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, ID or code"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
          />
        </label>
      </div>

      <div className="mt-4 max-h-[560px] overflow-auto rounded-2xl border border-white/5">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-ink-850/95 text-xs tracking-wider text-zinc-500 uppercase backdrop-blur">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Participant
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Entry code
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-aurora text-xs font-bold text-ink-950">
                      {p.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{p.name}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {p.email}
                        {p.studentId ? ` · ${p.studentId}` : ""}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">{p.code}</td>
                <td className="px-4 py-3">
                  {p.checkedInAt ? (
                    <Badge tone="success">✓ In at {formatTimeShort(p.checkedInAt)}</Badge>
                  ) : (
                    <Badge tone="neutral">Not checked in</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/tickets/${p.code}`}
                      className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      Ticket
                    </Link>
                    {!p.checkedInAt && (
                      <button
                        type="button"
                        onClick={() => onCheckIn(p.code)}
                        disabled={busyCode !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 px-2.5 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success/25 disabled:opacity-50"
                      >
                        {busyCode === p.code && <Spinner className="h-3 w-3" />}
                        Check in
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-zinc-500">
                  {participants.length
                    ? "No participants match."
                    : "No registrations yet — share the registration link!"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
