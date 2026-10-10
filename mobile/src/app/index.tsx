import { Redirect } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

/** Sends everyone to the right place: the welcome screen, or their portal. */
export default function Index() {
  const { status, profile } = useAuth();
  if (status === "loading") return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!profile) return <Redirect href="/welcome" />;
  return <Redirect href={profile.role === "HOST" ? "/(host)/dashboard" : "/(attendee)/events"} />;
}
