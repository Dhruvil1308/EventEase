import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useTabScreenOptions } from "@/components/tab-bar";
import { useAuth } from "@/lib/auth";

/** The attendee portal: events, tickets, profile. */
export default function AttendeeTabs() {
  const { status, profile } = useAuth();
  const tabScreenOptions = useTabScreenOptions();
  if (status !== "loading" && !profile) return <Redirect href="/welcome" />;
  if (profile?.role === "HOST") return <Redirect href="/(host)/dashboard" />;
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "My tickets",
          tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
