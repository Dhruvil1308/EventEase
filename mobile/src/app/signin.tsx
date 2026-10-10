import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Button, ErrorBox, Eyebrow, Field, Muted, Screen, Title } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/lib/theme";

export default function SignIn() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const host = role === "HOST";
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      // The launch screen sends each account to its own portal.
      router.dismissAll();
      router.replace("/");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Screen>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Eyebrow color={host ? colors.pink : colors.cyan}>{host ? "Host portal" : "Attendee portal"}</Eyebrow>
          <Title style={{ marginTop: space.sm }}>Welcome back.</Title>
          <Muted style={{ marginTop: space.sm, marginBottom: space.xl }}>
            {host ? "Sign in to manage your events and run the gate." : "Sign in to see your tickets and register for events."}
          </Muted>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(500)}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="you@college.edu"
          />
          <View>
            <Field
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              placeholder="Your password"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={show ? "Hide password" : "Show password"}
              onPress={() => setShow((s) => !s)}
              hitSlop={12}
              style={{ position: "absolute", right: 14, top: 40 }}
            >
              <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {error && (
            <View style={{ marginBottom: space.lg }}>
              <ErrorBox message={error} />
            </View>
          )}
          <Button title="Sign in" icon="log-in-outline" size="lg" loading={busy} onPress={submit} />

          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: "/signup", params: { role: host ? "HOST" : "ATTENDEE" } })}
            style={{ marginTop: space.xl, alignItems: "center" }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>
              New to EventEase? <Text style={{ color: colors.cyan, fontWeight: "700" }}>Create an account</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </Screen>
    </>
  );
}
