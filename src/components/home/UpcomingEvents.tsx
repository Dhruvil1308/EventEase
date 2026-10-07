import { connection } from "next/server";
import { EventGrid } from "@/components/events/EventGrid";
import { LinkButton } from "@/components/ui/Button";
import { listEvents } from "@/lib/services/events";
import { requestTime } from "@/lib/time";

export async function UpcomingEvents() {
  await connection();
  const now = requestTime();
  const events = await listEvents();
  const upcoming = events.filter((e) => new Date(e.startsAt).getTime() >= now - 6 * 3600_000).slice(0, 3);
  const shown = upcoming.length ? upcoming : events.slice(-3);

  if (!shown.length) {
    return (
      <div className="rounded-3xl p-10 text-center glass">
        <p className="font-display text-xl text-white">No events yet</p>
        <p className="mt-2 text-zinc-400">Create the first one — it takes about 20 seconds.</p>
        <LinkButton href="/events/new" className="mt-6">
          Create an event
        </LinkButton>
      </div>
    );
  }
  return <EventGrid events={shown} now={now} />;
}
