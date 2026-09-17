import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from "react";
import overlayConfig from "./overlayConfig";
import socket from "./socket";
import { getApiBase } from "../apiOrigin";
import { resolveTheme, isKnownTheme, listAvailableThemes } from "./utils/resolveTheme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children, initialTheme, initialConfig, listenForLive = true }) {
  /** When preset/URL pinned a theme, don't let HTTP bootstrap replace it before socket runs */
  const explicitInitialThemeRef = useRef(Boolean(initialTheme != null && String(initialTheme).trim() !== ""));
  const [themeName, setThemeName] = useState(
    initialTheme || overlayConfig.activeTheme
  );
  const [config, setConfig] = useState({ ...overlayConfig, ...initialConfig });
  const [customOverlayThemes, setCustomOverlayThemes] = useState({});

  useEffect(() => {
    explicitInitialThemeRef.current = Boolean(initialTheme != null && String(initialTheme).trim() !== "");
  }, [initialTheme]);

  useEffect(() => {
    const base = getApiBase();
    const loadCustom = (s) => {
      if (s?.customOverlayThemes && typeof s.customOverlayThemes === "object" && !Array.isArray(s.customOverlayThemes)) {
        setCustomOverlayThemes(s.customOverlayThemes);
      }
    };
    socket.on("settingsUpdated", loadCustom);
    socket.emit("requestSettings");
    fetch(`${base}/settings`, { cache: "no-store" })
      .then((r) => r.json())
      .then(loadCustom)
      .catch(() => {});
    return () => socket.off("settingsUpdated", loadCustom);
  }, []);

  useEffect(() => {
    if (!listenForLive) return;

    let cancelled = false;
    const base = getApiBase();
    fetch(`${base}/overlay/active-theme`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const t = d?.theme;
        if (typeof t === "string" && isKnownTheme(t, customOverlayThemes) && !explicitInitialThemeRef.current) {
          setThemeName(t);
        }
      })
      .catch(() => {});

    const onActiveTheme = (name) => {
      if (typeof name === "string" && isKnownTheme(name, customOverlayThemes)) {
        setThemeName(name);
      }
    };

    socket.on("activeThemeChanged", onActiveTheme);
    socket.emit("requestActiveTheme");

    return () => {
      cancelled = true;
      socket.off("activeThemeChanged", onActiveTheme);
    };
  }, [listenForLive, customOverlayThemes]);

  const theme = useMemo(
    () => resolveTheme(themeName, customOverlayThemes),
    [themeName, customOverlayThemes]
  );

  const switchTheme = useCallback(
    (name) => {
      if (isKnownTheme(name, customOverlayThemes)) setThemeName(name);
    },
    [customOverlayThemes]
  );

  const updateConfig = useCallback((patch) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const availableThemes = useMemo(
    () => listAvailableThemes(customOverlayThemes),
    [customOverlayThemes]
  );

  const value = useMemo(
    () => ({
      theme,
      themeName,
      config,
      switchTheme,
      updateConfig,
      availableThemes,
      customOverlayThemes,
    }),
    [theme, themeName, config, switchTheme, updateConfig, availableThemes, customOverlayThemes]
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
