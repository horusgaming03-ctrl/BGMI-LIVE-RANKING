import { useEffect, useMemo, useState } from "react";
import {
  GFX_COLOR_MODE_CUSTOM,
  mergeWwcdStripColors,
  mergeEliminationBannerColors,
  resolveWwcdStripColors,
  resolveEliminationBannerColors,
} from "../overlayGfxColors";
import { stripTeamsFromAlive, wwcdPercentsForStripTeams } from "../wwcdModel";
import WwcdStripTeamCard, { WWCD_STRIP_CARD_WIDTH_PX, wwcdStripStyleFromColors } from "./WwcdStripTeamCard";
import { buildOverlayStreamRankingOrder } from "../teamDisplayOrder";
import ThemedBoard from "./components/ThemedBoard";
import overlayConfig from "./overlayConfig";
import { useLiveRankingThemePalette } from "./hooks/useLiveRankingThemePalette";
import socket from "./socket";
import { normalizeMatchMeta } from "../normalizeMatchMeta";

const PREVIEW_STRIP_SCALE = 132 / WWCD_STRIP_CARD_WIDTH_PX;

function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return `rgba(255,255,255,${alpha})`;
  const h = hex.replace("#", "");
  if (h.length < 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex, amount) {
  const h = hex.replace("#", "");
  const clamp = (n) => Math.max(0, Math.min(255, n));
  const r = clamp(parseInt(h.substring(0, 2), 16) - amount);
  const g = clamp(parseInt(h.substring(2, 4), 16) - amount);
  const b = clamp(parseInt(h.substring(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const SAMPLE_STRIP = [
  { id: "p1", team: "SOUL", alivePlayers: 4, logo: null },
  { id: "p2", team: "GODL", alivePlayers: 3, logo: null },
  { id: "p3", team: "TSM", alivePlayers: 2, logo: null },
  { id: "p4", team: "FNX", alivePlayers: 1, logo: null },
];

const SAMPLE_RANKING = [
  { id: 1, team: "SOUL", finishes: 4, points: 42, logo: null, alivePlayers: 4, status: "alive" },
  { id: 2, team: "GODL", finishes: 3, points: 28, logo: null, alivePlayers: 3, status: "knocked" },
  { id: 3, team: "TSM", finishes: 2, points: 25, logo: null, alivePlayers: 2, status: "knocked" },
  { id: 4, team: "FNX", finishes: 1, points: 23, logo: null, alivePlayers: 4, status: "alive" },
];

const PREVIEW_ANIM = {
  board: "none",
  row: () => "none",
  header: "none",
};

const PREVIEW_BOARD_CONFIG = { ...overlayConfig, enableAnimations: false, enableGlow: true };

function PreviewElimBanner({ colors, sampleTeam }) {
  const primary = colors.primary;
  const accent = colors.accent;
  const gold = colors.gold;
  const secondary = colors.secondary;
  const elimGrad = `linear-gradient(90deg, ${darken(accent, 40)} 0%, ${accent} 40%, ${primary} 70%, ${darken(accent, 40)} 100%)`;
  const rankBg = `linear-gradient(135deg, ${darken(secondary, 10)} 0%, ${secondary} 100%)`;
  const logoBg = `linear-gradient(180deg, ${darken(secondary, 5)} 0%, ${darken(secondary, 20)} 100%)`;
  const finishBg = `linear-gradient(90deg, ${darken(secondary, -20)} 0%, ${darken(secondary, -30)} 60%, ${darken(secondary, -20)} 100%)`;
  const nameBg = `linear-gradient(90deg, ${gold}, ${darken(gold, 30)})`;
  const textShadow = `0 1px 10px ${hexToRgba(accent, 0.5)}`;

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        transform: "scale(0.52)",
        transformOrigin: "top left",
        filter: "drop-shadow(0 4px 12px rgba(0,0,0,.5))",
        fontFamily: "'Rajdhani', 'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ width: 110, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div
          style={{
            height: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            background: rankBg,
            clipPath: "polygon(0 0, 100% 0, 95% 100%, 0 100%)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: colors.textMuted }}>#</span>
          <span style={{ color: "#fff", fontSize: 26, fontWeight: 900 }}>{sampleTeam.rank}</span>
        </div>
        <div
          style={{
            height: 90,
            display: "grid",
            placeItems: "center",
            background: logoBg,
            borderTop: `2px solid ${gold}`,
            clipPath: "polygon(0 0, 95% 0, 100% 100%, 0 100%)",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              background: `linear-gradient(135deg, ${gold}, ${darken(gold, 50)})`,
              color: "#1a1400",
              fontSize: 18,
              fontWeight: 900,
              border: `2px solid ${hexToRgba(gold, 0.5)}`,
            }}
          >
            {String(sampleTeam.team || "TM").slice(0, 2)}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 280 }}>
        <div style={{ height: 42, overflow: "hidden", background: finishBg, clipPath: "polygon(0 0, 100% 0, 97% 100%, 2% 100%)" }}>
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>{sampleTeam.finishes}</span>
            <span style={{ color: "#c0c4d0", fontSize: 14, fontWeight: 800, letterSpacing: 2 }}>FINISHES</span>
          </div>
        </div>
        <div
          style={{
            height: 90,
            overflow: "hidden",
            background: elimGrad,
            clipPath: "polygon(2% 0, 97% 0, 100% 100%, 0 100%)",
            borderTop: "2px solid rgba(255,255,255,.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#fff", fontSize: 28, fontWeight: 900, letterSpacing: 4, textShadow }}>ELIMINATED</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: -24,
          left: 8,
          background: nameBg,
          color: "#1a1400",
          padding: "3px 14px",
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: 1.5,
          clipPath: "polygon(3% 0, 100% 0, 97% 100%, 0 100%)",
        }}
      >
        {sampleTeam.team}
      </div>
    </div>
  );
}

/**
 * Inline admin preview — updates instantly from draft color pickers.
 */
export default function OverlayGfxAdminPreview({
  wwcdStripMode,
  wwcdStripDraft,
  elimBannerMode,
  elimBannerDraft,
  teams = [],
  matchMap,
}) {
  const { mergedTheme, themeName } = useLiveRankingThemePalette();
  const [socketMap, setSocketMap] = useState(null);

  useEffect(() => {
    const onMatch = (data) => {
      const meta = normalizeMatchMeta(data);
      if (meta?.map) setSocketMap(meta.map);
    };
    socket.on("matchUpdated", onMatch);
    socket.emit("requestMatch");
    return () => socket.off("matchUpdated", onMatch);
  }, []);

  const activeMap = matchMap || socketMap;
  const rondoRecallColumn = activeMap === "rondo";

  const stripColors = useMemo(
    () => resolveWwcdStripColors(wwcdStripMode, wwcdStripDraft, mergedTheme),
    [wwcdStripMode, wwcdStripDraft, mergedTheme],
  );
  const stripStyle = useMemo(() => wwcdStripStyleFromColors(stripColors), [stripColors]);
  const elimColors = useMemo(
    () => resolveEliminationBannerColors(elimBannerMode, elimBannerDraft, mergedTheme),
    [elimBannerMode, elimBannerDraft, mergedTheme],
  );

  const stripTeams = useMemo(() => {
    const live = stripTeamsFromAlive(teams);
    if (live.length >= 1 && live.length <= 4) return live;
    return SAMPLE_STRIP;
  }, [teams]);

  const percents = useMemo(() => wwcdPercentsForStripTeams(stripTeams), [stripTeams]);

  const elimSample = useMemo(() => {
    const t = teams.find((x) => String(x.status || "").toLowerCase() === "eliminated") || teams[0];
    return {
      team: t?.team || "SAMPLE TEAM",
      rank: t?.eliminationRank ?? 8,
      finishes: t?.finishes ?? 3,
    };
  }, [teams]);

  const rankingTeams = useMemo(() => {
    const list = teams.length ? teams : SAMPLE_RANKING;
    const sorted = buildOverlayStreamRankingOrder(
      list.map((t) => ({
        ...t,
        finishes: Math.max(0, Number(t.finishes) || 0),
      })),
      {},
    );
    return sorted.slice(0, 4);
  }, [teams]);

  return (
    <div
      style={{
        marginBottom: 18,
        padding: 14,
        borderRadius: 12,
        background: "repeating-conic-gradient(#1a2030 0% 25%, #141a28 0% 50%) 0 0 / 16px 16px",
        border: "1px solid rgba(255,255,255,.1)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: "#94a3b8", marginBottom: 12 }}>
        LIVE PREVIEW · {wwcdStripMode === GFX_COLOR_MODE_CUSTOM || elimBannerMode === GFX_COLOR_MODE_CUSTOM ? "CUSTOM" : "THEME DEFAULT"} ({themeName})
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#67e8f9", marginBottom: 8, letterSpacing: "0.12em" }}>
            WWCD 4-SQUAD STRIP
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-start", alignItems: "flex-start" }}>
            {stripTeams.map((team, i) => (
              <div
                key={team.id ?? i}
                style={{
                  flex: `0 0 ${Math.round(WWCD_STRIP_CARD_WIDTH_PX * PREVIEW_STRIP_SCALE)}px`,
                  width: Math.round(WWCD_STRIP_CARD_WIDTH_PX * PREVIEW_STRIP_SCALE),
                  height: Math.round(118 * PREVIEW_STRIP_SCALE),
                  overflow: "visible",
                }}
              >
                <div
                  style={{
                    transform: `scale(${PREVIEW_STRIP_SCALE})`,
                    transformOrigin: "top left",
                    width: WWCD_STRIP_CARD_WIDTH_PX,
                  }}
                >
                  <WwcdStripTeamCard
                    team={team}
                    wwcdPct={percents[i] ?? 0}
                    logoBoxBg={stripStyle.logoBoxBg}
                    barGreen={stripStyle.barGreen}
                    barDead={stripStyle.barDead}
                    barsBg={stripStyle.barsBg}
                    footerBg={stripStyle.footerBg}
                    footerText={stripStyle.footerText}
                    initialsColor={stripStyle.initialsColor}
                    fontFamily={stripStyle.fontFamily}
                    cardBoxShadow={stripStyle.cardBoxShadow}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: "0 1 250px", minWidth: 220 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", marginBottom: 8, letterSpacing: "0.12em" }}>
            LIVE RANKING · TOP 4
          </div>
          <div style={{ fontSize: 9, color: "#64748b", marginBottom: 6, letterSpacing: "0.06em" }}>
            /overlay/themed · {themeName}
          </div>
          <div
            style={{
              transform: "scale(0.68)",
              transformOrigin: "top left",
              width: 334,
              marginBottom: -48,
              filter: "drop-shadow(0 4px 14px rgba(0,0,0,.45))",
            }}
          >
            <ThemedBoard
              teams={rankingTeams}
              theme={mergedTheme}
              anim={PREVIEW_ANIM}
              config={PREVIEW_BOARD_CONFIG}
              rondoRecallColumn={rondoRecallColumn}
            />
          </div>
        </div>
        <div style={{ flex: "0 1 220px", minWidth: 200 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#fca5a5", marginBottom: 8, letterSpacing: "0.12em" }}>
            ELIMINATION BANNER
          </div>
          <div style={{ minHeight: 100, overflow: "visible" }}>
            <PreviewElimBanner colors={elimColors} sampleTeam={elimSample} />
          </div>
        </div>
      </div>
    </div>
  );
}

export const GFX_PREVIEW_STORAGE_KEY = "overlayGfxPreviewDraft";

export function publishGfxPreviewDraft(gfx) {
  if (typeof window === "undefined" || !gfx) return;
  const payload = {
    wwcdStripColorMode: gfx.wwcdStripColorMode,
    wwcdStripColors: mergeWwcdStripColors(gfx.wwcdStripColors),
    eliminationBannerColorMode: gfx.eliminationBannerColorMode,
    eliminationBannerColors: mergeEliminationBannerColors(gfx.eliminationBannerColors),
    ts: Date.now(),
  };
  try {
    window.localStorage.setItem(GFX_PREVIEW_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  try {
    socket.emit("overlayGfxDraft", payload);
  } catch {
    /* ignore */
  }
}
