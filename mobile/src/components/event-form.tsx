import { Ionicons } from "@expo/vector-icons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { ApiError, errorMessage, fieldError } from "@/lib/api";
import { formatDate, formatRange, formatTime } from "@/lib/format";
import { pickImage, type PickedImage } from "@/lib/images";
import {
  CALL_LANGUAGE_IDS,
  CALL_LANGUAGES,
  colors,
  EVENT_TYPE_IDS,
  EVENT_TYPES,
  PRIZE_TYPES,
  radius,
  REMINDER_LEAD_PRESETS,
  space,
  THEME_IDS,
  THEMES,
  type EventTypeId,
} from "@/lib/theme";
import type { EventSummary, Prize } from "@/lib/types";
import { EventCard } from "./event-card";
import { Button, Card, Chip, ErrorBox, Field, Muted, Row, Screen, SectionTitle, styles as ui } from "./ui";

export type EventFormValues = {
  name: string;
  type: EventTypeId;
  venue: string;
  description: string;
  startsAt: Date | null;
  endsAt: Date | null;
  capacity: string;
  entryFee: string;
  prizes: Prize[];
  theme: string;
  coverUrl: string | null;
  reminderEnabled: boolean;
  reminderLeadMinutes: number;
  reminderLanguage: string;
  reminderArriveEarly: string;
};

export const emptyEvent = (): EventFormValues => ({
  name: "",
  type: "OTHER",
  venue: "",
  description: "",
  startsAt: null,
  endsAt: null,
  capacity: "100",
  entryFee: "0",
  prizes: [],
  theme: "aurora",
  coverUrl: null,
  reminderEnabled: false,
  reminderLeadMinutes: 60,
  reminderLanguage: "auto",
  reminderArriveEarly: "10",
});

/** The body POST /api/events and PATCH /api/events/:id expect. */
export const toEventBody = (v: EventFormValues) => ({
  name: v.name.trim(),
  type: v.type,
  venue: v.venue.trim(),
  description: v.description.trim(),
  startsAt: v.startsAt?.toISOString() ?? "",
  endsAt: v.endsAt?.toISOString() ?? "",
  capacity: v.capacity,
  entryFee: v.entryFee || "0",
  prizes: v.prizes.filter((p) => p.title.trim() || p.reward.trim()).map((p) => ({ title: p.title.trim(), reward: p.reward.trim() })),
  theme: v.theme,
  reminderEnabled: v.reminderEnabled,
  reminderLeadMinutes: v.reminderLeadMinutes,
  reminderLanguage: v.reminderLanguage,
  reminderArriveEarly: v.reminderArriveEarly || "0",
});

const PRIZE_PRESETS: Prize[] = [
  { title: "🥇 1st place", reward: "" },
  { title: "🥈 2nd place", reward: "" },
  { title: "🥉 3rd place", reward: "" },
];
const DURATIONS = [1, 2, 3, 6, 24];
const CAPACITY_PRESETS = [30, 50, 100, 150, 300];

function pickDateTime(current: Date | null, onPick: (d: Date) => void, minimum?: Date) {
  const base = current ?? (() => {
    const d = new Date(Date.now() + 86_400_000);
    d.setHours(10, 0, 0, 0);
    return d;
  })();
  DateTimePickerAndroid.open({
    value: base,
    mode: "date",
    minimumDate: minimum,
    onChange: (event, date) => {
      if (event.type !== "set" || !date) return;
      DateTimePickerAndroid.open({
        value: base,
        mode: "time",
        is24Hour: false,
        onChange: (e2, time) => {
          if (e2.type !== "set" || !time) return;
          const picked = new Date(date);
          picked.setHours(time.getHours(), time.getMinutes(), 0, 0);
          onPick(picked);
        },
      });
    },
  });
}

const FIELD_LABELS: Record<string, string> = {
  name: "Event name",
  type: "Kind of event",
  venue: "Venue",
  description: "Description",
  startsAt: "Starts at",
  endsAt: "Ends at",
  capacity: "Capacity",
  entryFee: "Entry fee",
  prizes: "Prizes",
  theme: "Look",
  reminderLeadMinutes: "Reminder call",
  reminderLanguage: "Reminder call",
  reminderArriveEarly: "Reminder call",
};

/** "Prizes: Say what the winner gets" — the first problem, named, so the host knows where to scroll. */
function validationSummary(error: ApiError) {
  const [field, messages] = Object.entries(error.fields ?? {}).find(([, m]) => m?.length) ?? [];
  if (!field) return error.message || "Please check the form above.";
  const label = FIELD_LABELS[field.split(".")[0]] ?? "A field";
  return `${label}: ${messages![0]} (marked in red above)`;
}

function DateButton({ label, value, onPress, error, optional }: { label: string; value: Date | null; onPress: () => void; error?: string; optional?: boolean }) {
  return (
    <View style={{ flex: 1, marginBottom: space.lg }}>
      <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={ui.label}>{label}</Text>
        {optional && <Text style={{ color: colors.textFaint, fontSize: 12 }}>Optional</Text>}
      </Row>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[ui.input, { flexDirection: "row", alignItems: "center", gap: 8 }, !!error && { borderColor: colors.danger }]}
      >
        <Ionicons name="calendar-outline" size={17} color={colors.cyan} />
        {value ? (
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
              {formatDate(value)}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{formatTime(value)}</Text>
          </View>
        ) : (
          <Text style={{ color: colors.textFaint, fontSize: 15, flex: 1 }}>Pick date & time</Text>
        )}
      </Pressable>
      {error && <Text style={ui.error}>{error}</Text>}
    </View>
  );
}

type Props = {
  initial: EventFormValues;
  submitLabel: string;
  /** Saves the event; `cover` is a newly picked image, `null` = removed, `undefined` = unchanged. */
  onSubmit: (values: EventFormValues, cover: PickedImage | null | undefined) => Promise<void>;
};

export function EventForm({ initial, submitLabel, onSubmit }: Props) {
  const [v, setV] = useState<EventFormValues>(initial);
  const [cover, setCover] = useState<PickedImage | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const set = <K extends keyof EventFormValues>(k: K, value: EventFormValues[K]) => setV((f) => ({ ...f, [k]: value }));

  const pickType = (t: EventTypeId) => {
    set("type", t);
    if (PRIZE_TYPES.includes(t) && v.prizes.length === 0) set("prizes", PRIZE_PRESETS.map((p) => ({ ...p })));
  };

  const coverPreview = cover === undefined ? v.coverUrl : cover?.uri ?? null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(v, cover);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const preview: EventSummary = {
    id: "preview",
    name: v.name || "Your event name",
    description: v.description,
    venue: v.venue || "Venue",
    startsAt: (v.startsAt ?? new Date(Date.now() + 86_400_000)).toISOString(),
    endsAt: v.endsAt?.toISOString() ?? null,
    type: v.type,
    entryFee: Number(v.entryFee) || 0,
    prizes: v.prizes.filter((p) => p.reward.trim()),
    coverUrl: coverPreview,
    theme: v.theme,
    hostId: "",
    hostName: "",
    stats: { capacity: Number(v.capacity) || 0, registered: 0, checkedIn: 0, remaining: Number(v.capacity) || 0, fillRate: 0, attendanceRate: 0 },
  };
  const prizeErrors = error instanceof ApiError ? Object.entries(error.fields ?? {}).filter(([k]) => k.startsWith("prizes")) : [];

  return (
    <>
      <Screen>
        <SectionTitle>The basics</SectionTitle>
        <Field label="Event name" value={v.name} onChangeText={(t) => set("name", t)} maxLength={80} placeholder="TechFest 2026 — Hackathon Kickoff" error={fieldError(error, "name")} />
        <Text style={[ui.label, { marginBottom: 8 }]}>Kind of event</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: space.lg }}>
          {EVENT_TYPE_IDS.map((t) => (
            <Chip key={t} label={`${EVENT_TYPES[t].emoji} ${EVENT_TYPES[t].label}`} active={v.type === t} onPress={() => pickType(t)} />
          ))}
        </ScrollView>
        <Field label="Venue" value={v.venue} onChangeText={(t) => set("venue", t)} maxLength={120} placeholder="Main Auditorium, Block A" error={fieldError(error, "venue")} />
        <Field label="Description" optional multiline maxLength={600} value={v.description} onChangeText={(t) => set("description", t)} placeholder="Agenda, what to bring, eligibility…" />

        <SectionTitle>When</SectionTitle>
        <Row gap={space.md} style={{ alignItems: "flex-start" }}>
          <DateButton
            label="Starts at"
            value={v.startsAt}
            error={fieldError(error, "startsAt")}
            onPress={() =>
              pickDateTime(v.startsAt, (d) => {
                set("startsAt", d);
                if (!v.endsAt || v.endsAt <= d) set("endsAt", new Date(d.getTime() + 2 * 3600_000));
              }, new Date())
            }
          />
          <DateButton label="Ends at" optional value={v.endsAt} error={fieldError(error, "endsAt")} onPress={() => pickDateTime(v.endsAt ?? v.startsAt, (d) => set("endsAt", d), v.startsAt ?? undefined)} />
        </Row>
        {v.startsAt && (
          <Row style={{ flexWrap: "wrap", marginTop: -8, marginBottom: space.md }} gap={6}>
            {DURATIONS.map((h) => (
              <Chip key={h} label={h === 24 ? "All day" : `${h} h`} onPress={() => set("endsAt", new Date(v.startsAt!.getTime() + h * 3600_000))} />
            ))}
          </Row>
        )}
        {v.startsAt && <Muted style={{ marginBottom: space.md }}>🕒 {formatRange(v.startsAt.toISOString(), v.endsAt?.toISOString() ?? null)}</Muted>}

        <SectionTitle>Tickets & prizes</SectionTitle>
        <Row gap={space.md} style={{ alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Field label="Capacity" keyboardType="number-pad" value={v.capacity} onChangeText={(t) => set("capacity", t.replace(/\D/g, ""))} error={fieldError(error, "capacity")} />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Entry fee (₹)"
              keyboardType="number-pad"
              value={v.entryFee}
              onChangeText={(t) => set("entryFee", t.replace(/\D/g, ""))}
              hint={Number(v.entryFee) > 0 ? "Collected at the venue" : "0 = free"}
              error={fieldError(error, "entryFee")}
            />
          </View>
        </Row>
        <Row style={{ flexWrap: "wrap", marginTop: -8, marginBottom: space.lg }} gap={6}>
          {CAPACITY_PRESETS.map((n) => (
            <Chip key={n} label={`${n} seats`} active={v.capacity === String(n)} onPress={() => set("capacity", String(n))} />
          ))}
        </Row>

        <Text style={[ui.label, { marginBottom: 8 }]}>Prizes & awards</Text>
        {v.prizes.map((p, i) => (
          <Row key={i} gap={8} style={{ marginBottom: 8 }}>
            <TextInput
              value={p.title}
              onChangeText={(t) => set("prizes", v.prizes.map((x, j) => (j === i ? { ...x, title: t } : x)))}
              placeholder="Best UI/UX"
              placeholderTextColor={colors.textFaint}
              maxLength={40}
              accessibilityLabel={`Prize ${i + 1} name`}
              style={[ui.input, { flex: 1 }, prizeErrors.length > 0 && !p.title.trim() && { borderColor: colors.danger }]}
            />
            <TextInput
              value={p.reward}
              onChangeText={(t) => set("prizes", v.prizes.map((x, j) => (j === i ? { ...x, reward: t } : x)))}
              placeholder="₹10,000"
              placeholderTextColor={colors.textFaint}
              maxLength={80}
              accessibilityLabel={`Prize ${i + 1} reward`}
              style={[ui.input, { flex: 1.2 }, prizeErrors.length > 0 && !p.reward.trim() && { borderColor: colors.danger }]}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove prize ${i + 1}`} onPress={() => set("prizes", v.prizes.filter((_, j) => j !== i))} hitSlop={8}>
              <Ionicons name="close-circle" size={24} color={colors.textMuted} />
            </Pressable>
          </Row>
        ))}
        {prizeErrors.length > 0 && <Text style={[ui.error, { marginBottom: 8 }]}>{prizeErrors[0][1]?.[0] ?? "Check the prizes"}</Text>}
        <Row style={{ marginBottom: space.lg }}>
          <Chip label="+ Add prize" onPress={() => v.prizes.length < 10 && set("prizes", [...v.prizes, { title: "", reward: "" }])} />
          {v.prizes.length === 0 && <Chip label="🏆 1st / 2nd / 3rd" onPress={() => set("prizes", PRIZE_PRESETS.map((p) => ({ ...p })))} />}
        </Row>

        <SectionTitle>Look</SectionTitle>
        <Row style={{ flexWrap: "wrap", marginBottom: space.lg }} gap={10}>
          {THEME_IDS.map((t) => (
            <Pressable key={t} accessibilityRole="button" accessibilityLabel={`${THEMES[t].label} theme`} accessibilityState={{ selected: v.theme === t }} onPress={() => set("theme", t)}>
              <LinearGradient
                colors={[...THEMES[t].colors]}
                style={{ width: 46, height: 46, borderRadius: 23, borderWidth: v.theme === t ? 3 : 0, borderColor: colors.text, alignItems: "center", justifyContent: "center" }}
              >
                {v.theme === t && <Ionicons name="checkmark" size={20} color={colors.bg} />}
              </LinearGradient>
            </Pressable>
          ))}
        </Row>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={coverPreview ? "Change cover image" : "Add a cover image"}
          onPress={async () => {
            const img = await pickImage({ square: false, maxWidth: 1280 });
            if (img) setCover(img);
          }}
          style={{ height: 150, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgElevated }}
        >
          {coverPreview ? (
            <Image source={{ uri: coverPreview }} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <>
              <Ionicons name="image-outline" size={30} color={colors.textMuted} />
              <Muted style={{ marginTop: 6 }}>Add a cover image</Muted>
              <Muted style={{ fontSize: 12 }}>Shrunk on your phone to fit 300 KB</Muted>
            </>
          )}
        </Pressable>
        {coverPreview && (
          <Row style={{ marginTop: 8 }}>
            <Chip label="Remove cover" onPress={() => setCover(null)} />
          </Row>
        )}

        <SectionTitle>📞 Reminder call by Aanaya</SectionTitle>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>Schedule automatic reminder calls</Text>
              <Muted style={{ fontSize: 12, marginTop: 2 }}>Aanaya phones everyone with a mobile number, in under 20 seconds each.</Muted>
            </View>
            <Switch
              value={v.reminderEnabled}
              onValueChange={(on) => set("reminderEnabled", on)}
              trackColor={{ true: colors.success, false: colors.textFaint }}
              thumbColor={colors.text}
              accessibilityLabel="Schedule automatic reminder calls"
            />
          </Row>
          {v.reminderEnabled && (
            <View style={{ marginTop: space.lg }}>
              <Text style={[ui.label, { marginBottom: 8 }]}>Call them</Text>
              <Row style={{ flexWrap: "wrap", marginBottom: space.lg }} gap={6}>
                {REMINDER_LEAD_PRESETS.map((p) => (
                  <Chip key={p.minutes} label={`${p.label} before`} active={v.reminderLeadMinutes === p.minutes} onPress={() => set("reminderLeadMinutes", p.minutes)} />
                ))}
              </Row>
              <Text style={[ui.label, { marginBottom: 8 }]}>Language</Text>
              <Row style={{ flexWrap: "wrap", marginBottom: space.lg }} gap={6}>
                <Chip label="Each attendee's choice" active={v.reminderLanguage === "auto"} onPress={() => set("reminderLanguage", "auto")} />
                {CALL_LANGUAGE_IDS.map((l) => (
                  <Chip key={l} label={CALL_LANGUAGES[l].native} active={v.reminderLanguage === l} onPress={() => set("reminderLanguage", l)} />
                ))}
              </Row>
              <Field
                label="Ask them to arrive early by (min)"
                keyboardType="number-pad"
                value={v.reminderArriveEarly}
                onChangeText={(t) => set("reminderArriveEarly", t.replace(/\D/g, ""))}
                error={fieldError(error, "reminderArriveEarly") ?? fieldError(error, "reminderLeadMinutes")}
              />
            </View>
          )}
        </Card>

        <SectionTitle>Preview</SectionTitle>
        <EventCard event={preview} onPress={() => {}} />

        {!!error && !(error instanceof ApiError && error.code === "VALIDATION_ERROR") && (
          <View style={{ marginBottom: space.lg }}>
            <ErrorBox message={errorMessage(error)} />
          </View>
        )}
        {error instanceof ApiError && error.code === "VALIDATION_ERROR" && (
          <View style={{ marginBottom: space.lg }}>
            <ErrorBox message={validationSummary(error)} />
          </View>
        )}
        <Button title={submitLabel} icon="checkmark-circle-outline" size="lg" loading={busy} onPress={submit} />
      </Screen>
    </>
  );
}
