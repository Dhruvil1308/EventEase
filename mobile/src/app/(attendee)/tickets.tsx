import { router } from "expo-router";
import { useMemo } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { TicketCard } from "@/components/event-card";
import { Button, Empty, ErrorBox, Glow, Loading, Row, Stat } from "@/components/ui";
import { hasEnded } from "@/lib/format";
import { colors, space } from "@/lib/theme";
import type { MyTicket } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function Tickets() {
  const { data, error, loading, refreshing, reload } = useApi<{ tickets: MyTicket[] }>("/api/me/tickets");

  // Upcoming first (soonest at the top), then past ones (most recent first).
  const tickets = useMemo(() => {
    const all = data?.tickets ?? [];
    const upcoming = all.filter((t) => !hasEnded(t.event.startsAt, t.event.endsAt));
    const past = all.filter((t) => hasEnded(t.event.startsAt, t.event.endsAt)).reverse();
    return [...upcoming, ...past];
  }, [data]);

  if (loading && !data) return <Loading label="Fetching your tickets…" />;

  const attended = tickets.filter((t) => t.checkedInAt).length;
  const upcoming = tickets.filter((t) => !t.checkedInAt && !hasEnded(t.event.startsAt, t.event.endsAt)).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <FlatList
        data={tickets}
        keyExtractor={(t) => t.code}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.cyan} colors={[colors.violet, colors.cyan]} progressBackgroundColor={colors.card} />}
        ListHeaderComponent={
          <View style={{ marginBottom: space.lg }}>
            {tickets.length > 0 && (
              <Row gap={space.sm}>
                <Stat compact label="Tickets" value={tickets.length} color={colors.violetSoft} />
                <Stat compact label="Upcoming" value={upcoming} color={colors.cyan} />
                <Stat compact label="Attended" value={attended} color={colors.success} />
              </Row>
            )}
            {error && (
              <View style={{ marginTop: space.lg }}>
                <ErrorBox message={error} onRetry={reload} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          error ? null : (
            <Empty
              icon="ticket-outline"
              title="No tickets yet"
              body="Register for an event and your QR ticket shows up here instantly."
              action={<Button title="Browse events" icon="calendar-outline" onPress={() => router.navigate("/(attendee)/events")} />}
            />
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 70).springify().damping(18)}>
            <TicketCard ticket={item} onPress={() => router.push(`/ticket/${item.code}`)} />
          </Animated.View>
        )}
      />
    </View>
  );
}
