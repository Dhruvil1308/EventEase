import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, Vibration, View } from "react-native";
import Animated, { FadeInDown, FadeOut, ZoomIn } from "react-native-reanimated";
import { Button, Card, Chip, Glow, Muted, Row, SectionTitle, styles as ui } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatTime, normalizeCode, timeAgo } from "@/lib/format";
import { useKeyboardSpace } from "@/lib/keyboard";
import { colors, radius, space } from "@/lib/theme";
import type { CheckInResult, CheckInStatus, EventSummary, HostStats } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const VERDICT: Record<CheckInStatus | "ERROR", { title: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  SUCCESS: { title: "Entry granted", color: colors.success, icon: "checkmark-circle" },
  DUPLICATE: { title: "Already checked in", color: colors.danger, icon: "close-circle" },
  WRONG_EVENT: { title: "Wrong event", color: colors.warn, icon: "swap-horizontal" },
  INVALID: { title: "Invalid code", color: colors.warn, icon: "alert-circle" },
  ERROR: { title: "Couldn't verify", color: colors.warn, icon: "cloud-offline" },
};

type Scan = { id: number; result: CheckInResult | { status: "ERROR"; message: string; code: string }; at: number };

/** "ee7k2mq9xd" → "EE-7K2M-Q9XD" while typing; codes never use 0/O/1/I/L. */
function formatTyping(raw: string) {
  const all = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Still typing the "EE" prefix by hand: leave it alone instead of treating it as the code.
  if (all === "E" || all === "EE") return all;
  const s = all.replace(/^EE/, "").slice(0, 8);
  if (!s) return "";
  return `EE-${s.slice(0, 4)}${s.length > 4 ? `-${s.slice(4)}` : ""}`;
}

export default function Gate() {
  const params = useLocalSearchParams<{ event?: string }>();
  const { data } = useApi<{ stats: HostStats; events: EventSummary[] }>("/api/host/overview");
  const [eventId, setEventId] = useState<string | null>(params.event ?? null);
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [current, setCurrent] = useState<Scan | null>(null);
  const [history, setHistory] = useState<Scan[]>([]);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (params.event) setEventId(params.event);
  }, [params.event]);

  // Only run the camera while this tab is on screen.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setTorch(false);
      };
    }, []),
  );

  const verify = useCallback(
    async (rawCode: string) => {
      const code = normalizeCode(rawCode);
      if (!code) return;
      setBusy(true);
      let result: Scan["result"];
      try {
        result = await api<CheckInResult>("/api/checkin", {
          method: "POST",
          body: { code, ...(eventId ? { eventId } : {}) },
          okStatuses: [400, 404, 409],
        });
      } catch (e) {
        result = { status: "ERROR", message: errorMessage(e), code };
      }
      const scan = { id: Date.now(), result, at: Date.now() };
      setCurrent(scan);
      setHistory((h) => [scan, ...h].slice(0, 12));
      if (result.status === "SUCCESS") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else {
        Haptics.notificationAsync(result.status === "WRONG_EVENT" ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Error).catch(() => {});
        Vibration.vibrate([0, 90, 70, 90]);
      }
      setBusy(false);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setCurrent(null), result.status === "SUCCESS" ? 2600 : 4200);
    },
    [eventId],
  );

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const onScan = useCallback(
    ({ data: value }: BarcodeScanningResult) => {
      // The camera reports the same QR many times a second; act once per code.
      const now = Date.now();
      if (busy || current || (lastCode.current?.code === value && now - lastCode.current.at < 4000)) return;
      lastCode.current = { code: value, at: now };
      verify(value);
    },
    [busy, current, verify],
  );

  const counts = { admitted: 0, rejected: 0, invalid: 0 };
  for (const s of history) {
    if (s.result.status === "SUCCESS") counts.admitted++;
    else if (s.result.status === "INVALID" || s.result.status === "ERROR") counts.invalid++;
    else counts.rejected++;
  }

  const keyboard = useKeyboardSpace();
  const events = data?.events ?? [];
  const v = current ? VERDICT[current.result.status] : null;
  const r = current?.result as CheckInResult | undefined;

  return (
    <View ref={keyboard.frame} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView
        ref={keyboard.scroll}
        onScroll={keyboard.onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[ui.label, { marginBottom: 8 }]}>Gate is checking in for</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          <Chip label="Any of my events" active={!eventId} color={colors.pink} onPress={() => setEventId(null)} />
          {events.map((e) => (
            <Chip key={e.id} label={e.name} active={eventId === e.id} color={colors.pink} onPress={() => setEventId(e.id)} />
          ))}
        </ScrollView>

        {/* Camera */}
        <View style={styles.cameraBox}>
          {!permission ? null : !permission.granted ? (
            <View style={styles.cameraPlaceholder}>
              <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginTop: space.md }}>Scan tickets with your camera</Text>
              <Muted style={{ textAlign: "center", marginTop: 4, marginBottom: space.lg }}>EventEase only uses the camera while this screen is open.</Muted>
              <Button title={permission.canAskAgain ? "Allow camera" : "Camera blocked in settings"} icon="camera" onPress={requestPermission} disabled={!permission.canAskAgain} />
            </View>
          ) : focused ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={busy || current ? undefined : onScan}
            />
          ) : null}
          {permission?.granted && (
            <>
              <View pointerEvents="none" style={styles.frame}>
                <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 }]} />
                <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 }]} />
                <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 }]} />
                <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 }]} />
              </View>
              <View style={styles.cameraBar}>
                <Muted style={{ color: colors.textSoft }}>{busy ? "Checking…" : "Point at a ticket QR"}</Muted>
                <Button title={torch ? "Torch on" : "Torch"} icon={torch ? "flashlight" : "flashlight-outline"} size="sm" variant="secondary" onPress={() => setTorch((t) => !t)} />
              </View>
            </>
          )}

          {current && v && (
            <Animated.View entering={ZoomIn.springify().damping(14)} exiting={FadeOut} style={[styles.verdict, { backgroundColor: `${v.color}ee` }]}>
              <Ionicons name={v.icon} size={64} color={colors.bg} />
              <Text style={styles.verdictTitle}>{v.title}</Text>
              {r?.participant && <Text style={styles.verdictName}>{r.participant.name}</Text>}
              <Text style={styles.verdictBody}>
                {current.result.status === "DUPLICATE" && r?.checkedInAt
                  ? `First used at ${formatTime(r.checkedInAt)}`
                  : current.result.status === "WRONG_EVENT" && r?.event
                    ? `This ticket is for ${r.event.name}`
                    : current.result.message}
              </Text>
              <Text style={styles.verdictCode}>{current.result.code}</Text>
            </Animated.View>
          )}
        </View>

        {/* Manual entry */}
        <Card style={{ marginTop: space.lg }}>
          <Text style={[ui.label, { marginBottom: 8 }]}>Or type the entry code</Text>
          <Row gap={space.sm}>
            <TextInput
              value={typed}
              onChangeText={(t) => setTyped(formatTyping(t))}
              placeholder="EE-XXXX-XXXX"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              returnKeyType="go"
              accessibilityLabel="Entry code"
              onSubmitEditing={() => typed && verify(typed)}
              style={[ui.input, { flex: 1, fontFamily: "monospace", fontSize: 18, letterSpacing: 2 }]}
            />
            <Button title="Verify" loading={busy} disabled={typed.length < 12} onPress={() => verify(typed)} />
          </Row>
          <Muted style={{ fontSize: 12, marginTop: 8 }}>Case and dashes don&apos;t matter. Codes never contain 0, O, 1, I or L.</Muted>
        </Card>

        <Row gap={space.sm} style={{ marginTop: space.lg }}>
          {[
            { label: "Admitted", value: counts.admitted, color: colors.success },
            { label: "Rejected", value: counts.rejected, color: colors.danger },
            { label: "Invalid", value: counts.invalid, color: colors.warn },
          ].map((c) => (
            <Card key={c.label} style={{ flex: 1, alignItems: "center", paddingVertical: space.md }}>
              <Text style={{ color: c.color, fontSize: 26, fontWeight: "800" }}>{c.value}</Text>
              <Muted style={{ fontSize: 12 }}>{c.label}</Muted>
            </Card>
          ))}
        </Row>

        {history.length > 0 && (
          <>
            <SectionTitle>Recent scans</SectionTitle>
            {history.map((s) => {
              const sv = VERDICT[s.result.status];
              const sr = s.result as CheckInResult;
              return (
                <Animated.View key={s.id} entering={FadeInDown}>
                  <Row style={styles.historyRow}>
                    <Ionicons name={sv.icon} size={22} color={sv.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{sr.participant?.name ?? sv.title}</Text>
                      <Muted style={{ fontSize: 12 }}>
                        {s.result.code} · {sv.title}
                      </Muted>
                    </View>
                    <Muted style={{ fontSize: 12 }}>{timeAgo(new Date(s.at))}</Muted>
                  </Row>
                </Animated.View>
              );
            })}
          </>
        )}
      </ScrollView>
      <View style={{ height: keyboard.space }} />
    </View>
  );
}

const styles = StyleSheet.create({
  cameraBox: {
    marginTop: space.lg,
    height: 340,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: "#05040d",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cameraPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  frame: { position: "absolute", top: 60, left: "18%", right: "18%", bottom: 76 },
  corner: { position: "absolute", width: 34, height: 34, borderColor: colors.cyan, borderRadius: 6 },
  cameraBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.md,
    backgroundColor: "rgba(10,9,24,0.72)",
  },
  verdict: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: space.xl },
  verdictTitle: { color: colors.bg, fontSize: 30, fontWeight: "900", marginTop: space.sm, textAlign: "center" },
  verdictName: { color: colors.bg, fontSize: 20, fontWeight: "800", marginTop: 4 },
  verdictBody: { color: "rgba(10,9,24,0.85)", fontSize: 15, marginTop: 6, textAlign: "center", fontWeight: "600" },
  verdictCode: { color: "rgba(10,9,24,0.7)", fontFamily: "monospace", marginTop: space.md, fontWeight: "700", letterSpacing: 2 },
  historyRow: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    gap: space.md,
  },
});
