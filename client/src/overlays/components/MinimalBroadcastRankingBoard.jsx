import { useEffect, useMemo, useRef, useState, memo } from "react";
import { teamLogoUrl } from "../../apiOrigin";
import { getRondoRecallChargesRemaining } from "../../rondo/recallCharges";
import "../minimal-broadcast.css";

function resolveLogoSrc(logoPath) {
  if (typeof logoPath !== "string" || !logoPath.trim()) return null;
  const s = logoPath.trim();
  if (s.includes("..")) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const normalized = s.startsWith("/") ? s : `/${s}`;
  if (!normalized.startsWith("/uploads/")) return null;
  return teamLogoUrl(normalized);
}

function TeamLogoImg({ logoPath, initials, eliminated }) {
  const src = resolveLogoSrc(logoPath);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  if (!src || broken) {
    return <span className="lr-min-logo-fallback">{initials}</span>;
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={eliminated ? "lr-min-logo-img--dim" : undefined}
      onError={() => setBroken(true)}
    />
  );
}

function resolveAliveCount(team) {
  const status = String(team.status || "alive").toLowerCase();
  if (status === "eliminated") return 0;
  const ap = team.alivesPlayers ?? team.alivePlayers;
  if (typeof ap === "number" && Number.isFinite(ap)) return Math.max(0, Math.min(4, ap));
  if (status === "alive") return 4;
  return 0;
}

function isTeamEliminated(team) {
  const status = String(team.status || "alive").toLowerCase();
  return status === "eliminated" || resolveAliveCount(team) === 0;
}

function aliveBarState(slotIndex, team) {
  const status = String(team.status || "alive").toLowerCase();
  const alive = resolveAliveCount(team);
  if (status === "eliminated" || alive === 0) return "dead";
  if (slotIndex < alive) return "alive";
  if (status === "knocked") return "knocked";
  return "dead";
}

function AlivePills({ team, eliminated }) {
  return (
    <div className="lr-min-alive" aria-label={`${resolveAliveCount(team)} of 4 players up`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`lr-min-alive-bar lr-min-alive-bar--${eliminated ? "dead" : aliveBarState(i, team)}`}
        />
      ))}
    </div>
  );
}

function RecallBolts({ team, eliminated }) {
  const charges = getRondoRecallChargesRemaining(team);
  return (
    <div className="lr-min-recall-bolts" aria-label={`${charges} recall charges`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`lr-min-recall-bolt${i < charges && !eliminated ? " lr-min-recall-bolt--on" : ""}`}
          aria-hidden
        >
          ⚡
        </span>
      ))}
    </div>
  );
}

function MinimalRow({ team, rank, flashFin, flashPts, showRecall }) {
  const name = String(team.team || "").trim() || "—";
  const initials = name.slice(0, 2).toUpperCase();
  const fin = Number(team.finishes) || 0;
  const pts = Number(team.points) || 0;
  const eliminated = isTeamEliminated(team);

  return (
    <div className={`lr-min-row${eliminated ? " lr-min-row--eliminated" : ""}`}>
      <div className="lr-min-identity">
        <div className="lr-min-rank">
          <span className="lr-min-rank-shape" aria-hidden />
          <span className="lr-min-rank-num">{rank}</span>
        </div>
        <div className="lr-min-logo-wrap">
          <div className="lr-min-logo">
            <TeamLogoImg logoPath={team.logo} initials={initials} eliminated={eliminated} />
          </div>
        </div>
        <div className="lr-min-name-wrap">
          <span className="lr-min-team-name" title={name}>
            {name}
          </span>
        </div>
      </div>
      <div className="lr-min-alive-cell">
        <AlivePills team={team} eliminated={eliminated} />
      </div>
      <div className={`lr-min-pts${flashPts ? " lr-min-pts--flash" : ""}`}>{pts}</div>
      <div className={`lr-min-elims${flashFin ? " lr-min-elims--flash" : ""}`}>{fin}</div>
      {showRecall ? (
        <div className="lr-min-recall">
          <RecallBolts team={team} eliminated={eliminated} />
        </div>
      ) : null}
    </div>
  );
}

export function minimalThemeToCssVars(theme) {
  const bc = theme?.broadcast || {};
  const alive = theme?.alive || {};
  const panelTop = bc.panelBgTop || "#1c1c1c";
  const panelBottom = bc.panelBgBottom || "#0a0a0a";
  const panelBg =
    bc.panelBgTop || bc.panelBgBottom
      ? `linear-gradient(180deg, ${panelTop} 0%, ${panelBottom} 100%)`
      : bc.panelBg || `linear-gradient(180deg, ${panelTop} 0%, ${panelBottom} 100%)`;

  return {
    "--lr-min-panel-bg": panelBg,
    "--lr-min-header-bg": bc.headerBg || "#085858",
    "--lr-min-header-text": bc.headerText || "#ffffff",
    "--lr-min-match-bg": bc.matchPointBg || "#ffd800",
    "--lr-min-match-text": bc.matchPointText || "#111111",
    "--lr-min-match-badge-bg": bc.matchPointBadgeBg || "#085858",
    "--lr-min-match-badge-text": bc.matchPointBadgeText || "#ffffff",
    "--lr-min-row-bg": bc.rowBg || "transparent",
    "--lr-min-row-gap": bc.rowGap || "rgba(255,255,255,0.06)",
    "--lr-min-row-divider-bg": bc.rowDividerBg || "#000000",
    "--lr-min-text": bc.textColor || "#ffffff",
    "--lr-min-text-dim": bc.textDim || "#8a8a8a",
    "--lr-min-rank-tab": bc.rankTabBg || "#525252",
    "--lr-min-rank-num": bc.rankNumColor || "#ffffff",
    "--lr-min-alive-on": bc.statusAlive || alive.color || "#00c8c8",
    "--lr-min-alive-off": bc.statusDead || alive.deadColor || "#3a3a3a",
    "--lr-min-knocked": bc.knockedColor || alive.knockedColor || "#ffcc00",
    "--lr-min-eliminated": bc.eliminatedColor || "#e63946",
    "--lr-min-eliminated-dim": bc.eliminatedBarDim || "#4a4a4a",
    "--lr-min-legend-bg": bc.legendBg || "#111111",
    "--lr-min-legend-text": bc.legendText || "#ffffff",
    "--lr-min-font": theme?.typography?.fontFamily || "'Roboto Condensed', 'Arial Narrow', sans-serif",
    "--lr-min-team-col": bc.teamColWidth || "118px",
    "--lr-min-pad-r": bc.panelPadRight || "0",
    "--lr-min-board-width": bc.boardWidth || "none",
    "--lr-min-row-height": theme?.row?.height ? `${theme.row.height}px` : "38px",
    "--lr-min-rank-w": bc.rankWidth || "40px",
    "--lr-min-logo-w": bc.logoWidth || "36px",
    "--lr-min-slant": bc.slantPx || "12px",
    "--lr-min-tab-protrude": bc.tabProtrude || "16px",
    "--lr-min-tab-gap": bc.tabGap || "3px",
    "--lr-min-shadow": bc.panelShadow || "0 10px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)",
    "--lr-min-recall-on": bc.recallOn || "#ffffff",
    "--lr-min-recall-off": bc.recallOff || "#555555",
  };
}

function MinimalBroadcastRankingBoard({
  teams,
  cssVars = {},
  showLegend = true,
  previewMode = false,
  align = "right",
  showRecall = false,
}) {
  const snapshotRef = useRef(new Map());
  const [flash, setFlash] = useState({ fin: new Set(), pts: new Set() });

  const list = Array.isArray(teams) ? teams : [];

  useEffect(() => {
    const prev = snapshotRef.current;
    const finFlash = new Set();
    const ptsFlash = new Set();
    list.forEach((t) => {
      const id = t.id != null ? String(t.id) : `@${t.team}`;
      const fin = Number(t.finishes) || 0;
      const pts = Number(t.points) || 0;
      const old = prev.get(id);
      if (old) {
        if (old.fin !== fin) finFlash.add(id);
        if (old.pts !== pts) ptsFlash.add(id);
      }
      prev.set(id, { fin, pts });
    });
    if (finFlash.size || ptsFlash.size) {
      setFlash({ fin: finFlash, pts: ptsFlash });
      const t = window.setTimeout(() => setFlash({ fin: new Set(), pts: new Set() }), 560);
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

  const recallOn = Boolean(showRecall);

  return (
    <div
      className={`lr-min-root${previewMode ? " lr-min-root--preview" : ""}${recallOn ? " lr-min-root--rondo" : ""}`}
      style={rootStyle}
    >
      <div className="lr-min-board">
        <div className="lr-min-header-stack">
          <header className="lr-min-header">
            <div className="lr-min-header-team">TEAM</div>
            <div className="lr-min-header-cols">
              <span>ALIVE</span>
              <span>PTS</span>
              <span>ELIMS</span>
              {recallOn ? <span>RECALL</span> : null}
            </div>
          </header>
        </div>

        <div className="lr-min-body">
          {list.map((t, i) => {
            const id = t.id != null ? String(t.id) : `@${t.team}`;
            return (
              <MinimalRow
                key={id}
                team={t}
                rank={i + 1}
                flashFin={flash.fin.has(id)}
                flashPts={flash.pts.has(id)}
                showRecall={recallOn}
              />
            );
          })}
        </div>

        {showLegend ? (
          <footer className="lr-min-legend">
            <span className="lr-min-legend-item">
              <i className="lr-min-swatch lr-min-swatch--alive" /> ALIVE
            </span>
            <span className="lr-min-legend-item">
              <i className="lr-min-swatch lr-min-swatch--knocked" /> KNOCKED
            </span>
            <span className="lr-min-legend-item">
              <i className="lr-min-swatch lr-min-swatch--dead" /> ELIMINATED
            </span>
            {recallOn ? (
              <span className="lr-min-legend-item">
                <i className="lr-min-swatch lr-min-swatch--recall" /> RECALL
              </span>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export default memo(MinimalBroadcastRankingBoard);
