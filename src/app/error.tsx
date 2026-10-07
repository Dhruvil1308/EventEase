"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center px-6 pt-24 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-danger/15 text-3xl">⚠️</div>
      <h1 className="mt-6 font-display text-2xl font-semibold text-white">Something went wrong</h1>
      <p className="mt-3 text-zinc-400">
        We couldn&apos;t load this page. If you just set up the project, make sure the database exists by running{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-cyan">npm run setup</code>.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <LinkButton href="/" variant="secondary">
          Go home
        </LinkButton>
      </div>
    </div>
  );
}
