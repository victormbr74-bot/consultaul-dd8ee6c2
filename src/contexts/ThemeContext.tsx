import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  DEFAULT_WORLD_CUP_TEAM,
  WORLD_CUP_2026_TEAM_BY_ID,
  isWorldCupTeam,
  type WorldCupTeam,
} from "@/data/worldCup2026Teams";
import {
  BRASILEIRAO_SERIE_A_TEAM_BY_ID,
  DEFAULT_BRASILEIRAO_SERIE_A_TEAM,
  isBrasileiraoSerieATeam,
  type BrasileiraoSerieATeam,
} from "@/data/brasileiraoSerieATeams";
import brazilFlag from "@/assets/flags/brazil.png";

export type ThemeMode = "light" | "dark";
export type ThemeColor = "blue" | "red" | "green" | "purple" | "pink" | "sky" | "orange" | "gray" | "brazil" | "world-cup" | "brasileirao";

type HslColor = {
  h: number;
  s: number;
  l: number;
};

const STORAGE_MODE_KEY = "lvh:theme-mode";
const STORAGE_COLOR_KEY = "lvh:theme-color";
const STORAGE_WORLD_CUP_TEAM_KEY = "lvh:theme-world-cup-team";
const STORAGE_BRASILEIRAO_TEAM_KEY = "lvh:theme-brasileirao-team";

const DYNAMIC_THEME_VARS = [
  "--primary",
  "--ring",
  "--accent",
  "--accent-foreground",
  "--sidebar-background",
  "--sidebar-accent",
  "--sidebar-border",
  "--sidebar-ring",
  "--theme-background-image",
  "--theme-background-size",
  "--theme-background-opacity",
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
  value === "brazil" ||
  value === "world-cup" ||
  value === "brasileirao";

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

const clearDynamicTheme = (root: HTMLElement) => {
  DYNAMIC_THEME_VARS.forEach((cssVar) => root.style.removeProperty(cssVar));
};

const applySportsTheme = (
  root: HTMLElement,
  mode: ThemeMode,
  palette: { primary: string; accent: string },
  backgroundImage: string,
  backgroundSize = "contain",
) => {
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
    root.style.setProperty("--theme-background-image", backgroundImage);
    root.style.setProperty("--theme-background-size", backgroundSize);
    root.style.setProperty("--theme-background-opacity", "0.08");
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
  root.style.setProperty("--theme-background-image", backgroundImage);
  root.style.setProperty("--theme-background-size", backgroundSize);
  root.style.setProperty("--theme-background-opacity", "0.11");
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

const readInitialBrasileiraoTeam = (): BrasileiraoSerieATeam => {
  try {
    const stored = localStorage.getItem(STORAGE_BRASILEIRAO_TEAM_KEY);
    return isBrasileiraoSerieATeam(stored) ? stored : DEFAULT_BRASILEIRAO_SERIE_A_TEAM;
  } catch {
    return DEFAULT_BRASILEIRAO_SERIE_A_TEAM;
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

const applyToDom = (mode: ThemeMode, color: ThemeColor, worldCupTeam: WorldCupTeam, brasileiraoTeam: BrasileiraoSerieATeam) => {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.dataset.color = color;
  root.dataset.worldCupTeam = worldCupTeam;
  root.dataset.brasileiraoTeam = brasileiraoTeam;

  if (color === "world-cup") {
    const team = WORLD_CUP_2026_TEAM_BY_ID[worldCupTeam];
    applySportsTheme(root, mode, team, `url("${team.flagImg}")`, "cover");
  } else if (color === "brazil") {
    applySportsTheme(root, mode, { primary: "142 72% 30%", accent: "48 98% 50%" }, `url("${brazilFlag}")`, "cover");
  } else if (color === "brasileirao") {
    const team = BRASILEIRAO_SERIE_A_TEAM_BY_ID[brasileiraoTeam];
    applySportsTheme(root, mode, team, `url("${team.imageUrl}")`);
  } else {
    clearDynamicTheme(root);
  }

  applyFavicon(mode);
};

type ThemeContextValue = {
  mode: ThemeMode;
  color: ThemeColor;
  worldCupTeam: WorldCupTeam;
  brasileiraoTeam: BrasileiraoSerieATeam;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setColor: (color: ThemeColor) => void;
  setWorldCupTeam: (team: WorldCupTeam) => void;
  setBrasileiraoTeam: (team: BrasileiraoSerieATeam) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>(() => readInitialMode());
  const [color, setColor] = useState<ThemeColor>(() => readInitialColor());
  const [worldCupTeam, setWorldCupTeam] = useState<WorldCupTeam>(() => readInitialWorldCupTeam());
  const [brasileiraoTeam, setBrasileiraoTeam] = useState<BrasileiraoSerieATeam>(() => readInitialBrasileiraoTeam());

  useLayoutEffect(() => {
    applyToDom(mode, color, worldCupTeam, brasileiraoTeam);
  }, [mode, color, worldCupTeam, brasileiraoTeam]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MODE_KEY, mode);
      localStorage.setItem(STORAGE_COLOR_KEY, color);
      localStorage.setItem(STORAGE_WORLD_CUP_TEAM_KEY, worldCupTeam);
      localStorage.setItem(STORAGE_BRASILEIRAO_TEAM_KEY, brasileiraoTeam);
    } catch {
      // ignore storage errors (private mode, blocked storage, etc.)
    }
  }, [mode, color, worldCupTeam, brasileiraoTeam]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      color,
      worldCupTeam,
      brasileiraoTeam,
      setMode,
      toggleMode: () => setMode((currentMode) => (currentMode === "dark" ? "light" : "dark")),
      setColor,
      setWorldCupTeam,
      setBrasileiraoTeam,
    }),
    [mode, color, worldCupTeam, brasileiraoTeam],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
