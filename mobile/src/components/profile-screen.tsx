import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api, errorMessage, fieldError, uploadImage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import { pickImage } from "@/lib/images";
import { CALL_LANGUAGE_IDS, CALL_LANGUAGES, colors, radius, space, type CallLanguage } from "@/lib/theme";
import type { Profile } from "@/lib/types";
import { Avatar, Badge, Button, Card, Chip, ErrorBox, Field, Muted, ProgressBar, Row, Screen, SectionTitle, styles as ui } from "./ui";

function TagInput({ label, tags, onChange, placeholder }: { label: string; tags: string[]; onChange: (t: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !tags.some((t) => t.toLowerCase() === v.toLowerCase()) && tags.length < 12) onChange([...tags, v]);
    setDraft("");
  };
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={[ui.label, { marginBottom: 6 }]}>{label}</Text>
      <Row style={{ flexWrap: "wrap", marginBottom: tags.length ? 8 : 0 }} gap={6}>
        {tags.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${t}`}
            onPress={() => onChange(tags.filter((x) => x !== t))}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: "rgba(34,211,238,0.12)", borderWidth: 1, borderColor: "rgba(34,211,238,0.35)" }}
          >
            <Text style={{ color: colors.cyan, fontWeight: "600" }}>{t}</Text>
            <Ionicons name="close" size={14} color={colors.cyan} />
          </Pressable>
        ))}
      </Row>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        onBlur={add}
        blurOnSubmit={false}
        returnKeyType="done"
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={label}
        style={ui.input}
      />
    </View>
  );
}

/** Same scoring as the website (src/lib/profile-view.ts), so both show the same percentage. */
const completeness = (p: Profile) => {
  const checks: [string, boolean][] = [
    ["Profile photo", !!p.avatarUrl],
    ["Mobile number", !!p.phone],
    ["Short bio", !!p.bio],
    ["College", !!p.college],
    ["City", !!p.city],
    ...(p.role === "HOST"
      ? ([["Club or organization", !!p.organization]] as [string, boolean][])
      : ([
          ["Skills", p.skills.length > 0],
          ["Hobbies", p.hobbies.length > 0],
          ["Department", !!p.department],
        ] as [string, boolean][])),
  ];
  return { score: checks.filter(([, ok]) => ok).length / checks.length, missing: checks.filter(([, ok]) => !ok).map(([n]) => n) };
};

export function ProfileScreen() {
  const { profile, setProfile, signOut } = useAuth();
  const [form, setForm] = useState<Profile | null>(profile);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => setForm(profile), [profile]);
  if (!profile || !form) return null;
  const host = profile.role === "HOST";
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const strength = completeness(form);

  async function changePhoto() {
    const image = await pickImage({ square: true, maxWidth: 640 });
    if (!image) return;
    setUploading(true);
    try {
      const res = await uploadImage<{ avatarUrl: string | null }>("/api/profile/avatar", image);
      setProfile({ ...profile!, avatarUrl: res.avatarUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Alert.alert("Couldn't upload the photo", errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ profile: Profile }>("/api/profile", {
        method: "PUT",
        body: {
          name: form.name,
          phone: form.phone ?? "",
          bio: form.bio ?? "",
          skills: form.skills,
          hobbies: form.hobbies,
          college: form.college ?? "",
          city: form.city ?? "",
          organization: form.organization ?? "",
          studentId: form.studentId ?? "",
          department: form.department ?? "",
          linkedinUrl: form.linkedinUrl ?? "",
          githubUrl: form.githubUrl ?? "",
          callLanguage: form.callLanguage,
        },
      });
      setProfile(res.profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setSaving(false);
    }
  }

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You can sign back in any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/welcome");
        },
      },
    ]);

  return (
    <>
      <Screen>
        <Animated.View entering={FadeInDown.duration(450)}>
          <Card strong style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={changePhoto} disabled={uploading}>
              <Avatar name={profile.name} url={profile.avatarUrl} size={92} />
              <View style={{ position: "absolute", right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cyan, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.cardStrong }}>
                <Ionicons name={uploading ? "hourglass-outline" : "camera"} size={15} color={colors.bg} />
              </View>
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", marginTop: space.md }}>{profile.name}</Text>
            <Muted>{profile.email}</Muted>
            <View style={{ marginTop: space.sm }}>
              <Badge label={host ? "Host account" : "Attendee account"} color={host ? colors.pink : colors.cyan} />
            </View>
            <View style={{ alignSelf: "stretch", marginTop: space.lg }}>
              <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: colors.textSoft, fontWeight: "700" }}>Profile {Math.round(strength.score * 100)}% complete</Text>
              </Row>
              <ProgressBar value={strength.score} />
              {strength.missing.length > 0 && <Muted style={{ marginTop: 6, fontSize: 12 }}>Add: {strength.missing.slice(0, 3).join(", ")}
                  {strength.missing.length > 3 ? ` +${strength.missing.length - 3} more` : ""}
                </Muted>}
            </View>
          </Card>
        </Animated.View>

        <SectionTitle>About you</SectionTitle>
        <Field label="Full name" value={form.name} onChangeText={(v) => set("name", v)} error={fieldError(error, "name")} />
        <Field
          label="Mobile number"
          optional
          keyboardType="phone-pad"
          value={form.phone ?? ""}
          onChangeText={(v) => set("phone", v)}
          placeholder="+91 98765 43210"
          hint="Aanaya uses this for event reminder calls."
          error={fieldError(error, "phone")}
        />
        <Field label="Short description" optional multiline maxLength={280} value={form.bio ?? ""} onChangeText={(v) => set("bio", v)} placeholder="A line about you" />
        {host && <Field label="Club or organization" optional value={form.organization ?? ""} onChangeText={(v) => set("organization", v)} />}
        <Row gap={space.md} style={{ alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Field label="College" optional value={form.college ?? ""} onChangeText={(v) => set("college", v)} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="City" optional value={form.city ?? ""} onChangeText={(v) => set("city", v)} />
          </View>
        </Row>
        {!host && (
          <Row gap={space.md} style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Field label="Student ID" optional autoCapitalize="characters" value={form.studentId ?? ""} onChangeText={(v) => set("studentId", v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Department" optional value={form.department ?? ""} onChangeText={(v) => set("department", v)} />
            </View>
          </Row>
        )}

        <SectionTitle>Skills & hobbies</SectionTitle>
        <TagInput label="Skills" tags={form.skills} onChange={(t) => set("skills", t)} placeholder="Type a skill, then Done" />
        <TagInput label="Hobbies" tags={form.hobbies} onChange={(t) => set("hobbies", t)} placeholder="Type a hobby, then Done" />

        <SectionTitle>Links & preferences</SectionTitle>
        <Field label="LinkedIn" optional autoCapitalize="none" value={form.linkedinUrl ?? ""} onChangeText={(v) => set("linkedinUrl", v)} placeholder="linkedin.com/in/your-name" error={fieldError(error, "linkedinUrl")} />
        <Field label="GitHub" optional autoCapitalize="none" value={form.githubUrl ?? ""} onChangeText={(v) => set("githubUrl", v)} placeholder="your-username" error={fieldError(error, "githubUrl")} />
        <Text style={[ui.label, { marginBottom: 8 }]}>Reminder call language</Text>
        <Row style={{ flexWrap: "wrap", marginBottom: space.xl }}>
          {CALL_LANGUAGE_IDS.map((l) => (
            <Chip key={l} label={CALL_LANGUAGES[l].native} active={form.callLanguage === l} onPress={() => set("callLanguage", l as CallLanguage)} />
          ))}
        </Row>

        {!!error && !fieldError(error, "name") && !fieldError(error, "phone") && !fieldError(error, "linkedinUrl") && !fieldError(error, "githubUrl") && (
          <View style={{ marginBottom: space.lg }}>
            <ErrorBox message={errorMessage(error)} />
          </View>
        )}
        <Button title={saved ? "Profile saved ✓" : "Save profile"} icon={saved ? undefined : "save-outline"} size="lg" loading={saving} onPress={save} />

        <View style={{ gap: space.sm, marginTop: space.xxl }}>
          <Button title="Open EventEase website" icon="globe-outline" variant="secondary" onPress={() => WebBrowser.openBrowserAsync(API_URL)} />
          <Button title="Sign out" icon="log-out-outline" variant="danger" onPress={confirmSignOut} />
        </View>
      </Screen>
    </>
  );
}
