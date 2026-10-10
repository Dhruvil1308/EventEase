import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { EventGrid } from "@/components/events/EventGrid";
import { LinkButton } from "@/components/ui/Button";
import { eventEndMs } from "@/lib/event-time";
import { listEvents, type EventSummary } from "@/lib/services/events";
import { requestTime } from "@/lib/time";

export async function UpcomingEvents() {
  await connection();
  const now = requestTime();
  let events: EventSummary[];
  try {
    events = await listEvents();
  } catch (error) {
    unstable_rethrow(error);
    // Same as the live stats: degrade this section, keep the page.
    console.warn("[home] upcoming events unavailable:", error instanceof Error ? error.message : error);
    return (
      <div role="status" className="rounded-3xl p-10 text-center glass">
        <p className="font-display text-xl text-white">Events are taking a moment to load</p>
        <p className="mt-2 text-zinc-400">Refresh in a few seconds, or open the full list.</p>
        <LinkButton href="/events" variant="secondary" className="mt-6">
          Browse all events
        </LinkButton>
      </div>
    );
  }
  const upcoming = events.filter((e) => eventEndMs(e) >= now).slice(0, 3);
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
