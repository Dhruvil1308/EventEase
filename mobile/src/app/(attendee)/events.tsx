import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { EventCard } from "@/components/event-card";
import { Chip, Empty, ErrorBox, Glow, Loading, Muted, Row, styles as ui } from "@/components/ui";
import { hasEnded } from "@/lib/format";
import { colors, space } from "@/lib/theme";
import type { EventSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Filter = "upcoming" | "open" | "all";

export default function Events() {
  const { data, error, loading, refreshing, reload } = useApi<{ events: EventSummary[] }>("/api/events");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("upcoming");

  const events = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.events ?? [])
      .filter((e) => (filter === "all" ? true : !hasEnded(e.startsAt, e.endsAt)))
      .filter((e) => (filter === "open" ? e.stats.remaining > 0 : true))
      .filter((e) => !q || `${e.name} ${e.venue} ${e.hostName} ${e.type}`.toLowerCase().includes(q));
  }, [data, query, filter]);

  if (loading && !data) return <Loading label="Finding events…" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.cyan} colors={[colors.violet, colors.cyan]} progressBackgroundColor={colors.card} />}
        ListHeaderComponent={
          <View style={{ marginBottom: space.lg }}>
            <View>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search events, venues, hosts"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Search events"
                style={[ui.input, { paddingLeft: 42 }]}
              />
              <Ionicons name="search" size={18} color={colors.textMuted} style={{ position: "absolute", left: 14, top: 16 }} />
            </View>
            <Row style={{ marginTop: space.md }}>
              <Chip label="Upcoming" active={filter === "upcoming"} onPress={() => setFilter("upcoming")} />
              <Chip label="Seats left" active={filter === "open"} onPress={() => setFilter("open")} />
              <Chip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
            </Row>
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
              icon="calendar-outline"
              title={query ? "No matches" : "Nothing coming up"}
              body={query ? "Try another name or venue." : "New events show up here as soon as hosts publish them."}
            />
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 70).springify().damping(18)}>
            <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
          </Animated.View>
        )}
        ListFooterComponent={events.length ? <Muted style={{ textAlign: "center" }}>{events.length} event{events.length === 1 ? "" : "s"}</Muted> : null}
      />
    </View>
  );
}
