import { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { getTheme, getThemeNames } from "./themes";
import overlayConfig from "./overlayConfig";
import socket from "./socket";

const ThemeContext = createContext(null);

export function ThemeProvider({ children, initialTheme, initialConfig, listenForLive = true }) {
  const [themeName, setThemeName] = useState(
    initialTheme || overlayConfig.activeTheme
  );
  const [config, setConfig] = useState({ ...overlayConfig, ...initialConfig });

  useEffect(() => {
    if (!listenForLive) return;

    const onActiveTheme = (name) => {
      if (typeof name === "string" && getThemeNames().includes(name)) {
        setThemeName(name);
      }
    };

    socket.on("activeThemeChanged", onActiveTheme);
    socket.emit("requestActiveTheme");

    return () => socket.off("activeThemeChanged", onActiveTheme);
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
