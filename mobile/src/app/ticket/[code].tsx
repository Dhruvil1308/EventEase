import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Dimensions, Share, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming, ZoomIn } from "react-native-reanimated";
import { Badge, Button, ErrorBox, Loading, Muted, Row, Screen } from "@/components/ui";
import { formatDateLong, formatRange, formatTime } from "@/lib/format";
import { aurora, colors, radius, space, themeColors } from "@/lib/theme";
import type { MyTicket } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const { width } = Dimensions.get("window");
const QR_SIZE = Math.min(width - 120, 260);

/** A short burst of confetti right after registering. */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        x: (Math.random() - 0.5) * width,
        y: 260 + Math.random() * 260,
        r: Math.random() * 540 - 270,
        color: [colors.violet, colors.cyan, colors.pink, colors.warn, colors.success][i % 5],
        delay: Math.random() * 200,
      })),
    [],
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center" }]}>
      {pieces.map((p, i) => (
        <Piece key={i} {...p} />
      ))}
    </View>
  );
}

function Piece({ x, y, r, color, delay }: { x: number; y: number; r: number; color: string; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1500 }));
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateX: x * t.value }, { translateY: -40 + y * t.value }, { rotate: `${r * t.value}deg` }],
  }));
  return <Animated.View style={[{ position: "absolute", top: 120, width: 9, height: 14, borderRadius: 2, backgroundColor: color }, style]} />;
}

export default function TicketScreen() {
  const { code, fresh } = useLocalSearchParams<{ code: string; fresh?: string }>();
  const { data, error, loading, refreshing, reload } = useApi<{ tickets: MyTicket[] }>("/api/me/tickets", { poll: 8000 });
  const ticket = data?.tickets.find((t) => t.code === code);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (fresh) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [fresh]);

  if (loading && !data) return <Loading label="Opening your ticket…" />;
  if (!ticket) return <Screen><ErrorBox message={error ?? "This ticket isn't on your account."} onRetry={reload} /></Screen>;

  const done = !!ticket.checkedInAt;
  const copy = async () => {
    await Clipboard.setStringAsync(ticket.code);
    Haptics.selectionAsync().catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      {fresh && <Confetti />}
      <Animated.View entering={ZoomIn.springify().damping(15)}>
        <LinearGradient colors={[...themeColors(ticket.event.theme)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.top}>
          <Text style={styles.eyebrow}>EVENTEASE · ADMIT ONE</Text>
          <Text style={styles.name}>{ticket.event.name}</Text>
          <Text style={styles.when}>
            {formatDateLong(ticket.event.startsAt)} · {formatRange(ticket.event.startsAt, ticket.event.endsAt)}
          </Text>
          <Text style={styles.when}>{ticket.event.venue}</Text>
        </LinearGradient>

        <View style={styles.body}>
          {fresh && (
            <Animated.View entering={FadeIn.delay(300)} style={{ alignItems: "center", marginBottom: space.md }}>
              <Badge label="You're registered! 🎉" color={colors.success} style={{ alignSelf: "center" }} />
            </Animated.View>
          )}
          <View style={styles.qrWrap}>
            <View style={{ opacity: done ? 0.25 : 1 }}>
              <QRCode value={ticket.code} size={QR_SIZE} backgroundColor="#ffffff" color="#0a0918" ecl="M" />
            </View>
            {done && (
              <View style={styles.stamp}>
                <Text style={styles.stampText}>CHECKED IN</Text>
                <Text style={styles.stampTime}>{formatTime(ticket.checkedInAt!)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.codeLabel}>ENTRY CODE</Text>
          <Text selectable style={styles.code}>
            {ticket.code}
          </Text>
          <Muted style={{ textAlign: "center", marginTop: 6 }}>
            {done ? "This ticket has been used — enjoy the event!" : "Show this at the gate. It works exactly once."}
          </Muted>

          <Row gap={space.sm} style={{ marginTop: space.xl }}>
            <Button title={copied ? "Copied" : "Copy code"} icon={copied ? "checkmark" : "copy-outline"} variant="secondary" style={{ flex: 1 }} onPress={copy} />
            <Button
              title="Share"
              icon="share-outline"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => Share.share({ message: `My EventEase ticket for ${ticket.event.name}: ${ticket.code}` })}
            />
          </Row>
          <Row gap={6} style={{ justifyContent: "center", marginTop: space.lg }}>
            <Ionicons name="sunny-outline" size={14} color={colors.textFaint} />
            <Muted style={{ fontSize: 12 }}>Turn your screen brightness up for faster scanning</Muted>
          </Row>
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl },
  eyebrow: { color: "rgba(10,9,24,0.7)", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  name: { color: colors.bg, fontSize: 24, fontWeight: "800", marginTop: 8 },
  when: { color: "rgba(10,9,24,0.78)", fontSize: 14, marginTop: 4, fontWeight: "600" },
  body: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
    padding: space.xl,
  },
  qrWrap: {
    alignSelf: "center",
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: "#ffffff",
    shadowColor: aurora[1],
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  stamp: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-12deg" }],
  },
  stampText: {
    color: colors.success,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 3,
    borderWidth: 4,
    borderColor: colors.success,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
  },
  stampTime: { color: "#047857", fontWeight: "700", marginTop: 6 },
  codeLabel: { color: colors.textFaint, fontSize: 11, fontWeight: "700", letterSpacing: 2, textAlign: "center", marginTop: space.xl },
  code: { color: colors.text, fontFamily: "monospace", fontSize: 28, fontWeight: "800", letterSpacing: 3, textAlign: "center", marginTop: 6 },
});
