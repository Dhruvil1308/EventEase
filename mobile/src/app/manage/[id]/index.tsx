import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, Share, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { DateBlock, EventBanner, eventState } from "@/components/event-card";
import { Badge, Button, Card, ErrorBox, Loading, Muted, ProgressBar, Row, Screen, SectionTitle, styles as ui } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { registrationLink } from "@/lib/config";
import { shareCsv } from "@/lib/files";
import { formatDate, formatRange, formatTime, percent, timeAgo } from "@/lib/format";
import { colors, eventType, radius, space, themeColors } from "@/lib/theme";
import type { EventLive, EventSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const RESULT = {
  SUCCESS: { label: "Granted", color: colors.success, icon: "checkmark-circle" },
  DUPLICATE: { label: "Duplicate", color: colors.danger, icon: "close-circle" },
  INVALID: { label: "Invalid", color: colors.warn, icon: "alert-circle" },
  WRONG_EVENT: { label: "Wrong event", color: colors.warn, icon: "swap-horizontal" },
} as const;

function Action({ icon, label, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        { width: "31.5%", alignItems: "center", paddingVertical: space.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
        pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
      ]}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${color}22`, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={{ color: colors.textSoft, fontSize: 12, fontWeight: "600", marginTop: 6, textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

export default function ManageEvent() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const summary = useApi<{ event: EventSummary }>(`/api/events/${id}`);
  const live = useApi<EventLive>(`/api/events/${id}/live`, { poll: 4000 });
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  const participants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (live.data?.participants ?? []).filter((p) => !q || `${p.name} ${p.email} ${p.code} ${p.studentId ?? ""}`.toLowerCase().includes(q));
  }, [live.data, query]);

  if (summary.loading && !summary.data) return <Loading />;
  if (!summary.data) return <Screen><ErrorBox message={summary.error ?? "This event couldn't be loaded."} onRetry={summary.reload} /></Screen>;

  const e = summary.data.event;
  const stats = live.data?.stats ?? e.stats;
  const gate = live.data?.gate ?? { SUCCESS: 0, DUPLICATE: 0, INVALID: 0, WRONG_EVENT: 0 };
  const state = eventState({ ...e, stats });
  const type = eventType(e.type);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await shareCsv(`/api/events/${id}/export`, `${e.name.replace(/[^\w]+/g, "-").toLowerCase()}-attendance.csv`);
    } catch (err) {
      Alert.alert("Couldn't export", errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert("Delete this event?", "This removes the event, every registration and its gate log. It can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete everything",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/events/${id}`, { method: "DELETE" });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            router.dismissTo("/(host)/dashboard");
          } catch (err) {
            Alert.alert("Couldn't delete", errorMessage(err));
          }
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: "", headerTransparent: true }} />
      <Screen refreshing={summary.refreshing} onRefresh={() => { summary.reload(); live.refetch(); }} contentStyle={{ padding: 0 }}>
        <EventBanner event={e} height={190} />
        <View style={{ padding: space.lg, marginTop: -70 }}>
          <Animated.View entering={FadeInDown.duration(450)}>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
              <DateBlock startsAt={e.startsAt} theme={e.theme} />
              <Row gap={6}>
                <Badge label={`${type.emoji} ${type.label}`} color={colors.violetSoft} />
                <Badge label={state.label} color={state.color} />
              </Row>
            </Row>
            <Text style={{ color: colors.text, fontSize: 25, fontWeight: "800", marginTop: space.md }}>{e.name}</Text>
            <Muted>
              {formatDate(e.startsAt)} · {formatRange(e.startsAt, e.endsAt)} · {e.venue}
            </Muted>
          </Animated.View>

          {created && (
            <Animated.View entering={FadeInDown.delay(100)}>
              <Card style={{ marginTop: space.lg, borderColor: "rgba(52,211,153,0.4)", backgroundColor: "rgba(52,211,153,0.08)" }}>
                <Text style={{ color: colors.success, fontWeight: "800", fontSize: 16 }}>🎉 Event created!</Text>
                <Muted style={{ marginTop: 4 }}>Share the registration link so students can sign up.</Muted>
                <Button
                  title="Share registration link"
                  icon="share-social-outline"
                  variant="success"
                  size="sm"
                  style={{ marginTop: space.md }}
                  onPress={() => Share.share({ message: `Register for ${e.name}: ${registrationLink(e.id)}` })}
                />
              </Card>
            </Animated.View>
          )}

          {/* Live numbers */}
          <Animated.View entering={FadeInDown.delay(120).duration(450)}>
            <Card strong style={{ marginTop: space.lg }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Text style={{ color: colors.textSoft, fontWeight: "700" }}>Registered</Text>
                <Row gap={6}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
                  <Muted style={{ fontSize: 12 }}>Live</Muted>
                </Row>
              </Row>
              <Text style={{ color: colors.text, fontSize: 34, fontWeight: "800", marginTop: 4 }}>
                {stats.registered}
                <Text style={{ color: colors.textMuted, fontSize: 18 }}> / {stats.capacity}</Text>
              </Text>
              <ProgressBar value={stats.fillRate} colorsList={themeColors(e.theme)} />
              <Row style={{ justifyContent: "space-between", marginTop: space.lg }}>
                <View>
                  <Text style={{ color: colors.success, fontSize: 24, fontWeight: "800" }}>{stats.checkedIn}</Text>
                  <Muted style={{ fontSize: 12 }}>checked in · {percent(stats.attendanceRate)}</Muted>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.cyan, fontSize: 24, fontWeight: "800" }}>{stats.remaining}</Text>
                  <Muted style={{ fontSize: 12 }}>seats left</Muted>
                </View>
              </Row>
            </Card>
            <Row gap={space.sm} style={{ marginTop: space.sm }}>
              {(Object.keys(RESULT) as (keyof typeof RESULT)[]).map((k) => (
                <Card key={k} style={{ flex: 1, padding: space.md, alignItems: "center" }}>
                  <Text style={{ color: RESULT[k].color, fontSize: 20, fontWeight: "800" }}>{gate[k]}</Text>
                  <Muted style={{ fontSize: 11, textAlign: "center" }}>{RESULT[k].label}</Muted>
                </Card>
              ))}
            </Row>
          </Animated.View>

          {/* Actions */}
          <SectionTitle>Manage</SectionTitle>
          <Row style={{ flexWrap: "wrap", justifyContent: "space-between" }} gap={8}>
            <Action icon="scan-outline" label="Open gate" color={colors.pink} onPress={() => router.navigate({ pathname: "/(host)/gate", params: { event: e.id } })} />
            <Action icon="call-outline" label="Reminder calls" color={colors.cyan} onPress={() => router.push(`/manage/${e.id}/calls`)} />
            <Action icon="create-outline" label="Edit" color={colors.violetSoft} onPress={() => router.push(`/manage/${e.id}/edit`)} />
            <Action icon="link-outline" label="Share link" color={colors.success} onPress={() => Share.share({ message: `Register for ${e.name}: ${registrationLink(e.id)}` })} />
            <Action icon={exporting ? "hourglass-outline" : "download-outline"} label="Export CSV" color={colors.warn} onPress={exportCsv} />
            <Action icon="trash-outline" label="Delete" color={colors.danger} onPress={confirmDelete} />
          </Row>

          {/* Participants */}
          <SectionTitle right={<Muted>{live.data?.participants.length ?? 0}</Muted>}>Participants</SectionTitle>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search name, email, code" placeholderTextColor={colors.textFaint} style={[ui.input, { marginBottom: space.md }]} accessibilityLabel="Search participants" />
          {live.error && !live.data && <ErrorBox message={live.error} onRetry={live.reload} />}
          {participants.length === 0 ? (
            <Muted style={{ textAlign: "center", paddingVertical: space.lg }}>{query ? "No one matches that search." : "No registrations yet — share the link!"}</Muted>
          ) : (
            participants.slice(0, 60).map((p) => (
              <Row key={p.id} style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }} gap={space.md}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{p.name}</Text>
                  <Muted style={{ fontSize: 12 }} >
                    {p.code} · {p.email}
                  </Muted>
                </View>
                {p.checkedInAt ? <Badge label={`In ${formatTime(p.checkedInAt)}`} color={colors.success} /> : <Badge label="Not yet" color={colors.textMuted} />}
              </Row>
            ))
          )}
          {participants.length > 60 && <Muted style={{ textAlign: "center" }}>Showing 60 of {participants.length} — search to narrow down, or export the CSV.</Muted>}

          {/* Activity */}
          {(live.data?.activity.length ?? 0) > 0 && (
            <>
              <SectionTitle>Gate activity</SectionTitle>
              {live.data!.activity.map((a) => {
                const r = RESULT[a.result];
                return (
                  <Row key={a.id} gap={space.md} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Ionicons name={r.icon} size={20} color={r.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textSoft, fontWeight: "600" }}>{a.name ?? a.code}</Text>
                      <Muted style={{ fontSize: 12 }}>{r.label}</Muted>
                    </View>
                    <Muted style={{ fontSize: 12 }}>{timeAgo(a.createdAt)}</Muted>
                  </Row>
                );
              })}
            </>
          )}
        </View>
      </Screen>
    </>
  );
}
