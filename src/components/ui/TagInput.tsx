"use client";

import { useState, type KeyboardEvent } from "react";

type Props = {
  id: string;
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
  error?: string;
  tone?: "cyan" | "pink" | "violet";
};

const TONES = {
  cyan: "border-cyan/30 bg-cyan/10 text-cyan",
  pink: "border-pink/30 bg-pink/10 text-pink",
  violet: "border-violet-soft/30 bg-violet/15 text-violet-soft",
};

/** Chips for skills and hobbies: type and press Enter or comma, Backspace removes the last. */
export function TagInput({
  id,
  label,
  value,
  onChange,
  suggestions = [],
  placeholder,
  max = 15,
  error,
  tone = "cyan",
}: Props) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, 32);
    if (!tag || value.length >= max || value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
      setDraft("");
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const remaining = suggestions.filter((s) => !value.some((t) => t.toLowerCase() === s.toLowerCase())).slice(0, 8);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="flex items-center justify-between text-sm font-medium text-zinc-200">
        <span>{label}</span>
        <span className="font-mono text-xs font-normal text-zinc-500">
          {value.length}/{max}
        </span>
      </label>
      <div
        className={`flex min-h-12 flex-wrap items-center gap-2 rounded-xl border bg-ink-900/70 px-3 py-2 transition-[border-color,box-shadow] duration-300 focus-within:border-violet-soft focus-within:shadow-[0_0_0_4px_rgba(124,92,255,0.18)] ${
          error ? "border-danger/60" : "border-white/10 hover:border-white/20"
        }`}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="opacity-70 transition-opacity hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) {
              add(v.slice(0, -1));
              setDraft("");
            } else setDraft(v);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            add(draft);
            setDraft("");
          }}
          placeholder={value.length ? "" : placeholder}
          disabled={value.length >= max}
          aria-invalid={Boolean(error)}
          className="min-w-32 flex-1 bg-transparent text-[0.95rem] text-white outline-none placeholder:text-zinc-500"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : remaining.length ? (
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
