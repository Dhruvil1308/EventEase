/**
 * Each event picks a theme. The same palette drives the event card gradient,
 * the holographic ticket and the 3D accents, so an event feels consistent
 * from registration to the check-in gate.
 */
export const THEMES = {
  aurora: { label: "Aurora", from: "#7c5cff", via: "#22d3ee", to: "#a78bfa", glow: "124 92 255" },
  sunset: { label: "Sunset", from: "#fb7185", via: "#f97316", to: "#facc15", glow: "251 113 133" },
  neon: { label: "Neon", from: "#a3e635", via: "#22d3ee", to: "#34d399", glow: "52 211 153" },
  ocean: { label: "Ocean", from: "#3b82f6", via: "#06b6d4", to: "#2dd4bf", glow: "59 130 246" },
  blossom: { label: "Blossom", from: "#f472b6", via: "#c084fc", to: "#818cf8", glow: "244 114 182" },
  ember: { label: "Ember", from: "#ef4444", via: "#f59e0b", to: "#fb923c", glow: "239 68 68" },
} as const;

export type ThemeId = keyof typeof THEMES;
export type Theme = (typeof THEMES)[ThemeId];

export const THEME_IDS = Object.keys(THEMES) as [ThemeId, ...ThemeId[]];

export function getTheme(id: string | null | undefined): Theme {
  return THEMES[(id ?? "aurora") as ThemeId] ?? THEMES.aurora;
}

export function themeGradient(id: string, angle = 135): string {
  const t = getTheme(id);
  return `linear-gradient(${angle}deg, ${t.from}, ${t.via}, ${t.to})`;
}

/** CSS custom properties consumed by `.theme-*` utility classes in globals.css. */
export function themeVars(id: string): Record<string, string> {
  const t = getTheme(id);
  return {
    "--t-from": t.from,
    "--t-via": t.via,
    "--t-to": t.to,
    "--t-glow": t.glow,
  };
}
