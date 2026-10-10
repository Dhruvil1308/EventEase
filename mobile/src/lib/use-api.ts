import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./api";

type Options = {
  /** Re-fetch every N ms while the screen is focused (live dashboards). */
  poll?: number;
  /** Skip fetching (e.g. until an id is known). */
  enabled?: boolean;
};

/**
 * Loads an API resource for a screen: fetches when the screen comes into
 * focus, supports pull-to-refresh, and optionally polls while focused.
 */
export function useApi<T>(path: string | null, { poll, enabled = true }: Options = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async (mode: "initial" | "refresh" | "silent" = "silent") => {
    const p = pathRef.current;
    if (!p) return;
    if (mode === "refresh") setRefreshing(true);
    try {
      const next = await api<T>(p);
      setData(next);
      setError(null);
    } catch (e) {
      // A failed background poll keeps showing the last good data.
      if (mode !== "silent") setError(errorMessage(e));
    } finally {
      setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !path) return;
    setLoading(true);
    load("initial");
  }, [enabled, path, load]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !pathRef.current) return;
      load("silent");
      if (!poll) return;
      const id = setInterval(() => load("silent"), poll);
      return () => clearInterval(id);
    }, [enabled, poll, load]),
  );

  return { data, setData, error, loading, refreshing, reload: () => load("refresh"), refetch: () => load("silent") };
}
