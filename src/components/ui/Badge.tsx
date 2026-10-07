import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "danger" | "warn" | "info" | "violet";

const tones: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/5 text-zinc-300",
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-danger/30 bg-danger/10 text-danger",
  warn: "border-warn/30 bg-warn/10 text-warn",
  info: "border-cyan/30 bg-cyan/10 text-cyan",
  violet: "border-violet-soft/30 bg-violet/15 text-violet-soft",
};

export function Badge({
  tone = "neutral",
  children,
  dot,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
