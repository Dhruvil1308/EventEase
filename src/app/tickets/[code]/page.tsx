import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TicketView } from "@/components/tickets/TicketView";
import { Skeleton } from "@/components/ui/Skeleton";
import { qrSvg } from "@/lib/qr";
import { getTicket } from "@/lib/services/registrations";

export const metadata: Metadata = { title: "Your ticket" };

async function Ticket({ params, searchParams }: PageProps<"/tickets/[code]">) {
  await connection();
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const ticket = await getTicket(decodeURIComponent(code));
  if (!ticket) notFound();
  const svg = await qrSvg(ticket.code);

  return (
    <TicketView
      isNew={query.new === "1"}
      qrSvg={svg}
      ticket={{
        code: ticket.code,
        name: ticket.name,
        email: ticket.email,
        studentId: ticket.studentId,
        department: ticket.department,
        checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
        createdAt: ticket.createdAt.toISOString(),
        event: {
          id: ticket.event.id,
          name: ticket.event.name,
          venue: ticket.event.venue,
          startsAt: ticket.event.startsAt.toISOString(),
          theme: ticket.event.theme,
        },
      }}
    />
  );
}

export default function TicketPage(props: PageProps<"/tickets/[code]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-28 pb-10 sm:px-6 sm:pt-32">
      <Suspense
        fallback={
          <div className="mx-auto max-w-md">
            <Skeleton className="h-[640px] rounded-[2rem]" />
          </div>
        }
      >
        <Ticket {...props} />
      </Suspense>
    </div>
  );
}
