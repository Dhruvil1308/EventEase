import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ReminderConsole } from "@/components/calls/ReminderConsole";
import { PanelSkeleton } from "@/components/ui/Skeleton";
import { requireEventOwner } from "@/lib/auth";
import { getCallConsole } from "@/lib/services/reminders";

export const metadata: Metadata = { title: "Reminder calls" };

async function Console({ params }: { params: PageProps<"/events/[id]/calls">["params"] }) {
  await connection();
  const { id } = await params;
  // Shows every registrant's mobile number — owning host only.
  await requireEventOwner(id, `/events/${id}/calls`);
  const data = await getCallConsole(id);
  if (!data) notFound();
  return <ReminderConsole initial={data} />;
}

export default async function CallsPage({ params }: PageProps<"/events/[id]/calls">) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-6 sm:pt-32">
      <Suspense fallback={null}>
        <Breadcrumb params={params} />
      </Suspense>
      <Suspense fallback={<PanelSkeleton className="h-[720px]" />}>
        <Console params={params} />
      </Suspense>
    </div>
  );
}

async function Breadcrumb({ params }: { params: PageProps<"/events/[id]/calls">["params"] }) {
  const { id } = await params;
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-zinc-500">
      <Link href={`/events/${id}`} className="transition-colors hover:text-white">
        ← Event dashboard
      </Link>
    </nav>
  );
}
