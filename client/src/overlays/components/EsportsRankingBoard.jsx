import { useMemo } from "react";
import { getApiBase } from "../../apiOrigin";
import { esportsRankingTokensFromTheme } from "../esportsGfxUtils";
import "../esports-ranking-gfx.css";

const API = getApiBase();

function PersonSilhouette({ color }) {
  return (
    <svg className="lr-esports-silhouette" viewBox="0 0 12 16" aria-hidden>
      <circle cx="6" cy="3.5" r="2.8" fill={color} />
      <path d="M2 15c0-3.2 1.8-5.2 4-5.2s4 2 4 5.2" fill={color} />
    </svg>
  );
}

function slotColors(aliveCount, status, tokens) {
  const st = String(status || "alive").toLowerCase();
  const slots = [];
  for (let i = 0; i < 4; i += 1) {
    if (i >= aliveCount) {
      slots.push(tokens.damagedColor);
    } else if (st === "knocked") {
      slots.push(tokens.knockedColor);
    } else if (st === "eliminated") {
      slots.push(tokens.damagedColor);
    } else {
      slots.push(tokens.aliveColor);
    }
  }
  return slots;
}

/**
 * Tournament-style LIVE RANKING board — Esports theme only.
 */
export default function EsportsRankingBoard({
  teams = [],
  theme,
  finishPointsRankingOnly = false,
}) {
  const tokens = useMemo(() => esportsRankingTokensFromTheme(theme), [theme]);

  const cssVars = {
    "--lr-es-panel": tokens.panelBg,
    "--lr-es-glow": tokens.panelGlow,
    "--lr-es-row": tokens.rowBg,
    "--lr-es-border": tokens.rowBorder,
    "--lr-es-gold": tokens.rankGold,
    "--lr-es-silver": tokens.rankSilver,
    "--lr-es-text": tokens.text,
    "--lr-es-alive": tokens.aliveColor,
    "--lr-es-knocked": tokens.knockedColor,
    "--lr-es-damaged": tokens.damagedColor,
    "--lr-es-red": tokens.footerTag,
    "--lr-es-font": tokens.fontFamily,
    "--lr-es-title": tokens.titleFont,
  };

  return (
    <div className="lr-esports-root" style={cssVars}>
      <header className="lr-esports-header">
        <div className="lr-esports-title">
          <span className="lr-esports-title-live">LIVE </span>
          <span className="lr-esports-title-rank">RANKING</span>
        </div>
      </header>

      <div className="lr-esports-cols">
        <span>RANK</span>
        <span>TEAM</span>
        <span>ALIVE</span>
        <span>{finishPointsRankingOnly ? "FIN" : "PTS"}</span>
        <span>ELIMS</span>
      </div>

      <div className="lr-esports-rows">
        {teams.map((team, index) => {
          const rank = index + 1;
          const status = String(team.status || "alive").toLowerCase();
          const aliveRaw = team.alivePlayers;
          const alive =
            typeof aliveRaw === "number" && Number.isFinite(aliveRaw)
              ? Math.max(0, Math.min(4, Math.trunc(aliveRaw)))
              : status === "alive"
                ? 4
                : 0;
          const rowClass =
            rank === 1
              ? "lr-esports-row lr-esports-row--gold"
              : rank === 2
                ? "lr-esports-row lr-esports-row--silver"
                : "lr-esports-row";
          const colors = slotColors(Math.max(0, Math.min(4, alive)), status, tokens);
          const initials = String(team.team || "TM").slice(0, 2).toUpperCase();

          return (
            <div key={team.id ?? index} className={rowClass}>
              <div className="lr-esports-rank">{rank}</div>
              <div className="lr-esports-team">
                <div className="lr-esports-logo">
                  {team.logo ? (
                    <img src={`${API}${team.logo}`} alt="" />
                  ) : (
                    <span className="lr-esports-logo-fallback">{initials}</span>
                  )}
                </div>
                <span className="lr-esports-name">{team.team}</span>
              </div>
              <div className="lr-esports-alive">
                {colors.map((c, i) => (
                  <PersonSilhouette key={i} color={c} />
                ))}
              </div>
              <div className="lr-esports-stat">
                {finishPointsRankingOnly ? team.finishes ?? 0 : team.points ?? 0}
              </div>
              <div className="lr-esports-stat">{team.finishes ?? 0}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
