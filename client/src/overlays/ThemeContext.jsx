import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from "react";
import { getTheme, getThemeNames } from "./themes";
import overlayConfig from "./overlayConfig";
import socket from "./socket";
import { getApiBase } from "../apiOrigin";

const ThemeContext = createContext(null);

export function ThemeProvider({ children, initialTheme, initialConfig, listenForLive = true }) {
  /** When preset/URL pinned a theme, don't let HTTP bootstrap replace it before socket runs */
  const explicitInitialThemeRef = useRef(Boolean(initialTheme != null && String(initialTheme).trim() !== ""));
  const [themeName, setThemeName] = useState(
    initialTheme || overlayConfig.activeTheme
  );
  const [config, setConfig] = useState({ ...overlayConfig, ...initialConfig });

  useEffect(() => {
    explicitInitialThemeRef.current = Boolean(initialTheme != null && String(initialTheme).trim() !== "");
  }, [initialTheme]);

  useEffect(() => {
    if (!listenForLive) return;

    let cancelled = false;
    const base = getApiBase();
    fetch(`${base}/overlay/active-theme`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const t = d?.theme;
        if (typeof t === "string" && getThemeNames().includes(t) && !explicitInitialThemeRef.current) {
          setThemeName(t);
        }
      })
      .catch(() => {});

    const onActiveTheme = (name) => {
      if (typeof name === "string" && getThemeNames().includes(name)) {
        setThemeName(name);
      }
    };

    socket.on("activeThemeChanged", onActiveTheme);
    socket.emit("requestActiveTheme");

    return () => {
      cancelled = true;
      socket.off("activeThemeChanged", onActiveTheme);
    };
  }, [listenForLive]);

  const theme = useMemo(() => getTheme(themeName), [themeName]);

  const switchTheme = useCallback((name) => {
    if (getThemeNames().includes(name)) setThemeName(name);
  }, []);

  const updateConfig = useCallback((patch) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(
    () => ({ theme, themeName, config, switchTheme, updateConfig, availableThemes: getThemeNames() }),
    [theme, themeName, config, switchTheme, updateConfig]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
