import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";

/** Shared look for both portals' bottom tab bars, clear of the gesture / button bar. */
export function useTabScreenOptions() {
  const { bottom } = useSafeAreaInsets();
  return {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: "700" as const, fontSize: 20 },
    headerShadowVisible: false,
    tabBarStyle: {
      backgroundColor: colors.bgElevated,
      borderTopColor: colors.border,
      height: 60 + bottom,
      paddingBottom: bottom + 6,
      paddingTop: 6,
    },
    tabBarActiveTintColor: colors.cyan,
    tabBarInactiveTintColor: colors.textFaint,
    tabBarLabelStyle: { fontSize: 12, fontWeight: "600" as const },
    sceneStyle: { backgroundColor: colors.bg },
  };
}
