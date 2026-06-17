import { useEffect, useMemo, useRef, useState, memo } from "react";
import { teamLogoUrl } from "../../apiOrigin";
import { getRondoRecallChargesRemaining } from "../../rondo/recallCharges";
import { getBmpsLeftRowVariant, resolveLeftRowPalette } from "../broadcastBmpsUtils";
import "../../LiveRankingOverlay.css";

function resolveLogoSrc(logoPath) {
  if (typeof logoPath !== "string" || !logoPath.trim()) return null;
  const s = logoPath.trim();
  if (s.includes("..")) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const normalized = s.startsWith("/") ? s : `/${s}`;
  if (!normalized.startsWith("/uploads/")) return null;
  return teamLogoUrl(normalized);
}

function TeamLogoImg({ logoPath, initials }) {
  const src = resolveLogoSrc(logoPath);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (!src || broken) {
    return <span className="lr-logo-fallback">{initials}</span>;
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}

function resolveAliveCount(team) {
  const status = String(team.status || "alive").toLowerCase();
  if (status === "eliminated") return 0;
  const ap = team.alivePlayers;
  if (typeof ap === "number" && Number.isFinite(ap)) return Math.max(0, Math.min(4, ap));
  if (status === "alive") return 4;
  return 0;
}

function statusBarState(slotIndex, team) {
  const status = String(team.status || "alive").toLowerCase();
  const alive = resolveAliveCount(team);

  if (status === "rondo_benched") {
    return slotIndex < alive ? "alive" : "bench";
  }
  if (status === "eliminated" || alive === 0) {
    return "dead";
  }
  if (slotIndex < alive) {
    return "alive";
  }
  if (status === "knocked" && alive > 0) {
    return "knocked";
  }
  return "dead";
}

function StatusBars({ team }) {
  return (
    <div className="lr-status-bars" aria-label={`${resolveAliveCount(team)} of 4 players up`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`lr-status-bar lr-status-bar--${statusBarState(i, team)}`} />
      ))}
    </div>
  );
}

function RecallBolts({ team }) {
  const charges = getRondoRecallChargesRemaining(team);
  return (
    <div className="lr-recall-bolts" aria-label={`${charges} recall charges`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`lr-recall-bolt${i < charges ? " lr-recall-bolt--on" : ""}`} aria-hidden>
          ⚡
        </span>
      ))}
    </div>
  );
}

function RankingRow({ team, rank, index, flashFin, flashPts, rankShift, hidePts, showRecall, hotRank }) {
  const name = String(team.team || "").trim() || "—";
  const initials = name.slice(0, 2).toUpperCase();
  const fin = Number(team.finishes) || 0;
  const pts = Number(team.points) || 0;
  const logo = team.logo;
  const leftVariant = getBmpsLeftRowVariant(rank, index, { hotRank, enableHotRank: showRecall });

  return (
    <div className={`lr-row lr-row--bmps lr-left--${leftVariant}${rankShift ? " lr-row--enter" : ""}`}>
      <div className={`lr-rank${rankShift ? " lr-rank--shift" : ""}`}>{rank}</div>

      <div className="lr-team">
        <div className="lr-logo">
          <TeamLogoImg logoPath={logo} initials={initials} />
        </div>
        <span className="lr-team-name" title={name}>
          {name}
        </span>
      </div>

      <div className="lr-status">
        <StatusBars team={team} />
      </div>

      <div className={`lr-fin${flashFin ? " lr-fin--flash" : ""}`}>{fin}</div>

      {hidePts ? null : <div className={`lr-pts${flashPts ? " lr-pts--flash" : ""}`}>{pts}</div>}

      {showRecall ? (
        <div className="lr-recall">
          <RecallBolts team={team} />
        </div>
      ) : null}
    </div>
  );
}

/** Map merged theme → BMPS CSS variables (dynamic colors + fonts). */
export function themeToBroadcastCssVars(theme) {
  if (!theme || typeof theme !== "object") return {};
  const alive = theme.alive || {};
  const bc = theme.broadcast || {};
  const ty = theme.typography || {};
  const left = resolveLeftRowPalette(bc);
  const headerText = bc.headerText || "#7fdbda";
  const statsText = theme.colors?.text || bc.statsText || "#ffffff";

  return {
    "--rank-color": left.leftText,
    "--team-color": left.leftText,
    "--fin-color": statsText,
    "--pts-color": statsText,
    "--header-color": headerText,
    "--lr-header-text": headerText,
    "--status-alive": alive.color || bc.statusAlive,
    "--status-knocked": bc.knockedColor || alive.knockedColor,
    "--status-dead": alive.deadColor || bc.statusDead,
    "--lr-font-family": ty.fontFamily || "'Teko', sans-serif",
    "--lr-numbers-font": ty.numbersFontFamily || ty.fontFamily || "'Teko', sans-serif",
    "--lr-header-bg": bc.headerBg,
    "--lr-stats-bg": bc.statsBg,
    "--lr-left-row-a": left.leftRowA,
    "--lr-left-row-b": left.leftRowB,
    "--lr-left-row-accent": left.leftRowAccent,
    "--lr-left-row-hot": left.leftRowHot,
    "--lr-left-text": left.leftText,
    "--lr-recall-on": bc.recallOn,
    "--lr-recall-off": bc.recallOff,
    "--lr-board-shadow": theme.shadows?.board,
    "--lr-row-height": theme.row?.height ? `${theme.row.height}px` : undefined,
    "--lr-hot-rank": bc.hotRank != null ? String(bc.hotRank) : undefined,
  };
}

function BroadcastRankingBoard({
  teams,
  finishPointsRankingOnly = false,
  cssVars = {},
  align = "center",
  showRecall = false,
  showLegend = true,
  hotRank,
  previewMode = false,
}) {
  const snapshotRef = useRef(new Map());
  const [flash, setFlash] = useState({ fin: new Set(), pts: new Set(), rank: new Set() });

  const list = Array.isArray(teams) ? teams : [];
  const hidePts = Boolean(finishPointsRankingOnly);
  const recallOn = Boolean(showRecall);

  const hotRankEff = useMemo(() => {
    if (hotRank != null && Number.isFinite(Number(hotRank))) return Number(hotRank);
    const fromCss = cssVars["--lr-hot-rank"];
    if (fromCss != null && Number.isFinite(Number(fromCss))) return Number(fromCss);
    return 7;
  }, [hotRank, cssVars]);

  useEffect(() => {
    const prev = snapshotRef.current;
    const finFlash = new Set();
    const ptsFlash = new Set();
    const rankFlash = new Set();

    list.forEach((t, i) => {
      const id = t.id != null ? String(t.id) : `@${t.team}`;
      const rank = i + 1;
      const fin = Number(t.finishes) || 0;
      const pts = Number(t.points) || 0;
      const old = prev.get(id);
      if (old) {
        if (old.fin !== fin) finFlash.add(id);
        if (old.pts !== pts) ptsFlash.add(id);
        if (old.rank !== rank) rankFlash.add(id);
      }
      prev.set(id, { fin, pts, rank });
    });

    if (finFlash.size || ptsFlash.size || rankFlash.size) {
      setFlash({ fin: finFlash, pts: ptsFlash, rank: rankFlash });
      const t = window.setTimeout(() => {
        setFlash({ fin: new Set(), pts: new Set(), rank: new Set() });
      }, 560);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [list]);

  const rootStyle = useMemo(
    () => ({
      ...cssVars,
      ...(align === "center" ? { justifyContent: "center", paddingRight: 0 } : null),
    }),
    [cssVars, align],
  );

  const headerLabels = useMemo(() => {
    if (hidePts) {
      return recallOn ? ["#", "Teams", "Status", "Fin", "Recall"] : ["#", "Teams", "Status", "Fin"];
    }
    return recallOn ? ["#", "Teams", "Status", "Fin", "Pts", "Recall"] : ["#", "Teams", "Status", "Fin", "Pts"];
  }, [hidePts, recallOn]);

  const boardClass = [
    "lr-board",
    "lr-board--bmps",
    recallOn ? "lr-board--rondo" : "",
    hidePts ? "lr-board--fin-only" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`lr-root${previewMode ? " lr-root--preview" : " lr-root--embedded"}${recallOn ? " lr-root--rondo" : ""}`}
      style={rootStyle}
    >
      <div className={boardClass}>
        <header className="lr-header lr-header--bmps">
          {headerLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </header>

        <div className="lr-body">
          {list.map((t, i) => {
            const id = t.id != null ? String(t.id) : `@${t.team}`;
            return (
              <RankingRow
                key={id}
                team={t}
                rank={i + 1}
                index={i}
                flashFin={flash.fin.has(id)}
                flashPts={flash.pts.has(id)}
                rankShift={flash.rank.has(id)}
                hidePts={hidePts}
                showRecall={recallOn}
                hotRank={hotRankEff}
              />
            );
          })}
        </div>

        {showLegend ? (
          <footer className="lr-legend">
            <span className="lr-legend-item">
              <i className="lr-legend-swatch lr-legend-swatch--alive" /> Alive
            </span>
            <span className="lr-legend-item">
              <i className="lr-legend-swatch lr-legend-swatch--knocked" /> Knocked
            </span>
            <span className="lr-legend-item">
              <i className="lr-legend-swatch lr-legend-swatch--dead" /> Eliminated
            </span>
            {recallOn ? (
              <span className="lr-legend-item">
                <i className="lr-legend-swatch lr-legend-swatch--recall" /> Recall
              </span>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export default memo(BroadcastRankingBoard);
