import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { EventForm, toEventBody, type EventFormValues } from "@/components/event-form";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { api, uploadImage } from "@/lib/api";
import { EVENT_TYPE_IDS, type EventTypeId } from "@/lib/theme";
import type { CallConsole, EventSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const summary = useApi<{ event: EventSummary }>(`/api/events/${id}`);
  // The edit replaces every field, so the current reminder schedule must be sent back too.
  const calls = useApi<CallConsole>(`/api/events/${id}/calls`);

  if ((summary.loading && !summary.data) || (calls.loading && !calls.data)) return <Loading />;
  if (!summary.data || !calls.data) {
    return (
      <Screen>
        <ErrorBox message={summary.error ?? calls.error ?? "This event couldn't be loaded."} onRetry={() => { summary.reload(); calls.reload(); }} />
      </Screen>
    );
  }

  const e = summary.data.event;
  const r = calls.data.event;
  const initial: EventFormValues = {
    name: e.name,
    type: (EVENT_TYPE_IDS.includes(e.type as EventTypeId) ? e.type : "OTHER") as EventTypeId,
    venue: e.venue,
    description: e.description,
    startsAt: new Date(e.startsAt),
    endsAt: e.endsAt ? new Date(e.endsAt) : null,
    capacity: String(e.stats.capacity),
    entryFee: String(e.entryFee),
    prizes: e.prizes,
    theme: e.theme,
    coverUrl: e.coverUrl,
    reminderEnabled: r.reminderEnabled,
    reminderLeadMinutes: r.reminderLeadMinutes,
    reminderLanguage: r.reminderLanguage,
    reminderArriveEarly: String(r.reminderArriveEarly),
  };

  return (
    <EventForm
      initial={initial}
      submitLabel="Save changes"
      onSubmit={async (values, cover) => {
        await api(`/api/events/${id}`, { method: "PATCH", body: toEventBody(values) });
        if (cover) await uploadImage(`/api/events/${id}/cover`, cover);
        else if (cover === null && e.coverUrl) await api(`/api/events/${id}/cover`, { method: "DELETE" });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.back();
      }}
    />
  );
}
