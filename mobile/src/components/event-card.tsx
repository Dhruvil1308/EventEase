import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDate, formatDay, formatFee, formatMonth, formatRange, hasEnded, percent } from "@/lib/format";
import { colors, eventType, radius, space, themeColors } from "@/lib/theme";
import type { EventSummary, MyTicket } from "@/lib/types";
import { Badge, ProgressBar, Row } from "./ui";

export function eventState(e: Pick<EventSummary, "startsAt" | "endsAt" | "stats">) {
  if (hasEnded(e.startsAt, e.endsAt)) return { label: "Ended", color: colors.textMuted };
  if (e.stats.remaining <= 0) return { label: "Full", color: colors.danger };
  return { label: "Open", color: colors.success };
}

/** The banner at the top of an event: its cover photo, or its theme gradient. */
export function EventBanner({ event, height = 120 }: { event: { coverUrl: string | null; theme: string }; height?: number }) {
  return (
    <View style={{ height, overflow: "hidden" }}>
      {event.coverUrl ? (
        <Image source={{ uri: event.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      ) : (
        <LinearGradient colors={[...themeColors(event.theme)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient colors={["rgba(10,9,24,0)", "rgba(22,20,45,0.95)"]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

export function DateBlock({ startsAt, theme }: { startsAt: string; theme: string }) {
  return (
    <LinearGradient colors={[...themeColors(theme)]} style={styles.dateBlock}>
      <Text style={styles.dateDay}>{formatDay(startsAt)}</Text>
      <Text style={styles.dateMonth}>{formatMonth(startsAt)}</Text>
    </LinearGradient>
  );
}

export function EventCard({ event, onPress }: { event: EventSummary; onPress: () => void }) {
  const state = eventState(event);
  const type = eventType(event.type);
  const topPrize = event.prizes[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${formatDate(event.startsAt)}, ${state.label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }], opacity: 0.92 }]}
    >
      <EventBanner event={event} height={96} />
      <View style={styles.body}>
        <Row style={{ marginTop: -44, justifyContent: "space-between", alignItems: "flex-end" }}>
          <DateBlock startsAt={event.startsAt} theme={event.theme} />
          <Row gap={6}>
            <Badge label={`${type.emoji} ${type.label}`} color={colors.violetSoft} />
            <Badge label={state.label} color={state.color} />
          </Row>
        </Row>
        <Text style={styles.name} numberOfLines={2}>
          {event.name}
        </Text>
        <Row gap={6} style={{ marginTop: 6 }}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>
            {event.venue}
          </Text>
        </Row>
        <Row gap={6} style={{ marginTop: 4 }}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>
            {formatDate(event.startsAt)} · {formatRange(event.startsAt, event.endsAt)}
          </Text>
        </Row>
        <Row gap={6} style={{ marginTop: 10, flexWrap: "wrap" }}>
          <Badge label={`🎟 ${formatFee(event.entryFee)}`} color={colors.cyan} />
          {topPrize && <Badge label={`🏆 ${topPrize.reward}${event.prizes.length > 1 ? ` +${event.prizes.length - 1}` : ""}`} color={colors.warn} />}
        </Row>
        <Row style={{ justifyContent: "space-between", marginTop: 14, marginBottom: 6 }}>
          <Text style={styles.seats}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{event.stats.registered}</Text> / {event.stats.capacity} registered
          </Text>
          <Text style={styles.seats}>{percent(event.stats.fillRate)}</Text>
        </Row>
        <ProgressBar value={event.stats.fillRate} colorsList={themeColors(event.theme)} />
      </View>
    </Pressable>
  );
}

export function TicketCard({ ticket, onPress }: { ticket: MyTicket; onPress: () => void }) {
  const done = !!ticket.checkedInAt;
  const ended = hasEnded(ticket.event.startsAt, ticket.event.endsAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ticket for ${ticket.event.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }]}
    >
      <LinearGradient colors={[...themeColors(ticket.event.theme)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ticketTop}>
        <Text style={styles.ticketEyebrow}>EVENTEASE · ADMIT ONE</Text>
        <Text style={styles.ticketName} numberOfLines={2}>
          {ticket.event.name}
        </Text>
      </LinearGradient>
      <View style={styles.body}>
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.meta}>{formatDate(ticket.event.startsAt)} · {formatRange(ticket.event.startsAt, ticket.event.endsAt)}</Text>
            <Text style={[styles.meta, { marginTop: 2 }]} numberOfLines={1}>
              {ticket.event.venue}
            </Text>
          </View>
          <Badge
            label={done ? "Checked in" : ended ? "Missed" : "Ready to scan"}
            color={done ? colors.success : ended ? colors.textMuted : colors.cyan}
            icon={done ? "checkmark-circle" : "qr-code-outline"}
          />
        </Row>
        <View style={styles.codeRow}>
          <Text style={styles.code}>{ticket.code}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: space.lg,
  },
  body: { padding: space.lg },
  name: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: space.md },
  meta: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  seats: { color: colors.textMuted, fontSize: 13 },
  dateBlock: { width: 54, height: 58, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dateDay: { color: colors.bg, fontSize: 20, fontWeight: "800" },
  dateMonth: { color: colors.bg, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  ticketTop: { padding: space.lg, paddingBottom: space.xl },
  ticketEyebrow: { color: "rgba(10,9,24,0.7)", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  ticketName: { color: colors.bg, fontSize: 19, fontWeight: "800", marginTop: 6 },
  codeRow: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  code: { color: colors.text, fontFamily: "monospace", fontSize: 17, fontWeight: "700", letterSpacing: 2 },
});
