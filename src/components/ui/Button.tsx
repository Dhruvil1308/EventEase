import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "group relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold transition-[transform,box-shadow,background,color,border-color] duration-300 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-aurora text-ink-950 shadow-[0_10px_35px_-10px_rgba(124,92,255,0.9)] hover:shadow-[0_14px_45px_-8px_rgba(34,211,238,0.75)]",
  secondary: "glass text-white hover:border-white/20 hover:bg-white/10",
  ghost: "text-zinc-300 hover:bg-white/5 hover:text-white",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-7 text-base",
};

function Shine({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 translate-x-[-120%] [transform:skewX(-20deg)] bg-white/40 transition-transform duration-700 group-hover:translate-x-[120%]"
    />
  );
}

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      <Shine show={variant === "primary"} />
      {loading && <Spinner />}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function LinkButton({ variant = "primary", size = "md", className = "", children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      <Shine show={variant === "primary"} />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`relative animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
