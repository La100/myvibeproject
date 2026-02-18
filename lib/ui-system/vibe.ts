import type { CSSProperties } from "react";

export type UiVibeId = "linen" | "graphite";

type ThemeScale = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  uiTextStrong: string;
  uiTextMain: string;
  uiTextMuted: string;
  uiTextSubtle: string;
  uiBorderSoft: string;
  uiSurfaceSoft: string;
  uiSurfaceBase: string;
  uiAccentBrand: string;
  uiActionBg: string;
  uiActionHover: string;
  uiAccentCopper: string;
  uiAccentIndigo: string;
  uiPriorityUrgent: string;
  uiPriorityHigh: string;
  uiPriorityMedium: string;
  uiPriorityLow: string;
  uiPriorityDefault: string;
  uiGradientStart: string;
  uiGradientWarm: string;
  uiGradientBrand: string;
  uiGradientViolet: string;
  uiGradientEnd: string;
};

type UiVibeDefinition = {
  id: UiVibeId;
  label: string;
  radius: string;
  light: ThemeScale;
  dark: ThemeScale;
};

const TOKEN_SUFFIX: Record<keyof ThemeScale, string> = {
  background: "background",
  foreground: "foreground",
  card: "card",
  cardForeground: "card-foreground",
  popover: "popover",
  popoverForeground: "popover-foreground",
  primary: "primary",
  primaryForeground: "primary-foreground",
  secondary: "secondary",
  secondaryForeground: "secondary-foreground",
  muted: "muted",
  mutedForeground: "muted-foreground",
  accent: "accent",
  accentForeground: "accent-foreground",
  destructive: "destructive",
  border: "border",
  input: "input",
  ring: "ring",
  chart1: "chart-1",
  chart2: "chart-2",
  chart3: "chart-3",
  chart4: "chart-4",
  chart5: "chart-5",
  sidebar: "sidebar",
  sidebarForeground: "sidebar-foreground",
  sidebarPrimary: "sidebar-primary",
  sidebarPrimaryForeground: "sidebar-primary-foreground",
  sidebarAccent: "sidebar-accent",
  sidebarAccentForeground: "sidebar-accent-foreground",
  sidebarBorder: "sidebar-border",
  sidebarRing: "sidebar-ring",
  uiTextStrong: "ui-text-strong",
  uiTextMain: "ui-text-main",
  uiTextMuted: "ui-text-muted",
  uiTextSubtle: "ui-text-subtle",
  uiBorderSoft: "ui-border-soft",
  uiSurfaceSoft: "ui-surface-soft",
  uiSurfaceBase: "ui-surface-base",
  uiAccentBrand: "ui-accent-brand",
  uiActionBg: "ui-action-bg",
  uiActionHover: "ui-action-hover",
  uiAccentCopper: "ui-accent-copper",
  uiAccentIndigo: "ui-accent-indigo",
  uiPriorityUrgent: "ui-priority-urgent",
  uiPriorityHigh: "ui-priority-high",
  uiPriorityMedium: "ui-priority-medium",
  uiPriorityLow: "ui-priority-low",
  uiPriorityDefault: "ui-priority-default",
  uiGradientStart: "ui-gradient-start",
  uiGradientWarm: "ui-gradient-warm",
  uiGradientBrand: "ui-gradient-brand",
  uiGradientViolet: "ui-gradient-violet",
  uiGradientEnd: "ui-gradient-end",
};

const VIBE_SCHEME_KEYS = Object.keys(TOKEN_SUFFIX) as Array<keyof ThemeScale>;

export const UI_VIBES: Record<UiVibeId, UiVibeDefinition> = {
  linen: {
    id: "linen",
    label: "Linen Atelier",
    radius: "0.875rem",
    light: {
      background: "#F6F5F1",
      foreground: "#161616",
      card: "#FCFCFA",
      cardForeground: "#161616",
      popover: "#FFFFFF",
      popoverForeground: "#161616",
      primary: "#171717",
      primaryForeground: "#F9F8F5",
      secondary: "#ECEAE3",
      secondaryForeground: "#262523",
      muted: "#EFEEE8",
      mutedForeground: "#6E6B65",
      accent: "#E8E6DE",
      accentForeground: "#262523",
      destructive: "#dc322f",
      border: "#E2E0D8",
      input: "#DAD7CF",
      ring: "#4C4A44",
      chart1: "oklch(0.646 0.222 41.116)",
      chart2: "oklch(0.6 0.118 184.704)",
      chart3: "oklch(0.398 0.07 227.392)",
      chart4: "oklch(0.828 0.189 84.429)",
      chart5: "oklch(0.769 0.188 70.08)",
      sidebar: "#F2F1EC",
      sidebarForeground: "#161616",
      sidebarPrimary: "#171717",
      sidebarPrimaryForeground: "#F9F8F5",
      sidebarAccent: "#E7E5DD",
      sidebarAccentForeground: "#262523",
      sidebarBorder: "#DEDBD3",
      sidebarRing: "#4C4A44",
      uiTextStrong: "#1A1A1A",
      uiTextMain: "#3C3A37",
      uiTextMuted: "#8C8880",
      uiTextSubtle: "#C0B9AF",
      uiBorderSoft: "#E7E2D9",
      uiSurfaceSoft: "#FAF7F2",
      uiSurfaceBase: "#FFFFFF",
      uiAccentBrand: "#6D8B73",
      uiActionBg: "#0E0E0E",
      uiActionHover: "#1F1F1F",
      uiAccentCopper: "#C06A3D",
      uiAccentIndigo: "#7C5CE0",
      uiPriorityUrgent: "#ef4444",
      uiPriorityHigh: "#f97316",
      uiPriorityMedium: "#eab308",
      uiPriorityLow: "#22c55e",
      uiPriorityDefault: "#6b7280",
      uiGradientStart: "#2c2a25",
      uiGradientWarm: "#c06a3d",
      uiGradientBrand: "#6d8b73",
      uiGradientViolet: "#7c5ce0",
      uiGradientEnd: "#2c2a25",
    },
    dark: {
      background: "#131313",
      foreground: "#F4F2EC",
      card: "#1E1E1D",
      cardForeground: "#F4F2EC",
      popover: "#1E1E1D",
      popoverForeground: "#F4F2EC",
      primary: "#F4F2EC",
      primaryForeground: "#121212",
      secondary: "#2A2A28",
      secondaryForeground: "#F4F2EC",
      muted: "#2A2A28",
      mutedForeground: "#C4C0B8",
      accent: "#3A3833",
      accentForeground: "#121212",
      destructive: "#E07B52",
      border: "rgba(255, 255, 255, 0.12)",
      input: "rgba(255, 255, 255, 0.14)",
      ring: "rgba(229, 222, 208, 0.38)",
      chart1: "oklch(0.488 0.243 264.376)",
      chart2: "oklch(0.696 0.17 162.48)",
      chart3: "oklch(0.769 0.188 70.08)",
      chart4: "oklch(0.627 0.265 303.9)",
      chart5: "oklch(0.645 0.246 16.439)",
      sidebar: "#1A1A19",
      sidebarForeground: "#F4F2EC",
      sidebarPrimary: "#F4F2EC",
      sidebarPrimaryForeground: "#121212",
      sidebarAccent: "#2A2A28",
      sidebarAccentForeground: "#F4F2EC",
      sidebarBorder: "rgba(255, 255, 255, 0.12)",
      sidebarRing: "rgba(229, 222, 208, 0.38)",
      uiTextStrong: "#F4F2EC",
      uiTextMain: "#D9D5CC",
      uiTextMuted: "#A9A297",
      uiTextSubtle: "#817A70",
      uiBorderSoft: "rgba(255, 255, 255, 0.18)",
      uiSurfaceSoft: "#262625",
      uiSurfaceBase: "#1A1A19",
      uiAccentBrand: "#9AB79E",
      uiActionBg: "#F4F2EC",
      uiActionHover: "#E0DACF",
      uiAccentCopper: "#E0A078",
      uiAccentIndigo: "#A89BFF",
      uiPriorityUrgent: "#f87171",
      uiPriorityHigh: "#fb923c",
      uiPriorityMedium: "#facc15",
      uiPriorityLow: "#4ade80",
      uiPriorityDefault: "#9ca3af",
      uiGradientStart: "#1a1a19",
      uiGradientWarm: "#e0a078",
      uiGradientBrand: "#9ab79e",
      uiGradientViolet: "#a89bff",
      uiGradientEnd: "#1a1a19",
    },
  },
  graphite: {
    id: "graphite",
    label: "Graphite Studio",
    radius: "0.75rem",
    light: {
      background: "#F3F5FA",
      foreground: "#111827",
      card: "#FFFFFF",
      cardForeground: "#111827",
      popover: "#FFFFFF",
      popoverForeground: "#111827",
      primary: "#1D4ED8",
      primaryForeground: "#F8FAFC",
      secondary: "#E7ECF6",
      secondaryForeground: "#1F2937",
      muted: "#EBEFF7",
      mutedForeground: "#56627A",
      accent: "#DCE5F5",
      accentForeground: "#1F2937",
      destructive: "#DC2626",
      border: "#D3DBE9",
      input: "#CAD4E6",
      ring: "#425A8A",
      chart1: "oklch(0.56 0.20 258)",
      chart2: "oklch(0.71 0.17 198)",
      chart3: "oklch(0.52 0.09 240)",
      chart4: "oklch(0.82 0.14 96)",
      chart5: "oklch(0.68 0.13 38)",
      sidebar: "#EAF0FA",
      sidebarForeground: "#111827",
      sidebarPrimary: "#1D4ED8",
      sidebarPrimaryForeground: "#F8FAFC",
      sidebarAccent: "#DCE5F5",
      sidebarAccentForeground: "#1F2937",
      sidebarBorder: "#CFD8E9",
      sidebarRing: "#425A8A",
      uiTextStrong: "#0F172A",
      uiTextMain: "#1F2937",
      uiTextMuted: "#5B667B",
      uiTextSubtle: "#91A0BA",
      uiBorderSoft: "#D5DFEF",
      uiSurfaceSoft: "#EEF3FC",
      uiSurfaceBase: "#FFFFFF",
      uiAccentBrand: "#2563EB",
      uiActionBg: "#111827",
      uiActionHover: "#1F2937",
      uiAccentCopper: "#C46B4C",
      uiAccentIndigo: "#4F46E5",
      uiPriorityUrgent: "#ef4444",
      uiPriorityHigh: "#f97316",
      uiPriorityMedium: "#eab308",
      uiPriorityLow: "#22c55e",
      uiPriorityDefault: "#6b7280",
      uiGradientStart: "#1f2937",
      uiGradientWarm: "#c46b4c",
      uiGradientBrand: "#2563eb",
      uiGradientViolet: "#4f46e5",
      uiGradientEnd: "#1f2937",
    },
    dark: {
      background: "#0B1220",
      foreground: "#E5EAF5",
      card: "#101A2E",
      cardForeground: "#E5EAF5",
      popover: "#101A2E",
      popoverForeground: "#E5EAF5",
      primary: "#93C5FD",
      primaryForeground: "#0B1220",
      secondary: "#1A243B",
      secondaryForeground: "#E5EAF5",
      muted: "#1A243B",
      mutedForeground: "#A2AECB",
      accent: "#24314F",
      accentForeground: "#E5EAF5",
      destructive: "#F87171",
      border: "rgba(148, 163, 184, 0.25)",
      input: "rgba(148, 163, 184, 0.3)",
      ring: "rgba(147, 197, 253, 0.45)",
      chart1: "oklch(0.72 0.16 250)",
      chart2: "oklch(0.76 0.14 190)",
      chart3: "oklch(0.64 0.10 230)",
      chart4: "oklch(0.75 0.14 102)",
      chart5: "oklch(0.70 0.13 40)",
      sidebar: "#0E172A",
      sidebarForeground: "#E5EAF5",
      sidebarPrimary: "#93C5FD",
      sidebarPrimaryForeground: "#0B1220",
      sidebarAccent: "#1A243B",
      sidebarAccentForeground: "#E5EAF5",
      sidebarBorder: "rgba(148, 163, 184, 0.25)",
      sidebarRing: "rgba(147, 197, 253, 0.45)",
      uiTextStrong: "#E5EAF5",
      uiTextMain: "#CBD5E1",
      uiTextMuted: "#9AA6C2",
      uiTextSubtle: "#74839F",
      uiBorderSoft: "rgba(148, 163, 184, 0.32)",
      uiSurfaceSoft: "#16233B",
      uiSurfaceBase: "#101A2E",
      uiAccentBrand: "#60A5FA",
      uiActionBg: "#93C5FD",
      uiActionHover: "#BFDBFE",
      uiAccentCopper: "#E7A98E",
      uiAccentIndigo: "#A5B4FC",
      uiPriorityUrgent: "#fca5a5",
      uiPriorityHigh: "#fdba74",
      uiPriorityMedium: "#fde047",
      uiPriorityLow: "#86efac",
      uiPriorityDefault: "#94a3b8",
      uiGradientStart: "#0e172a",
      uiGradientWarm: "#e7a98e",
      uiGradientBrand: "#60a5fa",
      uiGradientViolet: "#a5b4fc",
      uiGradientEnd: "#0e172a",
    },
  },
};

export const DEFAULT_UI_VIBE: UiVibeId = "linen";

export function resolveUiVibeId(input?: string): UiVibeId {
  if (!input) {
    return DEFAULT_UI_VIBE;
  }

  const normalized = input.trim().toLowerCase();
  return normalized in UI_VIBES ? (normalized as UiVibeId) : DEFAULT_UI_VIBE;
}

export function getUiVibe(input?: string): UiVibeDefinition {
  const vibeId = resolveUiVibeId(input);
  return UI_VIBES[vibeId];
}

export function getUiVibeCssVariables(input?: string): CSSProperties {
  const vibe = getUiVibe(input);
  const cssVariables: Record<string, string> = {
    "--vibe-radius": vibe.radius,
  };

  for (const mode of ["light", "dark"] as const) {
    for (const key of VIBE_SCHEME_KEYS) {
      const variableSuffix = TOKEN_SUFFIX[key];
      cssVariables[`--vibe-${mode}-${variableSuffix}`] = vibe[mode][key];
    }
  }

  return cssVariables as CSSProperties;
}

export function getAvailableUiVibes(): UiVibeId[] {
  return Object.keys(UI_VIBES) as UiVibeId[];
}
