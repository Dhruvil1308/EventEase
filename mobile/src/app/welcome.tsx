import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Glow, Muted } from "@/components/ui";
import { aurora, colors, radius, space } from "@/lib/theme";

const PATTERN = ["11101", "10011", "11110", "00101", "11011"];

/** A tiny QR mark whose cells shimmer one after another. */
function Cell({ on, index }: { on: boolean; index: number }) {
  const v = useSharedValue(on ? 1 : 0.25);
  useEffect(() => {
    v.value = withDelay(
      index * 60,
      withRepeat(withSequence(withTiming(on ? 0.35 : 0.9, { duration: 700 }), withTiming(on ? 1 : 0.25, { duration: 700 })), -1, true),
    );
  }, [index, on, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.75 + v.value * 0.25 }] }));
  return <Animated.View style={[styles.cell, { backgroundColor: on ? colors.text : colors.cyan }, style]} />;
}

function Logo() {
  return (
    <LinearGradient colors={[...aurora]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
      <View style={styles.logoInner}>
        {PATTERN.join("")
          .split("")
          .map((c, i) => (
            <Cell key={i} on={c === "1"} index={i} />
          ))}
      </View>
    </LinearGradient>
  );
}

function RoleCard({ icon, title, body, color, onPress, delay }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; color: string; onPress: () => void; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(16)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onPress}
        style={({ pressed }) => [styles.role, pressed && { transform: [{ scale: 0.98 }], borderColor: color }]}
      >
        <View style={[styles.roleIcon, { backgroundColor: `${color}22` }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.roleTitle}>{title}</Text>
          <Muted>{body}</Muted>
        </View>
        <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

export default function Welcome() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <View style={styles.wrap}>
        <Animated.View entering={FadeInDown.duration(700)} style={{ alignItems: "center" }}>
          <Logo />
          <Text style={styles.brand}>
            Event<Text style={{ color: colors.cyan }}>Ease</Text>
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(700)}>
          <Text style={styles.headline}>Register fast.</Text>
          <Text style={[styles.headline, { color: colors.violetSoft }]}>Scan once.</Text>
          <Text style={styles.headline}>Zero duplicates.</Text>
          <Muted style={{ marginTop: space.md, fontSize: 15, lineHeight: 22 }}>
            College events, QR tickets and a check-in gate — with reminder calls in Gujarati, Hindi and English.
          </Muted>
        </Animated.View>

        <View style={{ gap: space.md }}>
          <RoleCard
            icon="ticket-outline"
            title="I'm attending"
            body="Find events, register, carry your QR ticket"
            color={colors.cyan}
            delay={300}
            onPress={() => router.push({ pathname: "/signin", params: { role: "ATTENDEE" } })}
          />
          <RoleCard
            icon="megaphone-outline"
            title="I'm hosting"
            body="Create events, run the gate, call registrants"
            color={colors.pink}
            delay={420}
            onPress={() => router.push({ pathname: "/signin", params: { role: "HOST" } })}
          />
          <Animated.View entering={FadeInDown.delay(540)}>
            <Button title="New here? Create an account" variant="ghost" onPress={() => router.push("/signup")} />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space.xl, justifyContent: "space-between", paddingTop: space.xxl },
  logo: { width: 84, height: 84, borderRadius: 24, padding: 3 },
  logoInner: {
    flex: 1,
    borderRadius: 21,
    backgroundColor: colors.bg,
    flexDirection: "row",
    flexWrap: "wrap",
    // 5 cells × 9 px + 4 gaps × 3 px = 57 px, inside the 58 px between the paddings.
    padding: 10,
    gap: 3,
    alignContent: "center",
    justifyContent: "center",
  },
  cell: { width: 9, height: 9, borderRadius: 2 },
  brand: { color: colors.text, fontSize: 26, fontWeight: "800", marginTop: space.md, letterSpacing: -0.5 },
  headline: { color: colors.text, fontSize: 38, fontWeight: "800", letterSpacing: -1, lineHeight: 44 },
  role: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  roleTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: 2 },
});
