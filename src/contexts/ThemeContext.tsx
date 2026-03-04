import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";
export type ThemeColor =
  | "blue"
  | "red"
  | "green"
  | "purple"
  | "pink"
  | "sky"
  | "orange"
  | "gray"
  | "world-cup-main"
  | "world-cup-brazil";

const STORAGE_MODE_KEY = "lvh:theme-mode";
const STORAGE_COLOR_KEY = "lvh:theme-color";

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
  value === "world-cup-main" ||
  value === "world-cup-brazil";

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
    return isThemeColor(stored) ? stored : "blue";
  } catch {
    return "blue";
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

const applyToDom = (mode: ThemeMode, color: ThemeColor) => {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.dataset.color = color;
  applyFavicon(mode);
};

type ThemeContextValue = {
  mode: ThemeMode;
  color: ThemeColor;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setColor: (color: ThemeColor) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>(() => readInitialMode());
  const [color, setColor] = useState<ThemeColor>(() => readInitialColor());

  useLayoutEffect(() => {
    applyToDom(mode, color);
  }, [mode, color]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MODE_KEY, mode);
      localStorage.setItem(STORAGE_COLOR_KEY, color);
    } catch {
      // ignore storage errors (private mode, blocked storage, etc.)
    }
  }, [mode, color]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      color,
      setMode,
      toggleMode: () => setMode((m) => (m === "dark" ? "light" : "dark")),
      setColor,
    }),
    [mode, color],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
