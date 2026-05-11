import { createContext, useContext, useMemo, useCallback, useEffect, useState } from "react";
import { getEngineTheme, getEngineThemeIds } from "./themes";
import { getDesign, getDesignCatalog } from "./designs";
import { applyDesignToTheme } from "./utils/applyDesign";
import { ANIMATION_PACK_IDS } from "./animations/packs";
import { ALIVE_STYLE_IDS } from "./alive-styles/AliveIndicator";
import socket from "../overlays/socket";
import { legacyThemeToEngineTheme } from "./configs/adminThemeBridge";
import { resolveEngineUrlParams } from "./configs/resolveEngineUrlParams";
import { defaultEngineConfig } from "./configs/defaultEngineConfig";
import { isValidAliveId } from "./alive-styles/aliveCatalog";

const Ctx = createContext(null);

function bundlesJsonUrl() {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}broadcast-engine/bundles.json`;
}

function normalizeAlive(id) {
  return isValidAliveId(id) ? id : "rounded";
}

function normalizeAnim(id) {
  return ANIMATION_PACK_IDS.includes(id) ? id : "subtle";
}

export function EngineOverlayProvider({ children }) {
  const [tick, setTick] = useState(0);
  const [adminSyncedThemeId, setAdminSyncedThemeId] = useState(null);
  const [jsonBundles, setJsonBundles] = useState({});
  const [engineSavedPrefs, setEngineSavedPrefs] = useState(null);

  useEffect(() => {
    const onSettings = (s) => {
      setEngineSavedPrefs(s?.engineOverlayPrefs && typeof s.engineOverlayPrefs === "object" ? s.engineOverlayPrefs : null);
    };
    socket.on("settingsUpdated", onSettings);
    socket.emit("requestSettings");
    return () => socket.off("settingsUpdated", onSettings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(bundlesJsonUrl())
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (cancelled || !data || typeof data !== "object" || Array.isArray(data)) return;
        setJsonBundles(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onPop = () => setTick((t) => t + 1);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const params = useMemo(
    () => resolveEngineUrlParams(window.location.search, jsonBundles, window.location.pathname, engineSavedPrefs),
    [tick, jsonBundles, engineSavedPrefs],
  );

  useEffect(() => {
    if (!params.syncAdmin) {
      setAdminSyncedThemeId(null);
      return;
    }
    const onActive = (name) => {
      const id = legacyThemeToEngineTheme(name);
      const ids = getEngineThemeIds();
      if (id && ids.includes(id)) setAdminSyncedThemeId(id);
    };
    socket.on("activeThemeChanged", onActive);
    socket.emit("requestActiveTheme");
    return () => socket.off("activeThemeChanged", onActive);
  }, [params.syncAdmin, tick]);

  const resolved = useMemo(() => {
    const ids = getEngineThemeIds();
    const themeId =
      params.syncAdmin && adminSyncedThemeId && ids.includes(adminSyncedThemeId)
        ? adminSyncedThemeId
        : ids.includes(params.engineTheme)
          ? params.engineTheme
          : ids[0];
    const base = getEngineTheme(themeId);
    const design = getDesign(params.engineDesign);
    const merged = applyDesignToTheme(base, design);
    const aliveStyle = normalizeAlive(params.aliveStyle);
    const animationPack = normalizeAnim(params.animationPack);
    const aliveLayout = params.aliveLayout === "line" ? "line" : "grid";
    return {
      theme: merged,
      themeId,
      design,
      designId: design.id,
      aliveStyle,
      aliveLayout,
      aliveCustomAlive: params.aliveIconAlive || null,
      aliveCustomDead: params.aliveIconDead || null,
      animationPack,
      enableAnimations: params.engineAnimations,
      bundleId: params.bundleId || null,
    };
  }, [
    params.engineTheme,
    params.engineDesign,
    params.aliveStyle,
    params.aliveLayout,
    params.aliveIconAlive,
    params.aliveIconDead,
    params.animationPack,
    params.engineAnimations,
    tick,
    params.syncAdmin,
    adminSyncedThemeId,
  ]);

  const config = useMemo(
    () => ({
      ...defaultEngineConfig,
      compactMode: defaultEngineConfig.compactMode,
      enableAnimations: resolved.enableAnimations,
      enableGlow: defaultEngineConfig.enableGlow,
      enableBackgroundEffects: defaultEngineConfig.enableBackgroundEffects,
      board: { ...defaultEngineConfig.board },
      wwcd: { ...defaultEngineConfig.wwcd },
    }),
    [resolved.enableAnimations]
  );

  /** Dev: cycle theme with Alt+Arrow (OBS browser source keyboard) */
  const cycleTheme = useCallback((delta) => {
    const ids = getEngineThemeIds();
    const i = Math.max(0, ids.indexOf(resolved.themeId));
    const n = (i + delta + ids.length) % ids.length;
    const u = new URL(window.location.href);
    u.searchParams.set("engineTheme", ids[n]);
    window.history.pushState({}, "", u);
    setTick((t) => t + 1);
  }, [resolved.themeId]);

  const value = useMemo(
    () => ({
      ...resolved,
      config,
      availableThemeIds: getEngineThemeIds(),
      availableDesignIds: getDesignCatalog().map((d) => d.id),
      availableAliveStyles: ALIVE_STYLE_IDS,
      availableAnimPacks: ANIMATION_PACK_IDS,
      cycleTheme,
    }),
    [resolved, config, cycleTheme]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey) return;
      if (e.code === "ArrowRight") cycleTheme(1);
      if (e.code === "ArrowLeft") cycleTheme(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycleTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEngineOverlay() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEngineOverlay requires EngineOverlayProvider");
  return ctx;
}

export default EngineOverlayProvider;
