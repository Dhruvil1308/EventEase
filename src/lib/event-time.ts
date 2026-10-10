/**
 * When an event counts as over: its end time, or — for events created before
 * end times existed — six hours after the start.
 */
export function eventEndMs(event: { startsAt: string | Date; endsAt?: string | Date | null }): number {
  return event.endsAt ? new Date(event.endsAt).getTime() : new Date(event.startsAt).getTime() + 6 * 3600_000;
}
