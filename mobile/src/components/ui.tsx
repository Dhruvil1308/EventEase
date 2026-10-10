import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { initials } from "@/lib/format";
import { useKeyboardSpace } from "@/lib/keyboard";
import { aurora, colors, radius, space } from "@/lib/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

// ── Layout ────────────────────────────────────────────────────────────────────

type ScreenProps = {
  children: ReactNode;
  /** Scrollable with pull-to-refresh when `onRefresh` is given. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Respect the top safe area (screens without a header). */
  edgeTop?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll = true, refreshing = false, onRefresh, edgeTop, contentStyle }: ScreenProps) {
  const keyboard = useKeyboardSpace();
  const inner = scroll ? (
    <ScrollView
      ref={keyboard.scroll}
      onScroll={keyboard.onScroll}
      scrollEventThrottle={32}
      contentContainerStyle={[styles.screenContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.cyan}
            colors={[colors.violet, colors.cyan]}
            progressBackgroundColor={colors.card}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, { flex: 1 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={edgeTop ? ["top", "left", "right"] : ["left", "right"]}>
      <Glow />
      <View ref={keyboard.frame} style={{ flex: 1 }}>
        {inner}
        <View style={{ height: keyboard.space }} />
      </View>
    </SafeAreaView>
  );
}

/** Soft aurora light behind every screen. */
export function Glow() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["rgba(124,92,255,0.22)", "rgba(10,9,24,0)"]}
        style={{ position: "absolute", top: -60, left: -80, width: 360, height: 360, borderRadius: 180 }}
      />
      <LinearGradient
        colors={["rgba(34,211,238,0.12)", "rgba(10,9,24,0)"]}
        style={{ position: "absolute", bottom: -40, right: -100, width: 320, height: 320, borderRadius: 160 }}
      />
    </View>
  );
}

export function Card({ children, style, strong }: { children: ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean }) {
  return <View style={[styles.card, strong && styles.cardStrong, style]}>{children}</View>;
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}

// ── Text ──────────────────────────────────────────────────────────────────────

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Eyebrow({ children, color = colors.cyan }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: "space-between", marginTop: space.xl, marginBottom: space.md }}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </Row>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────

type ButtonProps = {
  title: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  loading?: boolean;
  disabled?: boolean;
  size?: "md" | "lg" | "sm";
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, icon, variant = "primary", loading, disabled, size = "md", style }: ButtonProps) {
  const off = disabled || loading;
  const height = size === "lg" ? 56 : size === "sm" ? 38 : 48;
  const content = (
    <Row gap={8} style={{ justifyContent: "center" }}>
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.bg : colors.text} />
      ) : icon ? (
        <Ionicons name={icon} size={size === "sm" ? 16 : 19} color={variant === "primary" ? colors.bg : variantText(variant)} />
      ) : null}
      <Text
        style={[
          styles.buttonText,
          size === "sm" && { fontSize: 14 },
          { color: variant === "primary" ? colors.bg : variantText(variant) },
        ]}
      >
        {title}
      </Text>
    </Row>
  );
  return (
    <Pressable
      accessibilityRole="button"
      // Android announces "busy" whenever the key is present, even when false.
      accessibilityState={loading ? { disabled: true, busy: true } : { disabled: !!off }}
      disabled={off}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [{ opacity: off ? 0.55 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={[...aurora]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, { height }]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.button, { height }, variantBox(variant)]}>{content}</View>
      )}
    </Pressable>
  );
}

const variantText = (v: ButtonProps["variant"]) =>
  v === "danger" ? colors.danger : v === "success" ? colors.success : colors.text;
const variantBox = (v: ButtonProps["variant"]): ViewStyle =>
  v === "ghost"
    ? { backgroundColor: "transparent" }
    : v === "danger"
      ? { backgroundColor: "rgba(251,113,133,0.12)", borderColor: "rgba(251,113,133,0.35)", borderWidth: 1 }
      : v === "success"
        ? { backgroundColor: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.35)", borderWidth: 1 }
        : { backgroundColor: colors.cardStrong, borderColor: colors.borderStrong, borderWidth: 1 };

export function IconButton({ icon, onPress, label, color = colors.text }: { icon: IconName; onPress: () => void; label: string; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

// ── Inputs ────────────────────────────────────────────────────────────────────

type FieldProps = TextInputProps & { label: string; error?: string; hint?: string; optional?: boolean };

export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, error, hint, optional, style, ...props }, ref) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={styles.label}>{label}</Text>
        {optional && <Text style={styles.optional}>Optional</Text>}
      </Row>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.cyan}
        accessibilityLabel={label}
        style={[styles.input, !!error && { borderColor: colors.danger }, props.multiline && { height: 104, paddingTop: 12, textAlignVertical: "top" }, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

export function Chip({ label, active, onPress, color = colors.cyan }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        active && { borderColor: color, backgroundColor: `${color}22` },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipText, active && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, color = colors.cyan, icon, style }: { label: string; color?: string; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  return (
    <Row gap={4} style={[styles.badge, { borderColor: `${color}55`, backgroundColor: `${color}1a` }, style]}>
      {icon && <Ionicons name={icon} size={12} color={color} />}
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </Row>
  );
}

export function Stat({
  label,
  value,
  color = colors.text,
  icon,
  compact,
}: {
  label: string;
  value: string | number;
  color?: string;
  icon?: IconName;
  /** Three or more in a row on a phone. */
  compact?: boolean;
}) {
  return (
    <Card style={{ flex: 1, minWidth: compact ? 0 : 140, padding: compact ? space.md : space.lg }}>
      <Row gap={6}>
        {icon && <Ionicons name={icon} size={14} color={colors.textMuted} />}
        <Text style={styles.statLabel}>{label}</Text>
      </Row>
      <Text style={[styles.statValue, compact && { fontSize: 24 }, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </Card>
  );
}

export function ProgressBar({ value, colorsList = aurora }: { value: number; colorsList?: readonly string[] }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.progressTrack}>
      <LinearGradient
        colors={[...colorsList] as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${pct * 100}%`, height: "100%", borderRadius: radius.pill }}
      />
    </View>
  );
}

export function Avatar({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  return (
    <LinearGradient
      colors={[colors.violet, colors.cyan]}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: size * 0.36 }}>{initials(name) || "?"}</Text>
    </LinearGradient>
  );
}

// ── States ────────────────────────────────────────────────────────────────────

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.cyan} />
      <Muted style={{ marginTop: space.md }}>{label}</Muted>
    </View>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: space.xl }}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.violetSoft} />
      </View>
      <Text style={[styles.section, { textAlign: "center", marginTop: space.lg }]}>{title}</Text>
      {body && <Muted style={{ textAlign: "center", marginTop: 6 }}>{body}</Muted>}
      {action && <View style={{ marginTop: space.xl, alignSelf: "stretch" }}>{action}</View>}
    </Card>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ borderColor: "rgba(251,113,133,0.35)", backgroundColor: "rgba(251,113,133,0.08)" }}>
      <Row gap={10} style={{ alignItems: "flex-start" }}>
        <Ionicons name="cloud-offline-outline" size={20} color={colors.danger} />
        <Text style={{ color: colors.textSoft, flex: 1, lineHeight: 20 }}>{message}</Text>
      </Row>
      {onRetry && <Button title="Try again" icon="refresh" variant="secondary" size="sm" onPress={onRetry} style={{ marginTop: space.md }} />}
    </Card>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: space.lg, paddingBottom: 48 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  cardStrong: { backgroundColor: colors.cardStrong, borderColor: colors.borderStrong },
  title: { color: colors.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 2.4, textTransform: "uppercase" },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  section: { color: colors.text, fontSize: 18, fontWeight: "700" },
  button: { borderRadius: radius.md, paddingHorizontal: space.xl, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "700" },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.textSoft, fontSize: 14, fontWeight: "600" },
  optional: { color: colors.textFaint, fontSize: 12 },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, alignSelf: "flex-start" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" },
  statValue: { fontSize: 30, fontWeight: "800", marginTop: 6 },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,92,255,0.15)",
  },
});
