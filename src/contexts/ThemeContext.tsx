import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  DEFAULT_WORLD_CUP_TEAM,
  WORLD_CUP_2026_TEAM_BY_ID,
  isWorldCupTeam,
  type WorldCupTeam,
} from "@/data/worldCup2026Teams";

export type ThemeMode = "light" | "dark";
export type ThemeColor = "blue" | "red" | "green" | "purple" | "pink" | "sky" | "orange" | "gray" | "world-cup";

type HslColor = {
  h: number;
  s: number;
  l: number;
};

const STORAGE_MODE_KEY = "lvh:theme-mode";
const STORAGE_COLOR_KEY = "lvh:theme-color";
const STORAGE_WORLD_CUP_TEAM_KEY = "lvh:theme-world-cup-team";

const WORLD_CUP_THEME_VARS = [
  "--primary",
  "--ring",
  "--accent",
  "--accent-foreground",
  "--sidebar-background",
  "--sidebar-accent",
  "--sidebar-border",
  "--sidebar-ring",
] as const;

const isThemeMode = (value: unknown): value is ThemeMode => value === "light" || value === "dark";
const isThemeColor = (value: unknown): value is ThemeColor =>
  value === "blue" ||
  value === "red" ||
  value === "green" ||
  value === "purple" ||
  value === "pink" ||
  value === "sky" ||
  value === "orange" ||
  value === "gray" ||
  value === "world-cup";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeHue = (hue: number) => ((hue % 360) + 360) % 360;

const parseHsl = (value: string): HslColor => {
  const match = /^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/.exec(value.trim());
  if (!match) return { h: 0, s: 0, l: 0 };

  return {
    h: Number(match[1]),
    s: Number(match[2]),
    l: Number(match[3]),
  };
};

const formatHsl = ({ h, s, l }: HslColor) =>
  `${Math.round(normalizeHue(h))} ${Math.round(clamp(s, 0, 100))}% ${Math.round(clamp(l, 0, 100))}%`;

const withLightness = (color: HslColor, lightness: number): HslColor => ({
  ...color,
  l: clamp(lightness, 0, 100),
});

const getContrastForeground = (color: HslColor) => (color.l >= 60 ? "220 25% 10%" : "0 0% 100%");

const clearWorldCupTheme = (root: HTMLElement) => {
  WORLD_CUP_THEME_VARS.forEach((cssVar) => root.style.removeProperty(cssVar));
};

const applyWorldCupTheme = (root: HTMLElement, mode: ThemeMode, team: WorldCupTeam) => {
  const palette = WORLD_CUP_2026_TEAM_BY_ID[team];
  const primaryBase = parseHsl(palette.primary);
  const accentBase = parseHsl(palette.accent);

  if (mode === "light") {
    const primary = withLightness(primaryBase, clamp(primaryBase.l, 26, 45));
    const accent = withLightness(accentBase, clamp(accentBase.l, 20, 70));

    root.style.setProperty("--primary", formatHsl(primary));
    root.style.setProperty("--ring", formatHsl(primary));
    root.style.setProperty("--accent", formatHsl(accent));
    root.style.setProperty("--accent-foreground", getContrastForeground(accent));
    root.style.setProperty("--sidebar-background", formatHsl(withLightness(primary, 20)));
    root.style.setProperty("--sidebar-accent", formatHsl(withLightness(primary, 28)));
    root.style.setProperty("--sidebar-border", formatHsl(withLightness(primary, 30)));
    root.style.setProperty("--sidebar-ring", formatHsl(accent));
    return;
  }

  const primary = withLightness(primaryBase, clamp(primaryBase.l + 20, 46, 68));
  const accent = withLightness(accentBase, clamp(accentBase.l + 12, 44, 72));

  root.style.setProperty("--primary", formatHsl(primary));
  root.style.setProperty("--ring", formatHsl(primary));
  root.style.setProperty("--accent", formatHsl(accent));
  root.style.setProperty("--accent-foreground", getContrastForeground(accent));
  root.style.setProperty("--sidebar-background", formatHsl(withLightness(primary, 8)));
  root.style.setProperty("--sidebar-accent", formatHsl(withLightness(primary, 14)));
  root.style.setProperty("--sidebar-border", formatHsl(withLightness(primary, 18)));
  root.style.setProperty("--sidebar-ring", formatHsl(accent));
};

const getSystemMode = (): ThemeMode => {
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  } catch {
    return "light";
  }
};

const readInitialMode = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(STORAGE_MODE_KEY);
    return isThemeMode(stored) ? stored : getSystemMode();
  } catch {
    return getSystemMode();
  }
};

const readInitialColor = (): ThemeColor => {
  try {
    const stored = localStorage.getItem(STORAGE_COLOR_KEY);
    if (stored === "world-cup-main" || stored === "world-cup-brazil") return "world-cup";
    return isThemeColor(stored) ? stored : "blue";
  } catch {
    return "blue";
  }
};

const readInitialWorldCupTeam = (): WorldCupTeam => {
  try {
    const stored = localStorage.getItem(STORAGE_WORLD_CUP_TEAM_KEY);
    if (isWorldCupTeam(stored)) return stored;

    const legacyColor = localStorage.getItem(STORAGE_COLOR_KEY);
    if (legacyColor === "world-cup-brazil") return "brazil";

    return DEFAULT_WORLD_CUP_TEAM;
  } catch {
    return DEFAULT_WORLD_CUP_TEAM;
  }
};

const applyFavicon = (mode: ThemeMode) => {
  const link = document.getElementById("app-favicon") as HTMLLinkElement | null;
  if (!link) return;

  const nextHref = mode === "dark" ? link.dataset.hrefDark : link.dataset.hrefLight;
  if (!nextHref) return;

  if (link.getAttribute("href") !== nextHref) {
    link.setAttribute("href", nextHref);
  }
};

const applyToDom = (mode: ThemeMode, color: ThemeColor, worldCupTeam: WorldCupTeam) => {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.dataset.color = color;
  root.dataset.worldCupTeam = worldCupTeam;

  if (color === "world-cup") {
    applyWorldCupTheme(root, mode, worldCupTeam);
  } else {
    clearWorldCupTheme(root);
  }

  applyFavicon(mode);
};

type ThemeContextValue = {
  mode: ThemeMode;
  color: ThemeColor;
  worldCupTeam: WorldCupTeam;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setColor: (color: ThemeColor) => void;
  setWorldCupTeam: (team: WorldCupTeam) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>(() => readInitialMode());
  const [color, setColor] = useState<ThemeColor>(() => readInitialColor());
  const [worldCupTeam, setWorldCupTeam] = useState<WorldCupTeam>(() => readInitialWorldCupTeam());

  useLayoutEffect(() => {
    applyToDom(mode, color, worldCupTeam);
  }, [mode, color, worldCupTeam]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MODE_KEY, mode);
      localStorage.setItem(STORAGE_COLOR_KEY, color);
      localStorage.setItem(STORAGE_WORLD_CUP_TEAM_KEY, worldCupTeam);
    } catch {
      // ignore storage errors (private mode, blocked storage, etc.)
    }
  }, [mode, color, worldCupTeam]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      color,
      worldCupTeam,
      setMode,
      toggleMode: () => setMode((currentMode) => (currentMode === "dark" ? "light" : "dark")),
      setColor,
      setWorldCupTeam,
    }),
    [mode, color, worldCupTeam],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
