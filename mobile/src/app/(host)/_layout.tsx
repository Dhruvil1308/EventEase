import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useTabScreenOptions } from "@/components/tab-bar";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

/** The host portal: dashboard, gate, create, account. */
export default function HostTabs() {
  const { status, profile } = useAuth();
  const tabScreenOptions = useTabScreenOptions();
  if (status !== "loading" && !profile) return <Redirect href="/welcome" />;
  if (profile?.role === "ATTENDEE") return <Redirect href="/(attendee)/events" />;
  return (
    <Tabs screenOptions={{ ...tabScreenOptions, tabBarActiveTintColor: colors.pink }}>
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Your events", tabBarLabel: "Events", tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="gate"
        options={{ title: "Check-in gate", tabBarLabel: "Gate", tabBarIcon: ({ color, size }) => <Ionicons name="scan-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="create"
        options={{ title: "Create an event", tabBarLabel: "Create", tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
