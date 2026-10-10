import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Switch, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Avatar, Badge, Button, Card, Chip, ErrorBox, Eyebrow, Loading, Muted, Row, Screen, SectionTitle, Stat, styles as ui } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/format";
import { CALL_LANGUAGE_IDS, CALL_LANGUAGES, colors, radius, REMINDER_LEAD_PRESETS, space, type CallLanguage } from "@/lib/theme";
import type { CallConsole, CallRow, CallStatus, ReplyIntent, VoicePrompt } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const STATUS: Record<CallStatus, { label: string; color: string }> = {
  QUEUED: { label: "In queue", color: colors.violetSoft },
  DIALING: { label: "Dialling…", color: colors.cyan },
  RINGING: { label: "Ringing…", color: colors.cyan },
  IN_PROGRESS: { label: "On the call", color: colors.success },
  COMPLETED: { label: "Reached", color: colors.success },
  NO_ANSWER: { label: "No answer", color: colors.warn },
  BUSY: { label: "Busy / declined", color: colors.warn },
  FAILED: { label: "Failed", color: colors.danger },
  CANCELED: { label: "Canceled", color: colors.textMuted },
};
const INTENT: Record<ReplyIntent, { label: string; color: string }> = {
  CONFIRMED: { label: "👍 Coming", color: colors.success },
  DECLINED: { label: "✋ Can't come", color: colors.danger },
  UNSURE: { label: "🤔 Unsure", color: colors.warn },
  NO_RESPONSE: { label: "No reply", color: colors.textMuted },
};
const LIVE: CallStatus[] = ["QUEUED", "DIALING", "RINGING", "IN_PROGRESS"];

const maskPhone = (p: string) => p.replace(/(\+\d{2})(\d+)(\d{3})$/, (_, a, mid, b) => `${a} ${"•".repeat(Math.max(mid.length - 2, 3))}${b}`);

function Person({ row, canCall, onCall }: { row: CallRow; canCall: boolean; onCall: () => void }) {
  const last = row.lastCall;
  const live = last && LIVE.includes(last.status);
  return (
    <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
      <Row gap={space.md}>
        <Avatar name={row.name} url={row.avatarUrl} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>{row.name}</Text>
          <Muted style={{ fontSize: 12 }}>{row.phone ? `${maskPhone(row.phone)} · ${CALL_LANGUAGES[row.language as CallLanguage]?.native ?? row.language}` : "No mobile number"}</Muted>
        </View>
        {row.phone ? (
          <Button title={last ? "Again" : "Call"} icon="call" size="sm" variant="secondary" disabled={!canCall || !!live} onPress={onCall} />
        ) : (
          <Badge label="No number" color={colors.textMuted} />
        )}
      </Row>
      {last && (
        <Row gap={6} style={{ marginTop: 8, flexWrap: "wrap" }}>
          <Badge label={STATUS[last.status].label} color={STATUS[last.status].color} />
          {last.intent && <Badge label={INTENT[last.intent].label} color={INTENT[last.intent].color} />}
          <Muted style={{ fontSize: 12 }}>{timeAgo(last.at)}</Muted>
        </Row>
      )}
      {last?.transcript && <Muted style={{ marginTop: 6, fontStyle: "italic" }}>“{last.transcript}”</Muted>}
      {last?.error && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{last.error}</Text>}
    </View>
  );
}

function Preview({ eventId, canPreview }: { eventId: string; canPreview: boolean }) {
  const [language, setLanguage] = useState<CallLanguage>("hi");
  const [prompt, setPrompt] = useState<VoicePrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ prompt: VoicePrompt }>(`/api/events/${eventId}/reminders/preview`, { method: "POST", body: { language } });
      setPrompt(res.prompt);
      player.replace({ uri: res.prompt.audioUrl });
      player.play();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const total = prompt ? Math.ceil(prompt.durationMs / 1000) + prompt.replySeconds + 1 : 0;
  return (
    <Card strong>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>🎧 Hear what Aanaya says</Text>
      <Row style={{ marginTop: space.md, flexWrap: "wrap" }}>
        {CALL_LANGUAGE_IDS.map((l) => (
          <Chip key={l} label={CALL_LANGUAGES[l].native} active={language === l} onPress={() => { setLanguage(l); setPrompt(null); }} />
        ))}
      </Row>
      {prompt ? (
        <View style={{ marginTop: space.md }}>
          <Text style={{ color: colors.textSoft, lineHeight: 22, fontSize: 15 }}>{prompt.script}</Text>
          <Row gap={6} style={{ marginTop: space.md, flexWrap: "wrap" }}>
            <Badge label={`Message ${(prompt.durationMs / 1000).toFixed(1)}s`} color={colors.cyan} />
            <Badge label={`Reply window ${prompt.replySeconds}s`} color={colors.violetSoft} />
            <Badge label={`${total <= 20 ? "✓" : "!"} Call ≈ ${total}s / 20s`} color={total <= 20 ? colors.success : colors.danger} />
          </Row>
          <Button
            title={status.playing ? "Pause" : "Play again"}
            icon={status.playing ? "pause" : "play"}
            variant="secondary"
            style={{ marginTop: space.md }}
            onPress={() => {
              if (status.playing) player.pause();
              else {
                player.seekTo(0);
                player.play();
              }
            }}
          />
        </View>
      ) : (
        <Muted style={{ marginTop: space.md }}>Generates the exact script and Bulbul v3 voice the call will use — listen before anyone is dialled.</Muted>
      )}
      {error && <Text style={{ color: colors.danger, marginTop: space.sm }}>{error}</Text>}
      <Button
        title={prompt ? "Regenerate" : `Generate ${CALL_LANGUAGES[language].label} preview`}
        icon="sparkles-outline"
        loading={busy}
        disabled={!canPreview}
        style={{ marginTop: space.md }}
        onPress={generate}
      />
    </Card>
  );
}

export default function Calls() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, refreshing, reload, refetch } = useApi<CallConsole>(`/api/events/${id}/calls`, { poll: 3000 });
  const [skipReached, setSkipReached] = useState(true);
  const [batchLanguage, setBatchLanguage] = useState<CallLanguage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [schedule, setSchedule] = useState({ reminderEnabled: false, reminderLeadMinutes: 60, reminderLanguage: "auto", reminderArriveEarly: "10" });
  const [scheduleSaved, setScheduleSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSchedule((s) =>
      busy === "schedule"
        ? s
        : {
            reminderEnabled: data.event.reminderEnabled,
            reminderLeadMinutes: data.event.reminderLeadMinutes,
            reminderLanguage: data.event.reminderLanguage,
            reminderArriveEarly: String(data.event.reminderArriveEarly),
          },
    );
    // Only on first load and after saving — not on every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.event.reminderEnabled, data?.event.reminderLeadMinutes, data?.event.reminderLanguage, data?.event.reminderArriveEarly]);

  if (loading && !data) return <Loading />;
  if (!data) return <Screen><ErrorBox message={error ?? "The call console couldn't be loaded."} onRetry={reload} /></Screen>;

  const { stats, setup } = data;
  const toCall = data.rows.filter((r) => r.phone && !(skipReached && r.lastCall?.status === "COMPLETED")).length;

  async function start(registrationIds?: string[]) {
    setBusy(registrationIds ? registrationIds[0] : "all");
    try {
      await api(`/api/events/${id}/calls`, {
        method: "POST",
        body: { ...(registrationIds ? { registrationIds } : {}), ...(batchLanguage ? { language: batchLanguage } : {}), skipReached: registrationIds ? false : skipReached },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      refetch();
    } catch (e) {
      Alert.alert("Couldn't start the calls", errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function stop() {
    setBusy("stop");
    try {
      const res = await api<{ canceled: number }>(`/api/events/${id}/calls`, { method: "DELETE" });
      Alert.alert("Queue stopped", `${res.canceled} queued call(s) canceled.`);
      refetch();
    } catch (e) {
      Alert.alert("Couldn't stop the queue", errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveSchedule() {
    setBusy("schedule");
    try {
      await api(`/api/events/${id}/reminders`, { method: "PUT", body: { ...schedule, reminderArriveEarly: schedule.reminderArriveEarly || "0" } });
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      refetch();
    } catch (e) {
      Alert.alert("Couldn't save the schedule", errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Animated.View entering={FadeInDown.duration(400)}>
        <Eyebrow>Aanaya · AI voice agent</Eyebrow>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 4 }}>{data.event.name}</Text>
        <Muted>Gujarati · Hindi · English — every call under 20 seconds.</Muted>
      </Animated.View>

      {!setup.canCall && (
        <Card style={{ marginTop: space.lg, borderColor: "rgba(251,191,36,0.4)", backgroundColor: "rgba(251,191,36,0.07)" }}>
          <Text style={{ color: colors.warn, fontWeight: "800", marginBottom: 8 }}>Finish setting up Aanaya</Text>
          {setup.items.map((item) => (
            <Row key={item.key} gap={8} style={{ alignItems: "flex-start", marginBottom: 6 }}>
              <Ionicons name={item.ok ? "checkmark-circle" : "ellipse-outline"} size={18} color={item.ok ? colors.success : colors.warn} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textSoft }}>{item.label}</Text>
                {!item.ok && <Muted style={{ fontSize: 12 }}>{item.hint}</Muted>}
              </View>
            </Row>
          ))}
        </Card>
      )}

      <Row gap={space.sm} style={{ marginTop: space.lg }}>
        <Stat compact label="With mobile" value={`${stats.withPhone}/${stats.registrants}`} color={colors.cyan} />
        <Stat compact label="Reached" value={stats.reached} color={colors.success} />
        <Stat compact label="Coming" value={stats.confirmed} color={colors.success} />
      </Row>
      <Row gap={space.sm} style={{ marginTop: space.sm }}>
        <Stat compact label="Can't come" value={stats.declined} color={colors.danger} />
        <Stat compact label="Unreachable" value={stats.unreachable} color={colors.warn} />
        <Stat compact label="In queue" value={stats.queued + stats.live} color={colors.violetSoft} />
      </Row>

      <Card style={{ marginTop: space.lg }}>
        <Button
          title={`Call everyone one by one${toCall ? ` (${toCall})` : ""}`}
          icon="call"
          size="lg"
          loading={busy === "all"}
          disabled={!setup.canCall || toCall === 0}
          onPress={() =>
            Alert.alert("Call everyone?", `Aanaya will call ${toCall} people, one at a time. Each call uses your Vobiz balance.`, [
              { text: "Cancel", style: "cancel" },
              { text: "Start calling", onPress: () => start() },
            ])
          }
        />
        {stats.queued > 0 && <Button title={`Stop queue (${stats.queued} waiting)`} icon="stop-circle-outline" variant="danger" loading={busy === "stop"} style={{ marginTop: space.sm }} onPress={stop} />}
        <Row style={{ justifyContent: "space-between", marginTop: space.md }}>
          <Text style={{ color: colors.textSoft }}>Skip people already reached</Text>
          <Switch value={skipReached} onValueChange={setSkipReached} trackColor={{ true: colors.success, false: colors.textFaint }} thumbColor={colors.text} />
        </Row>
        <Text style={[ui.label, { marginTop: space.md, marginBottom: 6 }]}>Language for this batch</Text>
        <Row style={{ flexWrap: "wrap" }}>
          <Chip label="Event setting" active={!batchLanguage} onPress={() => setBatchLanguage(null)} />
          {CALL_LANGUAGE_IDS.map((l) => (
            <Chip key={l} label={CALL_LANGUAGES[l].native} active={batchLanguage === l} onPress={() => setBatchLanguage(l)} />
          ))}
        </Row>
      </Card>

      <SectionTitle right={<Muted>{data.rows.length}</Muted>}>Registrants</SectionTitle>
      {data.rows.length === 0 ? (
        <Muted style={{ textAlign: "center" }}>Nobody has registered yet.</Muted>
      ) : (
        data.rows.map((row) => (
          <Person
            key={row.registrationId}
            row={row}
            canCall={setup.canCall && busy === null}
            onCall={() =>
              Alert.alert(`Call ${row.name}?`, `Aanaya will phone ${row.phone} now.`, [
                { text: "Cancel", style: "cancel" },
                { text: "Call", onPress: () => start([row.registrationId]) },
              ])
            }
          />
        ))
      )}

      <SectionTitle>⏰ Scheduled reminder</SectionTitle>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>Call everyone automatically</Text>
          <Switch
            value={schedule.reminderEnabled}
            onValueChange={(on) => setSchedule((s) => ({ ...s, reminderEnabled: on }))}
            trackColor={{ true: colors.success, false: colors.textFaint }}
            thumbColor={colors.text}
          />
        </Row>
        {schedule.reminderEnabled && (
          <View style={{ marginTop: space.md }}>
            <Text style={[ui.label, { marginBottom: 6 }]}>Before the start</Text>
            <Row style={{ flexWrap: "wrap" }} gap={6}>
              {REMINDER_LEAD_PRESETS.map((p) => (
                <Chip key={p.minutes} label={p.label} active={schedule.reminderLeadMinutes === p.minutes} onPress={() => setSchedule((s) => ({ ...s, reminderLeadMinutes: p.minutes }))} />
              ))}
            </Row>
            <Text style={[ui.label, { marginTop: space.md, marginBottom: 6 }]}>Language</Text>
            <Row style={{ flexWrap: "wrap" }} gap={6}>
              <Chip label="Attendee's choice" active={schedule.reminderLanguage === "auto"} onPress={() => setSchedule((s) => ({ ...s, reminderLanguage: "auto" }))} />
              {CALL_LANGUAGE_IDS.map((l) => (
                <Chip key={l} label={CALL_LANGUAGES[l].native} active={schedule.reminderLanguage === l} onPress={() => setSchedule((s) => ({ ...s, reminderLanguage: l }))} />
              ))}
            </Row>
            <Row style={{ justifyContent: "space-between", marginTop: space.md }}>
              <Text style={{ color: colors.textSoft }}>Arrive early by (min)</Text>
              <TextInput
                value={schedule.reminderArriveEarly}
                onChangeText={(t) => setSchedule((s) => ({ ...s, reminderArriveEarly: t.replace(/\D/g, "") }))}
                keyboardType="number-pad"
                maxLength={3}
                style={[ui.input, { width: 80, height: 42, textAlign: "center" }]}
                accessibilityLabel="Arrive early by minutes"
              />
            </Row>
            <Muted style={{ marginTop: space.md, fontSize: 12 }}>Fires {formatDateTime(data.event.callAt)}</Muted>
          </View>
        )}
        <Button title={scheduleSaved ? "Saved ✓" : "Save schedule"} variant="secondary" loading={busy === "schedule"} style={{ marginTop: space.md }} onPress={saveSchedule} />
      </Card>

      <View style={{ marginTop: space.xl }}>
        <Preview eventId={id} canPreview={setup.canPreview} />
      </View>
    </Screen>
  );
}
