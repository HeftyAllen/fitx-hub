import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";

export type Theme = "dark" | "light";

const BASE_KEY = "fitx-theme";
const DEFAULT_THEME: Theme = "dark";

/** Theme is stored per identity so one member's choice never leaks to the next person on the device. */
const keyFor = (scope: string | null) => `${BASE_KEY}:${scope ?? "guest"}`;

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  /** Bind the theme store to a user id (or null for guest/signed-out). */
  bindUser: (uid: string | null) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
  bindUser: () => {},
});

function read(scope: string | null): Theme {
  try {
    const stored = localStorage.getItem(keyFor(scope));
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#0F172A" : "#F7F9FC";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>(() => read(null));
  const scopeRef = useRef<string | null>(null);

  const bindUser = useCallback((uid: string | null) => {
    setScope((prev) => (prev === uid ? prev : uid));
  }, []);

  // When identity changes, load that identity's preference (default dark, never inherited).
  useEffect(() => {
    scopeRef.current = scope;
    setThemeState(read(scope));
  }, [scope]);

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(keyFor(scopeRef.current), theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, bindUser }}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
