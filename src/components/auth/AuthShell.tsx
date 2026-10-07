import type { ReactNode } from "react";

/** Centered, quiet frame for the sign-in and sign-up portals. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <section className="relative flex min-h-[100svh] items-center justify-center px-6 py-28">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-40" />
      {children}
    </section>
  );
}
