import { router } from "expo-router";
import { FlatList, RefreshControl, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { EventCard } from "@/components/event-card";
import { Button, Empty, ErrorBox, Glow, Loading, Muted, Row, SectionTitle, Stat } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { hasEnded } from "@/lib/format";
import { colors, space } from "@/lib/theme";
import type { EventSummary, HostStats } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function HostDashboard() {
  const { profile } = useAuth();
  const { data, error, loading, refreshing, reload } = useApi<{ stats: HostStats; events: EventSummary[] }>("/api/host/overview", { poll: 15000 });

  if (loading && !data) return <Loading label="Loading your events…" />;
  const events = [...(data?.events ?? [])].sort(
    (a, b) => Number(hasEnded(a.startsAt, a.endsAt)) - Number(hasEnded(b.startsAt, b.endsAt)) || a.startsAt.localeCompare(b.startsAt),
  );
  const s = data?.stats;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.pink} colors={[colors.violet, colors.pink]} progressBackgroundColor={colors.card} />}
        ListHeaderComponent={
          <View>
            <Animated.View entering={FadeInDown.duration(450)}>
              <Muted>Hi {profile?.name.split(" ")[0]} 👋</Muted>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 2 }}>Here's how your events are doing</Text>
            </Animated.View>
            {s && (
              <Animated.View entering={FadeInDown.delay(80).duration(450)} style={{ marginTop: space.lg, gap: space.sm }}>
                <Row gap={space.sm}>
                  <Stat label="Events" value={s.events} color={colors.violetSoft} icon="calendar-outline" />
                  <Stat label="Registrations" value={s.registrations} color={colors.cyan} icon="people-outline" />
                </Row>
                <Row gap={space.sm}>
                  <Stat label="Checked in" value={s.checkIns} color={colors.success} icon="checkmark-done-outline" />
                  <Stat label="Duplicates blocked" value={s.duplicatesBlocked} color={colors.danger} icon="shield-checkmark-outline" />
                </Row>
              </Animated.View>
            )}
            <Animated.View entering={FadeInDown.delay(160).duration(450)}>
              <Row gap={space.sm} style={{ marginTop: space.lg }}>
                <Button title="Open gate" icon="scan-outline" style={{ flex: 1 }} onPress={() => router.navigate("/(host)/gate")} />
                <Button title="New event" icon="add" variant="secondary" style={{ flex: 1 }} onPress={() => router.navigate("/(host)/create")} />
              </Row>
            </Animated.View>
            {error && (
              <View style={{ marginTop: space.lg }}>
                <ErrorBox message={error} onRetry={reload} />
              </View>
            )}
            {events.length > 0 && <SectionTitle>Your events</SectionTitle>}
          </View>
        }
        ListEmptyComponent={
          error ? null : (
            <View style={{ marginTop: space.xl }}>
              <Empty
                icon="sparkles-outline"
                title="Create your first event"
                body="Set a capacity, share the link, and run the gate from this phone."
                action={<Button title="Create an event" icon="add" onPress={() => router.navigate("/(host)/create")} />}
              />
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 70).springify().damping(18)}>
            <EventCard event={item} onPress={() => router.push(`/manage/${item.id}`)} />
          </Animated.View>
        )}
      />
    </View>
  );
}
