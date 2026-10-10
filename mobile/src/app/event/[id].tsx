import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Share, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { DateBlock, EventBanner, eventState } from "@/components/event-card";
import { Badge, Button, Card, Chip, ErrorBox, Field, IconButton, Loading, Muted, ProgressBar, Row, Screen, SectionTitle } from "@/components/ui";
import { api, ApiError, errorMessage, fieldError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { registrationLink } from "@/lib/config";
import { formatDateLong, formatFee, formatRange, hasEnded, percent } from "@/lib/format";
import { CALL_LANGUAGE_IDS, CALL_LANGUAGES, colors, eventType, radius, space, themeColors, type CallLanguage } from "@/lib/theme";
import type { EventSummary, MyTicket } from "@/lib/types";
import { useApi } from "@/lib/use-api";

function Detail({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <Row gap={12} style={{ alignItems: "flex-start", marginBottom: space.md }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.cardStrong, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={17} color={colors.cyan} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: "600" }}>{label}</Text>
        <Text style={{ color: colors.textSoft, fontSize: 15, marginTop: 2 }}>{value}</Text>
      </View>
    </Row>
  );
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const attendee = profile?.role === "ATTENDEE";
  const { data, error, loading, refreshing, reload } = useApi<{ event: EventSummary }>(`/api/events/${id}`);
  const tickets = useApi<{ tickets: MyTicket[] }>(attendee ? "/api/me/tickets" : null, { enabled: attendee });
  const mine = tickets.data?.tickets.find((t) => t.event.id === id);

  const [form, setForm] = useState({ name: "", studentId: "", department: "", phone: "" });
  const [language, setLanguage] = useState<CallLanguage>("hi");
  const [busy, setBusy] = useState(false);
  const [regError, setRegError] = useState<unknown>(null);

  // Pre-fill from the profile, like the website.
  useEffect(() => {
    if (!profile) return;
    setForm({ name: profile.name, studentId: profile.studentId ?? "", department: profile.department ?? "", phone: profile.phone ?? "" });
    if (profile.callLanguage in CALL_LANGUAGES) setLanguage(profile.callLanguage as CallLanguage);
  }, [profile]);

  if (loading && !data) return <Loading />;
  if (!data) return <Screen><ErrorBox message={error ?? "This event couldn't be loaded."} onRetry={reload} /></Screen>;

  const e = data.event;
  const state = eventState(e);
  const type = eventType(e.type);
  const ended = hasEnded(e.startsAt, e.endsAt);
  const full = e.stats.remaining <= 0;
  const isOwner = profile?.role === "HOST" && profile.id === e.hostId;

  async function register() {
    if (!profile) return;
    setBusy(true);
    setRegError(null);
    try {
      const res = await api<{ registration: { code: string } }>(`/api/events/${id}/registrations`, {
        method: "POST",
        body: {
          name: form.name.trim(),
          email: profile.email,
          studentId: form.studentId.trim() || undefined,
          department: form.department.trim() || undefined,
          phone: form.phone.trim() || undefined,
          callLanguage: language,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace({ pathname: "/ticket/[code]", params: { code: res.registration.code, fresh: "1" } });
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_REGISTERED") {
        await tickets.refetch();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      setRegError(err);
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerTransparent: true,
          headerRight: () => (
            <IconButton
              icon="share-social-outline"
              label="Share event"
              onPress={() => Share.share({ message: `${e.name} — register on EventEase: ${registrationLink(e.id)}` })}
            />
          ),
        }}
      />
      <Screen refreshing={refreshing} onRefresh={reload} contentStyle={{ padding: 0 }}>
        <EventBanner event={e} height={230} />
        <View style={{ padding: space.lg, marginTop: -70 }}>
          <Animated.View entering={FadeInDown.duration(500)}>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
              <DateBlock startsAt={e.startsAt} theme={e.theme} />
              <Row gap={6}>
                <Badge label={`${type.emoji} ${type.label}`} color={colors.violetSoft} />
                <Badge label={state.label} color={state.color} />
              </Row>
            </Row>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800", marginTop: space.lg, letterSpacing: -0.5 }}>{e.name}</Text>
            <Muted style={{ marginTop: 4 }}>Hosted by {e.hostName}</Muted>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <Card style={{ marginTop: space.xl }}>
              <Detail icon="calendar-outline" label="When" value={`${formatDateLong(e.startsAt)}\n${formatRange(e.startsAt, e.endsAt)}`} />
              <Detail icon="location-outline" label="Where" value={e.venue} />
              <Detail icon="pricetag-outline" label="Entry" value={e.entryFee > 0 ? `${formatFee(e.entryFee)} at the venue` : "Free"} />
              <Row style={{ justifyContent: "space-between", marginTop: space.sm, marginBottom: 8 }}>
                <Text style={{ color: colors.textSoft, fontWeight: "700" }}>
                  {e.stats.registered} / {e.stats.capacity} seats taken
                </Text>
                <Muted>{full ? "Full" : `${e.stats.remaining} left · ${percent(e.stats.fillRate)}`}</Muted>
              </Row>
              <ProgressBar value={e.stats.fillRate} colorsList={themeColors(e.theme)} />
            </Card>
          </Animated.View>

          {e.prizes.length > 0 && (
            <Animated.View entering={FadeInDown.delay(160).duration(500)}>
              <SectionTitle>🏆 Prizes</SectionTitle>
              {e.prizes.map((p, i) => (
                <Row key={i} style={{ justifyContent: "space-between", padding: 14, borderRadius: radius.md, backgroundColor: "rgba(251,191,36,0.08)", borderWidth: 1, borderColor: "rgba(251,191,36,0.25)", marginBottom: 8 }}>
                  <Text style={{ color: colors.textSoft, fontWeight: "600", flex: 1 }}>{p.title}</Text>
                  <Text style={{ color: colors.warn, fontWeight: "800" }}>{p.reward}</Text>
                </Row>
              ))}
            </Animated.View>
          )}

          {!!e.description && (
            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <SectionTitle>About</SectionTitle>
              <Text style={{ color: colors.textSoft, fontSize: 15, lineHeight: 23 }}>{e.description}</Text>
            </Animated.View>
          )}

          <View style={{ marginTop: space.xl }}>
            {isOwner ? (
              <Button title="Open event dashboard" icon="speedometer-outline" size="lg" onPress={() => router.push(`/manage/${e.id}`)} />
            ) : !attendee ? (
              <Card>
                <Muted>Hosts can't register for events. Sign in with an attendee account to get a ticket.</Muted>
              </Card>
            ) : mine ? (
              <Button title="View my QR ticket" icon="qr-code-outline" size="lg" onPress={() => router.push(`/ticket/${mine.code}`)} />
            ) : ended || full ? (
              <Card>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Registration closed</Text>
                <Muted style={{ marginTop: 4 }}>{ended ? "This event has already taken place." : `All ${e.stats.capacity} seats are taken.`}</Muted>
              </Card>
            ) : (
              <Card strong>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 18, marginBottom: space.lg }}>Your details</Text>
                <Field label="Full name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} error={fieldError(regError, "name")} />
                <Row gap={space.md} style={{ alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Student ID" optional value={form.studentId} autoCapitalize="characters" onChangeText={(v) => setForm((f) => ({ ...f, studentId: v }))} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Department" optional value={form.department} onChangeText={(v) => setForm((f) => ({ ...f, department: v }))} />
                  </View>
                </Row>
                <Field
                  label="Mobile number"
                  optional
                  keyboardType="phone-pad"
                  value={form.phone}
                  onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                  placeholder="+91 98765 43210"
                  hint="📞 Aanaya may call you with a quick reminder before the event."
                  error={fieldError(regError, "phone")}
                />
                <Text style={{ color: colors.textSoft, fontWeight: "600", marginBottom: 8 }}>Call me in</Text>
                <Row style={{ marginBottom: space.lg, flexWrap: "wrap" }}>
                  {CALL_LANGUAGE_IDS.map((l) => (
                    <Chip key={l} label={CALL_LANGUAGES[l].native} active={language === l} onPress={() => setLanguage(l)} />
                  ))}
                </Row>
                {/* Validation errors show under their fields; anything else (full, duplicate, offline) here. */}
                {!!regError && !(regError instanceof ApiError && regError.code === "VALIDATION_ERROR") && (
                  <View style={{ marginBottom: space.lg }}>
                    <ErrorBox message={errorMessage(regError)} />
                  </View>
                )}
                <Button title="Register & get my QR ticket" icon="ticket-outline" size="lg" loading={busy} onPress={register} />
                <Muted style={{ textAlign: "center", marginTop: space.md, fontSize: 12 }}>
                  {e.stats.remaining} seat{e.stats.remaining === 1 ? "" : "s"} left · your code works once at the gate
                </Muted>
              </Card>
            )}
          </View>
        </View>
      </Screen>
    </>
  );
}
