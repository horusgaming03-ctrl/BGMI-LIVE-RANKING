import { useEffect, useMemo, useState } from "react";
import socket, { API } from "./socket";
import OverlayGfxAdminPreview, { GFX_PREVIEW_STORAGE_KEY } from "./OverlayGfxAdminPreview";
import {
  GFX_COLOR_MODE_THEME,
  mergeWwcdStripColors,
  mergeEliminationBannerColors,
  normalizeGfxColorMode,
} from "../overlayGfxColors";

/** Full-window preview for admin — reads draft from localStorage or saved settings. */
export default function GfxColorsPreviewOverlay() {
  const [teams, setTeams] = useState([]);
  const [wwcdStripMode, setWwcdStripMode] = useState(GFX_COLOR_MODE_THEME);
  const [wwcdStripDraft, setWwcdStripDraft] = useState(() => mergeWwcdStripColors({}));
  const [elimBannerMode, setElimBannerMode] = useState(GFX_COLOR_MODE_THEME);
  const [elimBannerDraft, setElimBannerDraft] = useState(() => mergeEliminationBannerColors({}));

  const readDraft = () => {
    try {
      const raw = window.localStorage.getItem(GFX_PREVIEW_STORAGE_KEY);
      if (!raw) return false;
      const j = JSON.parse(raw);
      if (j?.wwcdStripColorMode != null) setWwcdStripMode(normalizeGfxColorMode(j.wwcdStripColorMode));
      if (j?.wwcdStripColors) setWwcdStripDraft(mergeWwcdStripColors(j.wwcdStripColors));
      if (j?.eliminationBannerColorMode != null) setElimBannerMode(normalizeGfxColorMode(j.eliminationBannerColorMode));
      if (j?.eliminationBannerColors) setElimBannerDraft(mergeEliminationBannerColors(j.eliminationBannerColors));
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const onSettings = (s) => {
      if (!s || typeof s !== "object") return;
      if (!readDraft()) {
        setWwcdStripMode(normalizeGfxColorMode(s.wwcdStripColorMode));
        setWwcdStripDraft(mergeWwcdStripColors(s.wwcdStripColors));
        setElimBannerMode(normalizeGfxColorMode(s.eliminationBannerColorMode));
        setElimBannerDraft(mergeEliminationBannerColors(s.eliminationBannerColors));
      }
    };
    readDraft();
    socket.on("settingsUpdated", onSettings);
    socket.emit("requestSettings");
    fetch(`${API}/settings`)
      .then((r) => r.json())
      .then(onSettings)
      .catch(() => {});
    const onStorage = (e) => {
      if (e.key === GFX_PREVIEW_STORAGE_KEY) readDraft();
    };
    window.addEventListener("storage", onStorage);
    const poll = window.setInterval(readDraft, 400);
    return () => {
      socket.off("settingsUpdated", onSettings);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const onTeams = (data) => setTeams(Array.isArray(data) ? data : []);
    socket.on("teamsUpdated", onTeams);
    socket.emit("requestTeams");
    return () => socket.off("teamsUpdated", onTeams);
  }, []);

  const scale = useMemo(() => {
    if (typeof window === "undefined") return 1;
    return Math.min(1.35, Math.max(0.85, window.innerWidth / 1100));
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: "transparent",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <OverlayGfxAdminPreview
          wwcdStripMode={wwcdStripMode}
          wwcdStripDraft={wwcdStripDraft}
          elimBannerMode={elimBannerMode}
          elimBannerDraft={elimBannerDraft}
          teams={teams}
        />
      </div>
      <p
        style={{
          position: "fixed",
          bottom: 8,
          right: 12,
          margin: 0,
          fontSize: 11,
          color: "rgba(148,163,184,.75)",
          fontFamily: "system-ui,sans-serif",
        }}
      >
        Gfx preview · draft syncs from admin color pickers
      </p>
    </div>
  );
}
