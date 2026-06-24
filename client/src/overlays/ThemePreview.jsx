import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { getTheme, getThemeNames } from "./themes";
import { getPresetNames, getPresetConfig } from "./presets";
import overlayConfig from "./overlayConfig";
import useAnimation from "./animations/useAnimation";
import keyframes from "./animations/keyframes";
import { engineKeyframeCss } from "../overlay-engine/animations/keyframes";
import AliveIndicator, { ALIVE_STYLE_IDS } from "../overlay-engine/alive-styles/AliveIndicator";
import socket, { API } from "./socket";
import { getOverlayPageOrigin } from "../apiOrigin";
import { overlayPathMatches } from "./utils/overlayPrefsMatch";
import { mergeThemeOverride } from "./utils/mergeThemeOverride";
import {
  themePreviewPremiumKeyframes,
  resolveThemePreviewPremiumPack,
  listThemePreviewPremiumPackOptions,
} from "./themePreviewPremiumAnimations";
import BroadcastRankingBoard, { themeToBroadcastCssVars } from "./components/BroadcastRankingBoard";
import MinimalBroadcastRankingBoard, {
  minimalThemeToCssVars,
} from "./components/MinimalBroadcastRankingBoard";
import MinimalBroadcastWwcdStripCard from "./components/MinimalBroadcastWwcdStripCard";
import EliminationBannerRouter from "./components/EliminationBannerRouter";
import EsportsRankingBoard from "./components/EsportsRankingBoard";
import { isEsportsTournamentGfxTheme } from "./esportsGfxUtils";
import { BMPS_PREVIEW_TEAMS, LIVE_RANKING_FONT_OPTIONS } from "./broadcastBmpsUtils";
import { BROADCAST_WWCD_STRIP_PICKERS, BROADCAST_WWCD_STRIP_DEFAULTS, broadcastElimStyleFromTheme, broadcastElimStyleToGfxDraft, broadcastWwcdDraftFromTheme, broadcastWwcdStripStyleFromTheme, broadcastWwcdStripColorsResolved } from "./broadcastGfxUtils";
import { MINIMAL_WWCD_STRIP_PICKERS, minimalWwcdPickerColor } from "./minimalGfxUtils";
import {
  DEFAULT_MINIMAL_ELIM_ANIMATION,
} from "./minimalElimAnimations";
import BroadcastWwcdStripCard from "./BroadcastWwcdStripCard";
import {
  ELIMINATION_BANNER_LAYOUTS,
  resolveEliminationBannerLayout,
  mergeEliminationForBannerLayout,
  eliminationPickersForLayout,
  isClassicElimBannerLayout,
  elimLayoutUsesDedicatedPickers,
  elimPickerResolvedColor,
} from "./eliminationBannerRegistry";
import { publishGfxPreviewDraft } from "./OverlayGfxAdminPreview";
import { GFX_COLOR_MODE_CUSTOM, GFX_COLOR_MODE_THEME, resolveEliminationBannerColors, eliminationBannerColorsFromTheme } from "../overlayGfxColors";
import { wwcdPercentsForStripTeams } from "../wwcdModel";

const MINIMAL_BROADCAST_COLOR_DEFAULTS = {
  panelBgTop: "#1c1c1c",
  panelBgBottom: "#0a0a0a",
  headerBg: "#085858",
  headerText: "#ffffff",
  textColor: "#ffffff",
  textDim: "#8a8a8a",
  rankTabBg: "#525252",
  rankNumColor: "#ffffff",
  statusAlive: "#00c8c8",
  knockedColor: "#ffcc00",
  eliminatedColor: "#e63946",
  eliminatedBarDim: "#4a4a4a",
  rowDividerBg: "#000000",
  legendBg: "#111111",
  legendText: "#ffffff",
  recallOn: "#c45912",
  recallOff: "#555555",
};

const MINIMAL_BROADCAST_COLOR_SECTIONS = [
  {
    title: "Header",
    keys: [
      ["headerBg", "Header bg"],
      ["headerText", "Header text"],
    ],
  },
  {
    title: "Team & stats text",
    keys: [
      ["textColor", "Active text"],
      ["textDim", "Eliminated text"],
    ],
  },
  {
    title: "Rank tab",
    keys: [
      ["rankTabBg", "Rank tab"],
      ["rankNumColor", "Rank number"],
    ],
  },
  {
    title: "Alive bars",
    keys: [
      ["statusAlive", "Alive"],
      ["knockedColor", "Knocked"],
      ["eliminatedColor", "Eliminated"],
      ["eliminatedBarDim", "Eliminated (dim row)"],
    ],
  },
  {
    title: "Panel & rows",
    keys: [
      ["panelBgTop", "Panel top"],
      ["panelBgBottom", "Panel bottom"],
      ["rowDividerBg", "Row gap"],
    ],
  },
  {
    title: "Legend",
    keys: [
      ["legendBg", "Legend bg"],
      ["legendText", "Legend text"],
    ],
  },
];

const SAMPLE_TEAMS = [
  { id: 1, team: "SOUL", finishes: 4, points: 42, logo: null, alivePlayers: 4, status: "alive" },
  { id: 2, team: "GODL", finishes: 1, points: 28, logo: null, alivePlayers: 3, status: "knocked" },
  { id: 3, team: "FNATIC", finishes: 0, points: 25, logo: null, alivePlayers: 0, status: "eliminated" },
  { id: 4, team: "TSM", finishes: 1, points: 23, logo: null, alivePlayers: 4, status: "alive" },
];

function pruneColorOverrideDraft(d, broadcastLayout = false) {
  if (!d || typeof d !== "object") return {};
  const out = {};
  if (!broadcastLayout) {
    if (d.colors && typeof d.colors === "object" && Object.keys(d.colors).length) out.colors = d.colors;
    if (d.alive && typeof d.alive === "object" && Object.keys(d.alive).length) out.alive = d.alive;
    if (d.row && typeof d.row === "object" && Object.keys(d.row).length) out.row = d.row;
  }
  if (d.broadcast && typeof d.broadcast === "object" && Object.keys(d.broadcast).length) out.broadcast = d.broadcast;
  if (d.elimination && typeof d.elimination === "object" && Object.keys(d.elimination).length) {
    const el = {};
    for (const [k, v] of Object.entries(d.elimination)) {
      if (["bannerLayout", "layout", "animation"].includes(k) && typeof v === "string" && v.length <= 48) {
        el[k] = v;
      } else if (typeof v === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(v.trim())) {
        el[k] = v.trim();
      }
    }
    if (Object.keys(el).length) out.elimination = el;
  }
  if (d.wwcdStrip && typeof d.wwcdStrip === "object" && Object.keys(d.wwcdStrip).length) out.wwcdStrip = d.wwcdStrip;
  if (d.typography && typeof d.typography === "object" && Object.keys(d.typography).length) out.typography = d.typography;
  return out;
}

export default function ThemePreview() {
  const themeNames = getThemeNames();
  const presetNames = getPresetNames();
  const [selected, setSelected] = useState(themeNames[0]);
  const [aliveStyle, setAliveStyle] = useState("heart");
  const [aliveLayout, setAliveLayout] = useState("grid");
  const [custIconAlive, setCustIconAlive] = useState(null);
  const [custIconDead, setCustIconDead] = useState(null);
  const [aliveSaved, setAliveSaved] = useState(false);
  const [uploadNote, setUploadNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [liveTheme, setLiveTheme] = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [themeColorOverridesServer, setThemeColorOverridesServer] = useState({});
  const [colorDraft, setColorDraft] = useState({});
  const [colorSaveMsg, setColorSaveMsg] = useState("");
  const [elimBannerPreviewKey, setElimBannerPreviewKey] = useState(0);
  /** First successful server theme (HTTP or socket) seeds the preview selection once */
  const previewBootstrappedRef = useRef(false);
  const colorHydrateKeyRef = useRef("");
  const colorAutoLastSigRef = useRef("");
  const colorAutoTimerRef = useRef(null);
  /** When true, skip re-hydrating colorDraft from server until save succeeds — avoids wiping mid-edit edits. */
  const colorDraftDirtyRef = useRef(false);
  const lastHydratedThemeRef = useRef(null);
  /** Latest alive picker state for POSTs fired before React re-render (shape / layout clicks). */
  const alivePrefsRef = useRef({
    aliveStyle: "heart",
    aliveLayout: "grid",
    custIconAlive: null,
    custIconDead: null,
  });
  const baseTheme = useMemo(() => getTheme(selected), [selected]);
  const theme = useMemo(() => mergeThemeOverride(baseTheme, colorDraft), [baseTheme, colorDraft]);
  const isBmpsBoard = Boolean(theme.broadcastLayout);
  const isMinimalBroadcast = theme.broadcastVariant === "minimal";
  const teamFont = theme.typography?.fontFamily;
  const numbersFont = theme.typography?.numbersFontFamily || teamFont;
  const broadcastCssVars = useMemo(() => themeToBroadcastCssVars(theme), [theme]);
  const minimalCssVars = useMemo(() => minimalThemeToCssVars(theme), [theme]);
  const activeElimLayout = useMemo(() => resolveEliminationBannerLayout(theme), [theme]);
  const activeElimPickers = useMemo(() => eliminationPickersForLayout(activeElimLayout), [activeElimLayout]);
  const elimGfxColors = useMemo(() => eliminationBannerColorsFromTheme(theme), [theme]);
  const elimPreviewKey = `${elimBannerPreviewKey}-${activeElimLayout}-${colorDraft.elimination?.animation ?? baseTheme.elimination?.animation ?? DEFAULT_MINIMAL_ELIM_ANIMATION}`;

  const previewConfig = useMemo(() => {
    const base = { ...overlayConfig };
    if (activePreset) {
      const p = getPresetConfig(activePreset);
      if (p) Object.assign(base, p);
    }
    return base;
  }, [activePreset]);

  /** Theme Preview demo board only — not wired to `/overlay/themed`. */
  const [previewEnterMode, setPreviewEnterMode] = useState("preset");
  /** BMPS broadcast: standard maps vs Rondo (recall column). */
  const [previewMapMode, setPreviewMapMode] = useState("standard");

  const anim = useAnimation(previewConfig);
  const previewPremiumAnim = useMemo(
    () => (previewEnterMode === "preset" ? null : resolveThemePreviewPremiumPack(previewEnterMode)),
    [previewEnterMode],
  );

  /** Demo ordering for FIN-only strip — mirrors live overlay sortPrimary: "finishes". */
  const finishPreviewTeams = useMemo(
    () =>
      [...SAMPLE_TEAMS].sort((a, b) => {
        if (b.finishes !== a.finishes) return b.finishes - a.finishes;
        if (b.alivePlayers !== a.alivePlayers) return b.alivePlayers - a.alivePlayers;
        return a.id - b.id;
      }),
    [],
  );

  const applyPreset = useCallback((name) => {
    const cfg = getPresetConfig(name);
    if (!cfg?.theme) return;
    setActivePreset(name);
    setSelected(cfg.theme);
    if (cfg.aliveStyle) setAliveStyle(cfg.aliveStyle);
    if (cfg.aliveLayout === "line" || cfg.aliveLayout === "grid") setAliveLayout(cfg.aliveLayout);
  }, []);

  useEffect(() => {
    const applyServerTheme = (name) => {
      if (!name || !themeNames.includes(name)) return;
      setLiveTheme(name);
      if (!previewBootstrappedRef.current) {
        previewBootstrappedRef.current = true;
        setSelected(name);
      }
    };

    fetch(`${API}/overlay/active-theme`)
      .then((r) => r.json())
      .then((d) => applyServerTheme(d?.theme))
      .catch(() => {});

    const onActive = (name) => applyServerTheme(name);
    socket.on("activeThemeChanged", onActive);
    socket.emit("requestActiveTheme");
    return () => socket.off("activeThemeChanged", onActive);
  }, [themeNames]);

  const hydrateAliveFromSettings = useCallback((s) => {
    if (!s || typeof s !== "object") return;
    const tp = s.themedOverlayPrefs;
    if (tp && typeof tp === "object") {
      if (typeof tp.aliveStyle === "string") setAliveStyle(tp.aliveStyle);
      if (tp.aliveLayout === "line" || tp.aliveLayout === "grid") setAliveLayout(tp.aliveLayout);
      setCustIconAlive(typeof tp.aliveCustomAlive === "string" ? tp.aliveCustomAlive : null);
      setCustIconDead(typeof tp.aliveCustomDead === "string" ? tp.aliveCustomDead : null);
      return;
    }
    const ep = s.engineOverlayPrefs;
    if (!ep || typeof ep !== "object") return;
    if (!overlayPathMatches(ep.overlayPath, "/overlay/themed")) return;
    if (typeof ep.aliveStyle === "string") setAliveStyle(ep.aliveStyle);
    if (ep.aliveLayout === "line" || ep.aliveLayout === "grid") setAliveLayout(ep.aliveLayout);
    setCustIconAlive(typeof ep.aliveCustomAlive === "string" ? ep.aliveCustomAlive : null);
    setCustIconDead(typeof ep.aliveCustomDead === "string" ? ep.aliveCustomDead : null);
  }, []);

  useEffect(() => {
    fetch(`${API}/settings`)
      .then((r) => r.json())
      .then((s) => {
        if (s?.themeColorOverrides && typeof s.themeColorOverrides === "object") {
          setThemeColorOverridesServer(s.themeColorOverrides);
        }
        hydrateAliveFromSettings(s);
      })
      .catch(() => {});
  }, [hydrateAliveFromSettings]);

  useEffect(() => {
    alivePrefsRef.current = { aliveStyle, aliveLayout, custIconAlive, custIconDead };
  }, [aliveStyle, aliveLayout, custIconAlive, custIconDead]);

  useEffect(() => {
    const patch = themeColorOverridesServer[selected];
    const sig = JSON.stringify(patch ?? null);
    const hydrateKey = `${selected}|${sig}`;

    const themeChanged = lastHydratedThemeRef.current !== selected;
    lastHydratedThemeRef.current = selected;

    if (themeChanged) {
      colorHydrateKeyRef.current = "";
      colorDraftDirtyRef.current = false;
    }

    if (!themeChanged && colorDraftDirtyRef.current) {
      return;
    }

    if (colorHydrateKeyRef.current === hydrateKey && !themeChanged) return;
    colorHydrateKeyRef.current = hydrateKey;

    if (patch && typeof patch === "object") {
      const nextDraft = {
        colors: { ...(patch.colors || {}) },
        alive: { ...(patch.alive || {}) },
        row: { ...(patch.row || {}) },
        broadcast: { ...(patch.broadcast || {}) },
        elimination: { ...(patch.elimination || {}) },
        wwcdStrip: { ...(patch.wwcdStrip || {}) },
        typography: { ...(patch.typography || {}) },
      };
      setColorDraft(nextDraft);
      colorAutoLastSigRef.current = `${selected}|${JSON.stringify(pruneColorOverrideDraft(nextDraft))}`;
    } else {
      setColorDraft({});
      colorAutoLastSigRef.current = `${selected}|${JSON.stringify({})}`;
    }
  }, [selected, themeColorOverridesServer]);

  useEffect(() => {
    const onSettings = (payload) => {
      const s =
        payload && typeof payload === "object"
          ? payload
          : null;
      if (s) {
        if (s.themeColorOverrides && typeof s.themeColorOverrides === "object") {
          setThemeColorOverridesServer(s.themeColorOverrides);
        }
        hydrateAliveFromSettings(s);
        return;
      }
      fetch(`${API}/settings`)
        .then((r) => r.json())
        .then((body) => {
          if (body?.themeColorOverrides && typeof body.themeColorOverrides === "object") {
            setThemeColorOverridesServer(body.themeColorOverrides);
          }
          hydrateAliveFromSettings(body);
        })
        .catch(() => {});
    };
    socket.on("settingsUpdated", onSettings);
    return () => socket.off("settingsUpdated", onSettings);
  }, [hydrateAliveFromSettings]);

  useEffect(() => {
    const cleaned = pruneColorOverrideDraft(colorDraft, isBmpsBoard);
    const sig = `${selected}|${JSON.stringify(cleaned)}`;
    if (Object.keys(cleaned).length === 0) {
      if (sig === colorAutoLastSigRef.current) colorDraftDirtyRef.current = false;
      return;
    }
    if (sig === colorAutoLastSigRef.current) return;

    if (colorAutoTimerRef.current) clearTimeout(colorAutoTimerRef.current);
    colorAutoTimerRef.current = setTimeout(async () => {
      colorAutoTimerRef.current = null;
      try {
        const cur = await fetch(`${API}/settings`).then((r) => r.json());
        const prev = cur.themeColorOverrides && typeof cur.themeColorOverrides === "object" ? { ...cur.themeColorOverrides } : {};
        const prevThemePatch =
          prev[selected] && typeof prev[selected] === "object" ? { ...prev[selected] } : {};
        const next = { ...prev, [selected]: { ...prevThemePatch, ...cleaned } };
        const payload = { themeColorOverrides: next };
        if (cleaned.elimination && Object.keys(cleaned.elimination).some((k) => !["bannerLayout", "layout", "animation"].includes(k))) {
          payload.eliminationBannerColorMode = GFX_COLOR_MODE_THEME;
        }
        if (cleaned.wwcdStrip && Object.keys(cleaned.wwcdStrip).length > 0) {
          payload.wwcdStripColorMode = GFX_COLOR_MODE_THEME;
        }
        const res = await fetch(`${API}/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          colorDraftDirtyRef.current = false;
          if (data?.themeColorOverrides && typeof data.themeColorOverrides === "object") {
            setThemeColorOverridesServer(data.themeColorOverrides);
          }
          colorAutoLastSigRef.current = sig;
          publishGfxPreviewDraft({
            wwcdStripColorMode: GFX_COLOR_MODE_THEME,
            eliminationBannerColorMode: GFX_COLOR_MODE_THEME,
          });
          setColorSaveMsg("Synced — live ranking, elimination & announcements updated.");
          setTimeout(() => setColorSaveMsg(""), 2200);
        }
      } catch (e) {
        console.error(e);
      }
    }, 450);
    return () => {
      if (colorAutoTimerRef.current) clearTimeout(colorAutoTimerRef.current);
    };
  }, [colorDraft, selected, isBmpsBoard]);

  useEffect(() => {
    if (!colorDraft.elimination || typeof colorDraft.elimination !== "object") return;
    if (Object.keys(colorDraft.elimination).length === 0) return;
    if (isBmpsBoard) {
      const style = broadcastElimStyleFromTheme(theme);
      publishGfxPreviewDraft({
        eliminationBannerColorMode: GFX_COLOR_MODE_CUSTOM,
        eliminationBannerColors: broadcastElimStyleToGfxDraft(style),
      });
      return;
    }
    const layout = resolveEliminationBannerLayout(theme);
    if (elimLayoutUsesDedicatedPickers(layout)) {
      publishGfxPreviewDraft({
        eliminationBannerColorMode: GFX_COLOR_MODE_CUSTOM,
        eliminationBannerColors: resolveEliminationBannerColors(
          GFX_COLOR_MODE_CUSTOM,
          colorDraft.elimination,
          theme,
        ),
      });
    }
  }, [isBmpsBoard, theme, colorDraft.elimination]);

  useEffect(() => {
    if (!colorDraft.wwcdStrip || typeof colorDraft.wwcdStrip !== "object") return;
    if (Object.keys(colorDraft.wwcdStrip).length === 0) return;
    const colors = broadcastWwcdStripColorsResolved(theme, colorDraft.wwcdStrip);
    publishGfxPreviewDraft({
      wwcdStripColorMode: GFX_COLOR_MODE_CUSTOM,
      wwcdStripColors: colors,
    });
  }, [theme, colorDraft.wwcdStrip]);

  const buildThemedSearch = useCallback(() => {
    const p = new URLSearchParams();
    if (activePreset) {
      p.set("preset", activePreset);
    } else {
      p.set("theme", selected);
    }
    p.set("alive", aliveStyle);
    p.set("aliveLayout", aliveLayout);
    if (custIconAlive) p.set("aliveIconAlive", custIconAlive);
    if (custIconDead) p.set("aliveIconDead", custIconDead);
    return p.toString();
  }, [activePreset, selected, aliveStyle, aliveLayout, custIconAlive, custIconDead]);

  const persistThemedPrefsToServer = useCallback(async (overrides = {}) => {
    const cur = await fetch(`${API}/settings`).then((r) => r.json());
    const prev = cur.themedOverlayPrefs && typeof cur.themedOverlayPrefs === "object" ? { ...cur.themedOverlayPrefs } : {};
    const snap = alivePrefsRef.current;
    const themedOverlayPrefs = {
      ...prev,
      aliveStyle: Object.prototype.hasOwnProperty.call(overrides, "aliveStyle") ? overrides.aliveStyle : snap.aliveStyle,
      aliveLayout: Object.prototype.hasOwnProperty.call(overrides, "aliveLayout") ? overrides.aliveLayout : snap.aliveLayout,
      aliveCustomAlive: Object.prototype.hasOwnProperty.call(overrides, "aliveCustomAlive")
        ? overrides.aliveCustomAlive
        : prev.aliveCustomAlive ?? snap.custIconAlive,
      aliveCustomDead: Object.prototype.hasOwnProperty.call(overrides, "aliveCustomDead")
        ? overrides.aliveCustomDead
        : prev.aliveCustomDead ?? snap.custIconDead,
    };
    const res = await fetch(`${API}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themedOverlayPrefs }),
    });
    return res.ok;
  }, []);

  const persistThemedAliveToServer = useCallback(
    async (nextAlive, nextDead) => persistThemedPrefsToServer({ aliveCustomAlive: nextAlive, aliveCustomDead: nextDead }),
    [persistThemedPrefsToServer],
  );

  const uploadAliveFile = useCallback(
    async (e, role) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${API}/upload/alive-icon?role=${role}`, { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUploadNote(data.message || "Upload failed");
          setTimeout(() => setUploadNote(""), 4000);
          return;
        }
        if (data.path) {
          const nextAlive = role === "dead" ? custIconAlive : data.path;
          const nextDead = role === "dead" ? data.path : custIconDead;
          if (role === "dead") setCustIconDead(data.path);
          else setCustIconAlive(data.path);
          let saved = false;
          try {
            saved = await persistThemedAliveToServer(nextAlive, nextDead);
          } catch {
            saved = false;
          }
          setUploadNote(
            saved
              ? "Uploaded & saved — match board (/overlay/themed) will use this PNG."
              : "Uploaded — click Save alive prefs (match board) if the API save failed.",
          );
          setTimeout(() => setUploadNote(""), 6000);
        }
      } catch {
        setUploadNote("Upload failed — is the API running (port 3001)?");
        setTimeout(() => setUploadNote(""), 4000);
      }
    },
    [custIconAlive, custIconDead, persistThemedAliveToServer],
  );

  const saveAlivePrefs = async () => {
    try {
      const ok = await persistThemedAliveToServer(custIconAlive, custIconDead);
      if (ok) {
        setAliveSaved(true);
        setTimeout(() => setAliveSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save alive prefs:", err);
    }
  };

  const persistThemeColorDraft = useCallback(
    async (draft, msg = "Synced — live ranking, elimination & announcements updated.") => {
      const cleaned = pruneColorOverrideDraft(draft, isBmpsBoard);
      if (Object.keys(cleaned).length === 0) return false;
      try {
        const cur = await fetch(`${API}/settings`, { cache: "no-store" }).then((r) => r.json());
        const prev = cur.themeColorOverrides && typeof cur.themeColorOverrides === "object" ? { ...cur.themeColorOverrides } : {};
        const prevThemePatch =
          prev[selected] && typeof prev[selected] === "object" ? { ...prev[selected] } : {};
        const next = { ...prev, [selected]: { ...prevThemePatch, ...cleaned } };
        const layout = cleaned.elimination?.bannerLayout || cleaned.elimination?.layout;
        const payload = { themeColorOverrides: next };
        if (layout) {
          const prevLayouts =
            cur.eliminationBannerLayouts && typeof cur.eliminationBannerLayouts === "object"
              ? { ...cur.eliminationBannerLayouts }
              : {};
          payload.eliminationBannerLayouts = { ...prevLayouts, [selected]: layout };
        }
        if (cleaned.elimination && Object.keys(cleaned.elimination).some((k) => !["bannerLayout", "layout", "animation"].includes(k))) {
          payload.eliminationBannerColorMode = GFX_COLOR_MODE_THEME;
        }
        if (cleaned.wwcdStrip && Object.keys(cleaned.wwcdStrip).length > 0) {
          payload.wwcdStripColorMode = GFX_COLOR_MODE_THEME;
        }
        const res = await fetch(`${API}/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          colorDraftDirtyRef.current = false;
          if (data?.themeColorOverrides && typeof data.themeColorOverrides === "object") {
            setThemeColorOverridesServer(data.themeColorOverrides);
          }
          colorAutoLastSigRef.current = `${selected}|${JSON.stringify(cleaned)}`;
          setColorSaveMsg(msg);
          setTimeout(() => setColorSaveMsg(""), 2200);
          return true;
        }
      } catch (e) {
        console.error(e);
      }
      return false;
    },
    [selected, isBmpsBoard],
  );

  const saveThemeColors = async () => {
    const ok = await persistThemeColorDraft(
      colorDraft,
      "Colors saved — live ranking, elimination & announcements update via socket.",
    );
    if (!ok) setColorSaveMsg("Save failed — is the API running?");
  };

  const resetThemeColors = async () => {
    colorDraftDirtyRef.current = false;
    setColorDraft({});
    try {
      const cur = await fetch(`${API}/settings`).then((r) => r.json());
      const prev = cur.themeColorOverrides && typeof cur.themeColorOverrides === "object" ? { ...cur.themeColorOverrides } : {};
      delete prev[selected];
      const res = await fetch(`${API}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeColorOverrides: prev }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.themeColorOverrides && typeof data.themeColorOverrides === "object") {
          setThemeColorOverridesServer(data.themeColorOverrides);
        }
        setColorSaveMsg("Reverted to built-in theme colors.");
        setTimeout(() => setColorSaveMsg(""), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveTheme = async () => {
    try {
      const res = await fetch(`${API}/overlay/active-theme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: selected }),
      });
      if (res.ok) {
        setLiveTheme(selected);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save theme:", err);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "Inter, system-ui, sans-serif", padding: 30 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Overlay Theme Preview</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {liveTheme && (
              <span style={{ fontSize: 12, color: "#8CB7BE", fontWeight: 700 }}>
                Live: <span style={{ color: "#6FF3CB" }}>{liveTheme}</span>
              </span>
            )}
            <button onClick={saveTheme} style={saveBtn}>
              {saved ? "Saved!" : `Save & Apply "${selected}"`}
            </button>
          </div>
        </div>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>
          Click a theme to preview. <strong style={{ color: "#6FF3CB" }}>Save &amp; Apply</strong> sets the live theme for the match board and elimination banner (via{" "}
          <code style={{ color: "#9cdcfe" }}>activeTheme</code>
          ). Color pickers below <strong style={{ color: "#888" }}>auto-sync</strong> to <code style={{ color: "#6ff3cb" }}>/overlay/themed</code> and{" "}
          <code style={{ color: "#6ff3cb" }}>/overlay/elimination</code> for the selected theme id after a short delay.
        </p>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#666", letterSpacing: "0.12em", marginBottom: 8 }}>ALIVE INDICATOR · ?alive= in OBS</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>LAYOUT ON BOARD</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
              {[
                { id: "grid", label: "Square (2×2)" },
                { id: "line", label: "Single line" },
              ].map((x) => (
                <button
                  key={x.id}
                  type="button"
                onClick={() => {
                  setAliveLayout(x.id);
                  setActivePreset(null);
                  void persistThemedPrefsToServer({ aliveLayout: x.id });
                }}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 8,
                    border: aliveLayout === x.id ? "2px solid #41E8B8" : "1px solid rgba(255,255,255,.12)",
                    background: aliveLayout === x.id ? "rgba(65,232,184,.12)" : "rgba(255,255,255,.04)",
                    color: aliveLayout === x.id ? "#6FF3CB" : "#999",
                    cursor: "pointer",
                  }}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 6 }}>CUSTOM PNG (OPTIONAL)</div>
            {uploadNote ? (
              <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 8 }}>{uploadNote}</div>
            ) : null}
            {(custIconAlive || custIconDead) && (
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                {custIconAlive ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "#666" }}>Alive</span>
                    <img
                      src={`${API}${custIconAlive}?t=${encodeURIComponent(custIconAlive)}`}
                      alt=""
                      style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 4, border: "1px solid rgba(255,255,255,.12)" }}
                    />
                  </div>
                ) : null}
                {custIconDead ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "#666" }}>Dead</span>
                    <img
                      src={`${API}${custIconDead}?t=${encodeURIComponent(custIconDead)}`}
                      alt=""
                      style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 4, border: "1px solid rgba(255,255,255,.12)", opacity: 0.75 }}
                    />
                  </div>
                ) : null}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#aaa", display: "flex", flexDirection: "column", gap: 4 }}>
                Alive (lit)
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,.svg" onChange={(e) => uploadAliveFile(e, "alive")} />
              </label>
              <label style={{ fontSize: 11, color: "#aaa", display: "flex", flexDirection: "column", gap: 4 }}>
                Dead (dim)
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,.svg" onChange={(e) => uploadAliveFile(e, "dead")} />
              </label>
              <button
                type="button"
                onClick={async () => {
                  setCustIconAlive(null);
                  setCustIconDead(null);
                  try {
                    await persistThemedAliveToServer(null, null);
                  } catch {
                    setUploadNote("Cleared in UI — server clear may have failed.");
                    setTimeout(() => setUploadNote(""), 4000);
                  }
                }}
                style={{
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: "1px solid rgba(248,113,113,.35)",
                  background: "rgba(0,0,0,.25)",
                  color: "#fca5a5",
                  cursor: "pointer",
                }}
              >
                Clear PNGs
              </button>
              <button type="button" onClick={saveAlivePrefs} style={saveAliveBtn}>
                {aliveSaved ? "Saved!" : "Save alive prefs (match board)"}
              </button>
            </div>
            <p style={{ fontSize: 10, color: "#666", margin: "0 0 14px", maxWidth: 720, lineHeight: 1.45 }}>
              <strong style={{ color: "#888" }}>Shape &amp; layout</strong> save to the server as you click (same prefs as alive colors across all themes).{" "}
              Custom PNGs still sync on upload — use{" "}
              <strong style={{ color: "#888" }}>Save alive prefs</strong> to re-push icons only if needed.
            </p>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>SHAPE / STYLE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ALIVE_STYLE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setAliveStyle(id);
                  setActivePreset(null);
                  void persistThemedPrefsToServer({ aliveStyle: id });
                }}
                style={{
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: aliveStyle === id ? "2px solid #41E8B8" : "1px solid rgba(255,255,255,.12)",
                  background: aliveStyle === id ? "rgba(65,232,184,.12)" : "rgba(255,255,255,.04)",
                  color: aliveStyle === id ? "#6FF3CB" : "#999",
                  cursor: "pointer",
                }}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        {/* Theme grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 40 }}>
          {themeNames.map((name) => {
            const t = getTheme(name);
            const active = name === selected;
            const isLive = name === liveTheme;
            return (
              <button
                key={name}
                onClick={() => {
                  setSelected(name);
                  setActivePreset(null);
                }}
                style={{
                  padding: "12px 10px",
                  background: active ? t.gradients.header : "rgba(255,255,255,.04)",
                  border: active ? `2px solid ${t.colors.primary}` : isLive ? "2px solid rgba(65,232,184,.4)" : "1px solid rgba(255,255,255,.08)",
                  borderRadius: 8,
                  color: active ? "#fff" : "#aaa",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: "center",
                  transition: "all 0.2s",
                  position: "relative",
                }}
              >
                <div style={{ width: "100%", height: 4, borderRadius: 2, background: t.gradients.topLine, marginBottom: 8 }} />
                {t.name}
                {isLive && (
                  <div style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: "#6FF3CB", boxShadow: "0 0 6px rgba(65,232,184,.6)" }} />
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 40, alignItems: "start" }}>
          {/* Live preview */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#888", letterSpacing: "0.1em", margin: 0 }}>LIVE PREVIEW</h3>
              <button onClick={saveTheme} style={saveBtnSmall}>
                {saved ? "Saved!" : "Save & Apply"}
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              {isBmpsBoard && isMinimalBroadcast ? (
                <>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 6 }}>
                    MAP LAYOUT (BMPS PREVIEW)
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {[
                      { id: "standard", label: "Erangel / Miramar" },
                      { id: "rondo", label: "Rondo (Recall)" },
                    ].map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => setPreviewMapMode(x.id)}
                        style={{
                          padding: "8px 14px",
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 8,
                          border: previewMapMode === x.id ? "2px solid #41E8B8" : "1px solid rgba(255,255,255,.12)",
                          background: previewMapMode === x.id ? "rgba(65,232,184,.12)" : "rgba(255,255,255,.04)",
                          color: previewMapMode === x.id ? "#6FF3CB" : "#999",
                          cursor: "pointer",
                        }}
                      >
                        {x.label}
                      </button>
                    ))}
                  </div>
                  <div
                    style={{
                      width: previewMapMode === "rondo" ? 312 : 268,
                      position: "relative",
                      minHeight: 200,
                      background: "transparent",
                    }}
                  >
                    <MinimalBroadcastRankingBoard
                      teams={BMPS_PREVIEW_TEAMS}
                      cssVars={minimalCssVars}
                      align="center"
                      previewMode
                      showRecall={previewMapMode === "rondo"}
                    />
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>Elimination banner preview</div>
                    {isClassicElimBannerLayout(theme) ? (
                      <p style={{ fontSize: 10, color: "#64748b", lineHeight: 1.45, maxWidth: 360 }}>
                        Classic esports banner — uses <strong style={{ color: "#94a3b8" }}>Palette</strong> colors on the live overlay.
                      </p>
                    ) : (
                      <EliminationBannerRouter
                        theme={theme}
                        gfxColors={elimGfxColors}
                        banner={{ team: "SAMPLE TEAM", rank: 11, finishes: 1, logo: null }}
                        scale={0.72}
                        origin="top left"
                        previewKey={elimPreviewKey}
                      />
                    )}
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>WWCD 4-squad strip preview</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {(() => {
                        const sample = BMPS_PREVIEW_TEAMS.slice(0, 4);
                        const ws = broadcastWwcdStripStyleFromTheme(theme);
                        const pcts = wwcdPercentsForStripTeams(sample);
                        return sample.map((t, i) => (
                          <MinimalBroadcastWwcdStripCard
                            key={t.id}
                            team={t}
                            wwcdPct={pcts[i] ?? 0}
                            teamTagBg={ws.teamTagBg}
                            teamTagText={ws.teamTagText}
                            panelBg={ws.panelBg}
                            accentLine={ws.accentLine}
                            barFilled={ws.barFilled}
                            barDead={ws.barDead}
                            footerBg={ws.footerBg}
                            footerText={ws.footerText}
                            dividerColor={ws.dividerColor}
                            pctTextColor={ws.pctTextColor}
                            fontFamily={ws.fontFamily}
                            cardWidth={ws.cardWidth}
                          />
                        ));
                      })()}
                    </div>
                  </div>
                </>
              ) : isBmpsBoard ? (
                <>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 6 }}>
                    MAP LAYOUT (BMPS PREVIEW)
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {[
                      { id: "standard", label: "Erangel / Miramar" },
                      { id: "rondo", label: "Rondo (Recall)" },
                    ].map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => setPreviewMapMode(x.id)}
                        style={{
                          padding: "8px 14px",
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 8,
                          border: previewMapMode === x.id ? "2px solid #41E8B8" : "1px solid rgba(255,255,255,.12)",
                          background: previewMapMode === x.id ? "rgba(65,232,184,.12)" : "rgba(255,255,255,.04)",
                          color: previewMapMode === x.id ? "#6FF3CB" : "#999",
                          cursor: "pointer",
                        }}
                      >
                        {x.label}
                      </button>
                    ))}
                  </div>
                  <div
                    style={{
                      width: previewMapMode === "rondo" ? 348 : 334,
                      position: "relative",
                      minHeight: 200,
                      background: "transparent",
                    }}
                  >
                    <BroadcastRankingBoard
                      teams={BMPS_PREVIEW_TEAMS}
                      cssVars={broadcastCssVars}
                      align="center"
                      showRecall={previewMapMode === "rondo"}
                      hotRank={theme.broadcast?.hotRank}
                      previewMode
                    />
                  </div>
                  <p style={{ fontSize: 10, color: "#64748b", marginTop: 10, maxWidth: 360, lineHeight: 1.45 }}>
                    Live overlay switches automatically: <strong style={{ color: "#94a3b8" }}>Rondo</strong> map adds Recall column; other maps use the standard board.
                  </p>
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>Elimination banner preview</div>
                    {isClassicElimBannerLayout(theme) ? (
                      <p style={{ fontSize: 10, color: "#64748b", lineHeight: 1.45, maxWidth: 360 }}>
                        Classic esports banner — uses <strong style={{ color: "#94a3b8" }}>Palette</strong> colors on the live overlay.
                      </p>
                    ) : (
                      <EliminationBannerRouter
                        theme={theme}
                        gfxColors={elimGfxColors}
                        banner={{ team: "SAMPLE", rank: 8, finishes: 3, logo: null }}
                        scale={0.55}
                        origin="top left"
                        previewKey={elimPreviewKey}
                      />
                    )}
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>WWCD 4-squad strip preview</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(() => {
                        const sample = BMPS_PREVIEW_TEAMS.slice(0, 4);
                        const ws = broadcastWwcdStripStyleFromTheme(theme);
                        const pcts = wwcdPercentsForStripTeams(sample);
                        return sample.map((t, i) => (
                          <BroadcastWwcdStripCard
                            key={t.id}
                            team={t}
                            wwcdPct={pcts[i] ?? 0}
                            teamTagBg={ws.teamTagBg}
                            teamTagText={ws.teamTagText}
                            barGreen={ws.barFilled}
                            barDead={ws.barDead}
                            footerBg={ws.footerBg}
                            footerText={ws.footerText}
                            dividerColor={ws.dividerColor}
                            pctTextColor={ws.pctTextColor}
                            fontFamily={ws.fontFamily}
                          />
                        ));
                      })()}
                    </div>
                  </div>
                </>
              ) : (
                <>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 6 }}>
                DEMO ENTER ANIMATION (THIS PAGE ONLY)
              </label>
              <select
                value={previewEnterMode}
                onChange={(e) => setPreviewEnterMode(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: 334,
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(148,163,184,.35)",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <option value="preset">Preset — overlay config animations</option>
                {listThemePreviewPremiumPackOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 6, lineHeight: 1.45 }}>
                12 preview-only packs · live OBS overlays still follow{" "}
                <strong style={{ color: "#94a3b8" }}>presets</strong>/<strong style={{ color: "#94a3b8" }}>overlayConfig</strong>. Re-play by toggling packs.
              </div>
                </>
              )}
            </div>
            {!isBmpsBoard ? (
            isEsportsTournamentGfxTheme(theme) ? (
              <EsportsRankingBoard
                teams={BMPS_PREVIEW_TEAMS}
                theme={theme}
              />
            ) : (
            <div
              key={`demo-${previewEnterMode}-${selected}-${activePreset || "nopreset"}`}
              style={{
                width: 334,
                background: theme.gradients.panel,
                border: theme.borders.panel,
                overflow: "hidden",
                boxShadow: theme.shadows.board,
                fontFamily: theme.typography.fontFamily,
                animation: previewPremiumAnim ? previewPremiumAnim.board : anim.board,
              }}
            >
              <div style={{ height: theme.topLine?.height || 3, background: theme.gradients.topLine }} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "52px 92px 38px 52px 62px",
                  alignItems: "center",
                  padding: "8px 6px",
                  background: theme.gradients.header,
                  borderBottom: theme.borders.header,
                  animation: previewPremiumAnim ? previewPremiumAnim.header : anim.header,
                }}
              >
                {["RANK", "TEAM", "FIN", "TOTAL", "ALIVE"].map((l, i) => (
                  <div key={l} style={{ textAlign: i === 1 ? "left" : "center", color: theme.colors.gold, fontSize: theme.typography.headerSize, fontWeight: 700, letterSpacing: 1, paddingLeft: i === 1 ? 2 : 0, fontFamily: teamFont }}>{l}</div>
                ))}
              </div>
              {SAMPLE_TEAMS.map((t, i) => {
                const alive = t.alivePlayers;
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "52px 92px 38px 52px 62px",
                      alignItems: "center",
                      minHeight: theme.row.height,
                      padding: "5px 6px",
                      background: i % 2 === 0 ? theme.row.bgA : theme.row.bgB,
                      borderBottom: theme.borders.row,
                      animation: previewPremiumAnim ? previewPremiumAnim.row(i) : anim.row(i),
                    }}
                  >
                    <div style={{ color: theme.colors.text, fontSize: theme.typography.rankSize, fontWeight: 700, textAlign: "center", fontStyle: "italic", fontFamily: numbersFont }}>#{i + 1}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 24, height: 24, border: `1px solid ${theme.colors.primary}40`, background: theme.gradients.panel, display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <span style={{ color: theme.colors.gold, fontSize: 9, fontWeight: 800 }}>{t.team.slice(0, 2)}</span>
                      </div>
                      <div style={{ color: theme.colors.text, fontWeight: 700, fontSize: theme.typography.teamSize, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: teamFont }}>{t.team}</div>
                    </div>
                    <div style={{ textAlign: "center", color: theme.colors.text, fontSize: theme.typography.numberSize, fontWeight: 700, fontFamily: numbersFont }}>{t.finishes}</div>
                    <div style={{ textAlign: "center", color: theme.colors.text, fontSize: theme.typography.numberSize, fontWeight: 700, fontFamily: numbersFont }}>{t.points}</div>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minWidth: 0, overflow: "visible" }}>
                      <AliveIndicator
                        count={alive}
                        theme={theme}
                        styleId={aliveStyle}
                        layout={aliveLayout}
                        customAlivePath={custIconAlive}
                        customDeadPath={custIconDead}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            )
            ) : null}
            {!isBmpsBoard ? (
            <>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>Elimination banner preview</div>
              {isClassicElimBannerLayout(theme) ? (
                <p style={{ fontSize: 10, color: "#64748b", lineHeight: 1.45, maxWidth: 334 }}>
                  Classic esports banner — uses <strong style={{ color: "#94a3b8" }}>Palette</strong> colors on the live overlay.
                </p>
              ) : (
                <EliminationBannerRouter
                  theme={theme}
                  gfxColors={elimGfxColors}
                  banner={{ team: "SAMPLE TEAM", rank: 13, finishes: 0, logo: null }}
                  scale={0.72}
                  origin="top left"
                  previewKey={elimPreviewKey}
                />
              )}
            </div>
            <div style={{ marginTop: 22, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em" }}>FINISH POINTS RANKING OVERLAY</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, maxWidth: 334, lineHeight: 1.45 }}>
                Separate OBS URL (below) — identical live connection as the match board; TOTAL hidden; leaderboard order uses FIN only.
              </div>
            </div>
            <div
              key={`demo-finish-${previewEnterMode}-${selected}-${activePreset || "nopreset"}`}
              style={{
                width: 334,
                background: theme.gradients.panel,
                border: theme.borders.panel,
                overflow: "hidden",
                boxShadow: theme.shadows.board,
                fontFamily: theme.typography.fontFamily,
                animation: previewPremiumAnim ? previewPremiumAnim.board : anim.board,
              }}
            >
              <div style={{ height: theme.topLine?.height || 3, background: theme.gradients.topLine }} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "52px 108px 48px 88px",
                  alignItems: "center",
                  padding: "8px 6px",
                  background: theme.gradients.header,
                  borderBottom: theme.borders.header,
                  animation: previewPremiumAnim ? previewPremiumAnim.header : anim.header,
                }}
              >
                {["RANK", "TEAM", "FIN", "ALIVE"].map((l, i) => (
                  <div key={l} style={{ textAlign: i === 1 ? "left" : "center", color: theme.colors.gold, fontSize: theme.typography.headerSize, fontWeight: 700, letterSpacing: 1, paddingLeft: i === 1 ? 2 : 0, fontFamily: teamFont }}>{l}</div>
                ))}
              </div>
              {finishPreviewTeams.map((t, rankIdx) => {
                  const alive = t.alivePlayers;
                  return (
                    <div
                      key={t.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "52px 108px 48px 88px",
                        alignItems: "center",
                        minHeight: theme.row.height,
                        padding: "5px 6px",
                        background: rankIdx % 2 === 0 ? theme.row.bgA : theme.row.bgB,
                        borderBottom: theme.borders.row,
                        animation: previewPremiumAnim ? previewPremiumAnim.row(rankIdx) : anim.row(rankIdx),
                      }}
                    >
                      <div style={{ color: theme.colors.text, fontSize: theme.typography.rankSize, fontWeight: 700, textAlign: "center", fontStyle: "italic", fontFamily: numbersFont }}>#{rankIdx + 1}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 24, height: 24, border: `1px solid ${theme.colors.primary}40`, background: theme.gradients.panel, display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <span style={{ color: theme.colors.gold, fontSize: 9, fontWeight: 800 }}>{t.team.slice(0, 2)}</span>
                        </div>
                        <div style={{ color: theme.colors.text, fontWeight: 700, fontSize: theme.typography.teamSize, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: teamFont }}>{t.team}</div>
                      </div>
                      <div style={{ textAlign: "center", color: theme.colors.text, fontSize: theme.typography.numberSize, fontWeight: 700, fontFamily: numbersFont }}>{t.finishes}</div>
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minWidth: 0, overflow: "visible" }}>
                        <AliveIndicator
                          count={alive}
                          theme={theme}
                          styleId={aliveStyle}
                          layout={aliveLayout}
                          customAlivePath={custIconAlive}
                          customDeadPath={custIconDead}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            </>
            ) : null}
          </div>

          {/* Info panel */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#888", marginBottom: 12, letterSpacing: "0.1em" }}>THEME DETAILS — {theme.name.toUpperCase()}</h3>

            <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,.06)", marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 8 }}>ELIMINATION BANNER STYLE</div>
              <p style={{ fontSize: 11, color: "#666", margin: "0 0 14px", lineHeight: 1.45 }}>
                Choose any banner design for this theme — independent of the match board look. Saved per theme and applied on{" "}
                <code style={{ color: "#6ff3cb" }}>/overlay/elimination</code>.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ELIMINATION_BANNER_LAYOUTS.map((opt) => {
                  const active = activeElimLayout === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const nextElim = mergeEliminationForBannerLayout(colorDraft.elimination, opt.id);
                        const nextDraft = { ...colorDraft, elimination: nextElim };
                        colorDraftDirtyRef.current = true;
                        setColorDraft(nextDraft);
                        setElimBannerPreviewKey((k) => k + 1);
                        persistThemeColorDraft(
                          nextDraft,
                          "Elimination banner style saved — refresh OBS browser source if it does not update.",
                        );
                      }}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: active ? "2px solid #6FF3CB" : "1px solid rgba(255,255,255,.15)",
                        background: active ? "rgba(111,243,203,.12)" : "rgba(255,255,255,.04)",
                        color: active ? "#6FF3CB" : "#bbb",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,.06)", marginBottom: 20 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#888" }}>COLORS — auto-sync to live overlays</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={saveThemeColors} style={saveColorsBtn}>
                    Save colors (live)
                  </button>
                  <button type="button" onClick={resetThemeColors} style={resetColorsBtn}>
                    Reset theme colors
                  </button>
                </div>
              </div>
              {colorSaveMsg ? (
                <p style={{ fontSize: 11, color: "#6FF3CB", margin: "0 0 12px" }}>{colorSaveMsg}</p>
              ) : null}
              <p style={{ fontSize: 11, color: "#666", margin: "0 0 14px", lineHeight: 1.45 }}>
                {isMinimalBroadcast ? (
                  <>
                    Minimal broadcast pickers below map to each overlay element — changes{" "}
                    <strong style={{ color: "#888" }}>auto-save</strong> (≈½s) after you pick a color.
                  </>
                ) : isBmpsBoard ? (
                  <>
                    Clean Broadcast uses the BMPS board, elimination banner, and WWCD strip pickers below — not the generic palette. Changes{" "}
                    <strong style={{ color: "#888" }}>auto-save</strong> (≈½s) after you pick a color.
                  </>
                ) : (
                  <>
                    Pickers update this page immediately; changes are <strong style={{ color: "#888" }}>saved automatically</strong> (≈½s) to the server for{" "}
                    <code style={{ color: "#6ff3cb" }}>/overlay/themed</code> and <code style={{ color: "#6ff3cb" }}>/overlay/themed/overall</code> and{" "}
                    <code style={{ color: "#6ff3cb" }}>/overlay/elimination</code> and <code style={{ color: "#6ff3cb" }}>/overlay/wwcd-only</code> when they follow the
                    live theme id (see <strong style={{ color: "#888" }}>Save &amp; Apply</strong>). You can still use{" "}
                    <strong style={{ color: "#888" }}>Save colors (live)</strong> to force an immediate write.
                  </>
                )}
              </p>
              {!isBmpsBoard ? (
                <>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>Palette</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                {Object.keys(baseTheme.colors).map((key) => (
                  <label key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="color"
                      value={toInputColor(colorDraft.colors?.[key] ?? baseTheme.colors[key])}
                      onChange={(e) => {
                        colorDraftDirtyRef.current = true;
                        setColorDraft((d) => ({
                          ...d,
                          colors: { ...(d.colors || {}), [key]: e.target.value },
                        }));
                      }}
                      style={{
                        width: 48,
                        height: 36,
                        border: "1px solid rgba(255,255,255,.2)",
                        borderRadius: 8,
                        padding: 0,
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    />
                    <span style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>{key}</span>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>Alive indicator</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                {["color", "deadColor"].map((key) => (
                  <label key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="color"
                      value={toInputColor(colorDraft.alive?.[key] ?? baseTheme.alive?.[key] ?? "#888888")}
                      onChange={(e) => {
                        colorDraftDirtyRef.current = true;
                        setColorDraft((d) => ({
                          ...d,
                          alive: { ...(d.alive || {}), [key]: e.target.value },
                        }));
                      }}
                      style={{
                        width: 48,
                        height: 36,
                        border: "1px solid rgba(255,255,255,.2)",
                        borderRadius: 8,
                        padding: 0,
                        cursor: "pointer",
                      }}
                    />
                    <span style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>alive.{key}</span>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>Row backgrounds</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                {["bgA", "bgB"].map((key) => (
                  <label key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="color"
                      value={toInputColor(colorDraft.row?.[key] ?? baseTheme.row?.[key] ?? "#1a1a1a")}
                      onChange={(e) => {
                        colorDraftDirtyRef.current = true;
                        setColorDraft((d) => ({
                          ...d,
                          row: { ...(d.row || {}), [key]: e.target.value },
                        }));
                      }}
                      style={{
                        width: 48,
                        height: 36,
                        border: "1px solid rgba(255,255,255,.2)",
                        borderRadius: 8,
                        padding: 0,
                        cursor: "pointer",
                      }}
                    />
                    <span style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>row.{key}</span>
                  </label>
                ))}
              </div>
              {activeElimPickers.length > 0 ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>Elimination banner colors</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    {activeElimPickers.map(([key, label]) => (
                      <label key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input
                          type="color"
                          value={toInputColor(
                            elimPickerResolvedColor(
                              theme,
                              activeElimLayout,
                              key,
                              colorDraft.elimination,
                            ),
                          )}
                          onChange={(e) => {
                            colorDraftDirtyRef.current = true;
                            setColorDraft((d) => ({
                              ...d,
                              elimination: { ...(d.elimination || {}), [key]: e.target.value },
                            }));
                          }}
                          style={{
                            width: 48,
                            height: 36,
                            border: "1px solid rgba(255,255,255,.2)",
                            borderRadius: 8,
                            padding: 0,
                            cursor: "pointer",
                          }}
                        />
                        <span style={{ fontSize: 9, color: "#888", fontWeight: 600, textAlign: "center", maxWidth: 80 }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
                </>
              ) : null}

              {isBmpsBoard ? (
                <>
                  {isMinimalBroadcast ? (
                    MINIMAL_BROADCAST_COLOR_SECTIONS.map(({ title, keys }) => (
                      <div key={title}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#888", margin: "18px 0 8px" }}>{title}</div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                          {keys.map(([key, label]) => (
                            <label key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                              <input
                                type="color"
                                value={toInputColor(
                                  colorDraft.broadcast?.[key] ??
                                    baseTheme.broadcast?.[key] ??
                                    MINIMAL_BROADCAST_COLOR_DEFAULTS[key] ??
                                    "#888888",
                                )}
                                onChange={(e) => {
                                  colorDraftDirtyRef.current = true;
                                  setColorDraft((d) => ({
                                    ...d,
                                    broadcast: { ...(d.broadcast || {}), [key]: e.target.value },
                                  }));
                                }}
                                style={{ width: 48, height: 36, border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: 0, cursor: "pointer" }}
                              />
                              <span style={{ fontSize: 9, color: "#888", fontWeight: 600, textAlign: "center", maxWidth: 80 }}>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#888", margin: "18px 0 8px" }}>BMPS team area</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input
                        type="color"
                        value={toInputColor(
                          colorDraft.broadcast?.leftRowColor ??
                            colorDraft.broadcast?.leftRowA ??
                            baseTheme.broadcast?.leftRowColor ??
                            baseTheme.broadcast?.leftRowA ??
                            "#ffffff",
                        )}
                        onChange={(e) => {
                          colorDraftDirtyRef.current = true;
                          setColorDraft((d) => ({
                            ...d,
                            broadcast: { ...(d.broadcast || {}), leftRowColor: e.target.value },
                          }));
                        }}
                        style={{ width: 48, height: 36, border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: 0, cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 9, color: "#888", fontWeight: 600, textAlign: "center", maxWidth: 96 }}>
                        Team area color (all rows)
                      </span>
                    </label>
                  </div>
                    </>
                  )}
                  {!isMinimalBroadcast ? (
                    <>
                  {activeElimPickers.length > 0 ? (
                    <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>Elimination banner colors</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    {activeElimPickers.map(([key, label]) => (
                      <label key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input
                          type="color"
                          value={toInputColor(
                            elimPickerResolvedColor(
                              theme,
                              activeElimLayout,
                              key,
                              colorDraft.elimination,
                            ),
                          )}
                          onChange={(e) => {
                            colorDraftDirtyRef.current = true;
                            setColorDraft((d) => ({
                              ...d,
                              elimination: { ...(d.elimination || {}), [key]: e.target.value },
                            }));
                          }}
                          style={{ width: 48, height: 36, border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: 0, cursor: "pointer" }}
                        />
                        <span style={{ fontSize: 9, color: "#888", fontWeight: 600, textAlign: "center", maxWidth: 80 }}>{label}</span>
                      </label>
                    ))}
                  </div>
                    </>
                  ) : null}
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>WWCD 4-squad strip</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    {BROADCAST_WWCD_STRIP_PICKERS.map(([key, label]) => (
                      <label key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input
                          type="color"
                          value={toInputColor(
                            colorDraft.wwcdStrip?.[key] ??
                              baseTheme.wwcdStrip?.[key] ??
                              BROADCAST_WWCD_STRIP_DEFAULTS[key] ??
                              "#888888",
                          )}
                          onChange={(e) => {
                            colorDraftDirtyRef.current = true;
                            setColorDraft((d) => ({
                              ...d,
                              wwcdStrip: { ...(d.wwcdStrip || {}), [key]: e.target.value },
                            }));
                          }}
                          style={{ width: 48, height: 36, border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: 0, cursor: "pointer" }}
                        />
                        <span style={{ fontSize: 9, color: "#888", fontWeight: 600, textAlign: "center", maxWidth: 80 }}>{label}</span>
                      </label>
                    ))}
                  </div>
                    </>
                  ) : (
                    <>
                  {activeElimPickers.length > 0 ? (
                    <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>Elimination banner colors</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    {activeElimPickers.map(([key, label]) => (
                      <label key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input
                          type="color"
                          value={toInputColor(
                            elimPickerResolvedColor(
                              theme,
                              activeElimLayout,
                              key,
                              colorDraft.elimination,
                            ),
                          )}
                          onChange={(e) => {
                            colorDraftDirtyRef.current = true;
                            setColorDraft((d) => ({
                              ...d,
                              elimination: { ...(d.elimination || {}), [key]: e.target.value },
                            }));
                          }}
                          style={{ width: 48, height: 36, border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: 0, cursor: "pointer" }}
                        />
                        <span style={{ fontSize: 9, color: "#888", fontWeight: 600, textAlign: "center", maxWidth: 80 }}>{label}</span>
                      </label>
                    ))}
                  </div>
                    </>
                  ) : null}
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8 }}>WWCD 4-squad strip</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    {MINIMAL_WWCD_STRIP_PICKERS.map(([key, label]) => (
                      <label key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input
                          type="color"
                          value={toInputColor(
                            minimalWwcdPickerColor(theme, key, colorDraft.wwcdStrip),
                          )}
                          onChange={(e) => {
                            colorDraftDirtyRef.current = true;
                            const value = e.target.value;
                            setColorDraft((d) => {
                              const prevWs = { ...(baseTheme.wwcdStrip || {}), ...(d.wwcdStrip || {}) };
                              const nextWs = { ...(d.wwcdStrip || {}), [key]: value };
                              if (key === "teamTagBg") {
                                const header = baseTheme?.broadcast?.headerBg;
                                const curPanel = prevWs.panelBg;
                                if (
                                  !curPanel ||
                                  String(curPanel).toLowerCase() === String(header || "").toLowerCase() ||
                                  String(curPanel).toLowerCase() === String(prevWs.teamTagBg || "").toLowerCase()
                                ) {
                                  nextWs.panelBg = value;
                                }
                              }
                              return { ...d, wwcdStrip: nextWs };
                            });
                          }}
                          style={{ width: 48, height: 36, border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: 0, cursor: "pointer" }}
                        />
                        <span style={{ fontSize: 9, color: "#888", fontWeight: 600, textAlign: "center", maxWidth: 80 }}>{label}</span>
                      </label>
                    ))}
                  </div>
                    </>
                  )}
                </>
              ) : null}

              <div style={{ fontSize: 10, fontWeight: 700, color: "#888", margin: isBmpsBoard ? "0 0 8px" : "18px 0 8px" }}>Live ranking fonts</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: "#aaa", display: "flex", flexDirection: "column", gap: 4 }}>
                  Team / header text
                  <select
                    value={
                      LIVE_RANKING_FONT_OPTIONS.find(
                        (f) =>
                          f.stack === (colorDraft.typography?.fontFamily ?? baseTheme.typography?.fontFamily),
                      )?.id || "teko"
                    }
                    onChange={(e) => {
                      const opt = LIVE_RANKING_FONT_OPTIONS.find((f) => f.id === e.target.value);
                      if (!opt) return;
                      colorDraftDirtyRef.current = true;
                      setColorDraft((d) => ({
                        ...d,
                        typography: { ...(d.typography || {}), fontFamily: opt.stack },
                      }));
                    }}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "#0f172a", color: "#e2e8f0", fontSize: 12 }}
                  >
                    {LIVE_RANKING_FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 11, color: "#aaa", display: "flex", flexDirection: "column", gap: 4 }}>
                  Rank / FIN / PTS numbers
                  <select
                    value={
                      LIVE_RANKING_FONT_OPTIONS.find(
                        (f) =>
                          f.stack ===
                          (colorDraft.typography?.numbersFontFamily ??
                            baseTheme.typography?.numbersFontFamily ??
                            baseTheme.typography?.fontFamily),
                      )?.id || "teko"
                    }
                    onChange={(e) => {
                      const opt = LIVE_RANKING_FONT_OPTIONS.find((f) => f.id === e.target.value);
                      if (!opt) return;
                      colorDraftDirtyRef.current = true;
                      setColorDraft((d) => ({
                        ...d,
                        typography: { ...(d.typography || {}), numbersFontFamily: opt.stack },
                      }));
                    }}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "#0f172a", color: "#e2e8f0", fontSize: 12 }}
                  >
                    {LIVE_RANKING_FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,.06)", marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 10 }}>OBS URLS</div>
              <UrlRow label="Match board · series totals (default)" url={`/overlay/themed?${buildThemedSearch()}`} />
              <UrlRow
                label="Finish points ranking overlay (FIN only · same theme + alive as match board)"
                url={`/overlay/finish-points-ranking?${buildThemedSearch()}`}
                hint="TOTAL column hidden. Rows sorted by FIN (match finishes), not series points."
              />
              <UrlRow
                label="Overall Standings"
                url={activePreset ? `/overlay/themed/overall?preset=${encodeURIComponent(activePreset)}` : `/overlay/themed/overall?theme=${selected}`}
              />
              <UrlRow label="Match board · this lobby only" url={`/overlay/themed?${buildThemedSearch()}&live=1`} />
              <UrlRow label="Elimination Banner (same theme id + saved colors)" url={`/overlay/elimination?theme=${selected}`} />
              <UrlRow label="With Switcher" url={`/overlay/themed?${buildThemedSearch()}&switcher=1`} />
              <UrlRow
                label="WWCD 4-squad strip only (transparent — no match board)"
                url={`/overlay/wwcd-only?theme=${encodeURIComponent(selected)}&position=bottom`}
              />
              <UrlRow
                label="Rondo · recall success popup (2nd OBS source · transparent BG)"
                url="/overlay/rondo/recall-popup"
                hint={
                  <>
                    Use a <strong style={{ color: "#9dd" }}>separate Browser Source</strong>: full canvas (e.g. 1920×1080). Enable{" "}
                    <strong style={{ color: "#9dd" }}>transparent</strong> where your OBS preset allows · layer above gameplay to center the toast.
                    {""} Optional chime → duplicate URL row below or append <code style={{ color: "#6ff3cb" }}>&amp;sound=1</code>
                    {""} · custom lines →{" "}
                    <code style={{ color: "#6ff3cb" }}>
                      ?headline=…&amp;sub=…
                    </code>
                  </>
                }
              />
              <UrlRow label="Rondo · recall popup (with optional sound)" url="/overlay/rondo/recall-popup?sound=1" />
              <UrlRow
                label="Live Mode (same origin as this page)"
                url="/overlay/themed"
                hint="Quick copy for OBS — use your LAN IP instead of localhost when streaming from another PC."
              />
              <p style={{ fontSize: 10, color: "#888", margin: "4px 0 0", lineHeight: 1.45 }}>
                Other PCs cannot use <code style={{ color: "#aaa" }}>localhost</code> — open Admin / Theme Preview via your PC&apos;s LAN IP (e.g.{" "}
                <code style={{ color: "#6ff3cb" }}>http://192.168.x.x:5173</code>) and paste those URLs. Allow port <strong style={{ color: "#ccc" }}>3001</strong> through Windows Firewall for the API / sockets.
              </p>
            </div>

            <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 6 }}>PRESETS</div>
              <p style={{ fontSize: 11, color: "#666", margin: "0 0 12px", lineHeight: 1.45 }}>
                Each preset sets <strong style={{ color: "#999" }}>theme</strong>, <strong style={{ color: "#999" }}>row animations</strong>, and suggested{" "}
                <strong style={{ color: "#999" }}>alive shape / layout</strong>. Use OBS URLs below with <code style={{ color: "#6ff3cb" }}>?preset=…</code>.
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {presetNames.map((p) => {
                  const isOn = activePreset === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyPreset(p)}
                      style={{
                        padding: "6px 11px",
                        background: isOn ? "rgba(65,232,184,.14)" : "rgba(255,255,255,.06)",
                        borderRadius: 6,
                        fontSize: 11,
                        color: isOn ? "#6FF3CB" : "#aaa",
                        fontWeight: 700,
                        cursor: "pointer",
                        border: isOn ? "2px solid rgba(65,232,184,.5)" : "1px solid rgba(255,255,255,.1)",
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`${keyframes}\n${engineKeyframeCss}\n${themePreviewPremiumKeyframes}`}</style>
    </div>
  );
}

function toInputColor(hex) {
  if (!hex || typeof hex !== "string") return "#000000";
  let h = hex.trim();
  if (/^#[0-9a-f]{3}$/i.test(h)) {
    const [a, b, c] = [h[1], h[2], h[3]];
    h = `#${a}${a}${b}${b}${c}${c}`;
  }
  return /^#[0-9a-f]{6}$/i.test(h) ? h : "#000000";
}

function UrlRow({ label, url, hint }) {
  const origin = getOverlayPageOrigin() || "http://127.0.0.1:5173";
  const full = `${origin}${url}`;
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1700);
    } catch {
      /* clipboard may block without https / permission */
    }
  }, [full]);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 10, color: "#666", fontWeight: 700, flex: "1 1 auto", minWidth: 0 }}>{label}</div>
        <button type="button" onClick={() => void onCopy()} style={overlayCopyBtn}>
          {copied ? "Copied" : "Copy URL"}
        </button>
      </div>
      <code style={{ fontSize: 11, color: "#6ff3cb", background: "rgba(0,0,0,.3)", padding: "4px 8px", borderRadius: 4, display: "block", wordBreak: "break-all" }}>
        {full}
      </code>
      {hint ? (
        <div style={{ fontSize: 10, color: "#707a90", marginTop: 6, lineHeight: 1.5 }}>{hint}</div>
      ) : null}
    </div>
  );
}

const overlayCopyBtn = {
  padding: "4px 10px",
  fontSize: 10,
  fontWeight: 800,
  borderRadius: 6,
  border: "1px solid rgba(111,243,203,.42)",
  background: "rgba(65,232,184,.12)",
  color: "#9FFBE4",
  cursor: "pointer",
};

const saveAliveBtn = {
  padding: "6px 12px",
  fontSize: 11,
  fontWeight: 800,
  borderRadius: 8,
  border: "1px solid rgba(65,232,184,.45)",
  background: "rgba(65,232,184,.1)",
  color: "#6FF3CB",
  cursor: "pointer",
};

const saveColorsBtn = {
  padding: "6px 12px",
  fontSize: 11,
  fontWeight: 800,
  borderRadius: 8,
  border: "1px solid rgba(56,189,248,.45)",
  background: "rgba(56,189,248,.12)",
  color: "#7dd3fc",
  cursor: "pointer",
};

const resetColorsBtn = {
  padding: "6px 12px",
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 8,
  border: "1px solid rgba(248,113,113,.35)",
  background: "rgba(0,0,0,.2)",
  color: "#fca5a5",
  cursor: "pointer",
};

const saveBtn = {
  padding: "10px 22px",
  background: "linear-gradient(90deg, #41E8B8, #2ED7A7)",
  color: "#031014",
  border: "none",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  letterSpacing: 0.5,
  boxShadow: "0 4px 16px rgba(65,232,184,.25)",
  transition: "all 0.2s",
};

const saveBtnSmall = {
  padding: "6px 14px",
  background: "linear-gradient(90deg, #41E8B8, #2ED7A7)",
  color: "#031014",
  border: "none",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  letterSpacing: 0.3,
  boxShadow: "0 2px 10px rgba(65,232,184,.2)",
};
