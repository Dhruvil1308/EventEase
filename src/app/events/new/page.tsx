import type { Metadata } from "next";
import { CreateEventForm } from "@/components/events/CreateEventForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Create an event" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-36 pb-10">
      <PageHeader
        eyebrow="New event"
        eyebrowClass="text-pink"
        title="Create an event."
        description="Set the basics and a participant capacity. Registration, QR tickets and the check-in gate are ready the moment you hit create."
      />
      <CreateEventForm />
    </div>
  );
}
