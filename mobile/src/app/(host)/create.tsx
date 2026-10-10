import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { emptyEvent, EventForm, toEventBody } from "@/components/event-form";
import { api, errorMessage, uploadImage } from "@/lib/api";
import type { EventSummary } from "@/lib/types";

export default function CreateEvent() {
  // A fresh form each time an event is created.
  const [formKey, setFormKey] = useState(0);
  return (
    <EventForm
      key={formKey}
      initial={emptyEvent()}
      submitLabel="Create event"
      onSubmit={async (values, cover) => {
        const { event } = await api<{ event: EventSummary }>("/api/events", { method: "POST", body: toEventBody(values) });
        if (cover) {
          try {
            await uploadImage(`/api/events/${event.id}/cover`, cover);
          } catch (e) {
            Alert.alert("Event created", `The cover image couldn't be uploaded: ${errorMessage(e)} You can add it from Edit.`);
          }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setFormKey((k) => k + 1);
        router.push({ pathname: "/manage/[id]", params: { id: event.id, created: "1" } });
      }}
    />
  );
}
