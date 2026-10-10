import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.cyan,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    notification: colors.pink,
  },
};

/** Keeps the splash screen up until we know whether someone is signed in. */
function SplashGate() {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync().catch(() => {});
  }, [status]);
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ThemeProvider value={navTheme}>
        <AuthProvider>
          <SplashGate />
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: "700" },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false, animation: "fade" }} />
            <Stack.Screen name="welcome" options={{ headerShown: false, animation: "fade" }} />
            <Stack.Screen name="signin" options={{ title: "" }} />
            <Stack.Screen name="signup" options={{ title: "" }} />
            <Stack.Screen name="(attendee)" options={{ headerShown: false, animation: "fade" }} />
            <Stack.Screen name="(host)" options={{ headerShown: false, animation: "fade" }} />
            <Stack.Screen name="event/[id]" options={{ title: "Event" }} />
            <Stack.Screen name="ticket/[code]" options={{ title: "Your ticket", animation: "fade_from_bottom" }} />
            <Stack.Screen name="manage/[id]/index" options={{ title: "Event dashboard" }} />
            <Stack.Screen name="manage/[id]/edit" options={{ title: "Edit event" }} />
            <Stack.Screen name="manage/[id]/calls" options={{ title: "Reminder calls" }} />
          </Stack>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
