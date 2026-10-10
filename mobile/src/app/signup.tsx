import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Button, Chip, ErrorBox, Eyebrow, Field, Muted, Row, Screen, Title } from "@/components/ui";
import { ApiError, errorMessage, fieldError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/lib/theme";
import type { Role } from "@/lib/types";

export default function SignUp() {
  const params = useLocalSearchParams<{ role?: string }>();
  const [role, setRole] = useState<Role>(params.role === "HOST" ? "HOST" : "ATTENDEE");
  const { signUp } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", organization: "", studentId: "", department: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const host = role === "HOST";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signUp({
        role,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        organization: host ? form.organization.trim() || undefined : undefined,
        studentId: host ? undefined : form.studentId.trim() || undefined,
        department: host ? undefined : form.department.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      router.dismissAll();
      router.replace("/");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const fieldsFlagged = error instanceof ApiError && !!error.fields;

  return (
    <>
      <Screen>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Eyebrow color={host ? colors.pink : colors.cyan}>Create your account</Eyebrow>
          <Title style={{ marginTop: space.sm }}>{host ? "Host your events." : "Join the crowd."}</Title>
          <Muted style={{ marginTop: space.sm, marginBottom: space.lg }}>
            One account works on the app and the EventEase website.
          </Muted>
          <Row style={{ marginBottom: space.xl }}>
            <Chip label="🎓 I'm attending" active={!host} onPress={() => setRole("ATTENDEE")} />
            <Chip label="🧑‍💼 I'm hosting" active={host} color={colors.pink} onPress={() => setRole("HOST")} />
          </Row>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Field label="Full name" value={form.name} onChangeText={set("name")} autoComplete="name" placeholder="Aisha Khan" error={fieldError(error, "name")} />
          <Field
            label="Email"
            value={form.email}
            onChangeText={set("email")}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@college.edu"
            error={fieldError(error, "email")}
          />
          <Field
            label="Password"
            value={form.password}
            onChangeText={set("password")}
            secureTextEntry
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={fieldError(error, "password")}
          />
          {host ? (
            <Field label="Club or organization" optional value={form.organization} onChangeText={set("organization")} placeholder="Computer Society" />
          ) : (
            <Row gap={space.md} style={{ alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Field label="Student ID" optional value={form.studentId} onChangeText={set("studentId")} autoCapitalize="characters" placeholder="21CE045" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Department" optional value={form.department} onChangeText={set("department")} placeholder="Computer Engg." />
              </View>
            </Row>
          )}
          <Field
            label="Mobile number"
            optional
            value={form.phone}
            onChangeText={set("phone")}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            hint={host ? undefined : "Aanaya, our voice assistant, can call you with a quick reminder before events."}
            error={fieldError(error, "phone")}
          />

          {!!error && !fieldsFlagged && (
            <View style={{ marginBottom: space.lg }}>
              <ErrorBox message={errorMessage(error)} />
            </View>
          )}
          <Button title="Create account" icon="sparkles-outline" size="lg" loading={busy} onPress={submit} />
        </Animated.View>
      </Screen>
    </>
  );
}
