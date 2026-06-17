import { memo } from "react";
import { getApiBase } from "../../apiOrigin";
import AliveIndicator from "../../overlay-engine/alive-styles/AliveIndicator";
import { getRondoRecallChargesRemaining } from "../../rondo/recallCharges";
import { themeWithKnockedDeadColor } from "../../rondo/aliveBarColors";

const API = getApiBase();

function ThemedRow({
  team,
  index,
  theme,
  anim,
  columns,
  finishPointsRankingOnly = false,
  rondoRecallColumn = false,
  aliveStyle = "rounded",
  aliveLayout = "grid",
  aliveCustomAlive = null,
  aliveCustomDead = null,
}) {
  const cols = columns || "52px 92px 38px 52px 46px";
  const t = theme.typography;
  const numbersFont = t.numbersFontFamily || t.fontFamily;
  const r = theme.row;
  const status = String(team.status || "alive").toLowerCase();
  const alive = team.alivePlayers ?? (status === "alive" ? 4 : 0);
  const recallCharges = getRondoRecallChargesRemaining(team);
  const rowTheme = themeWithKnockedDeadColor(theme, alive, status);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        alignItems: "center",
        minHeight: r.height,
        padding: "5px 6px",
        background: index % 2 === 0 ? r.bgA : r.bgB,
        borderBottom: theme.borders.row,
        borderRadius: r.borderRadius || 0,
        animation: anim,
        fontFamily: t.fontFamily,
      }}
    >
      <div
        style={{
          color: theme.colors.text,
          fontSize: t.rankSize,
          fontWeight: 700,
          textAlign: "center",
          fontStyle: "italic",
          fontFamily: numbersFont,
        }}
      >
        #{index + 1}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
        <div
          style={{
            width: 24,
            height: 24,
            border: `1px solid ${theme.colors.primary}40`,
            background: theme.gradients.panel,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {team.logo ? (
            <img
              src={`${API}${team.logo}`}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              style={{
                color: theme.colors.gold,
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {String(team.team || "TM").slice(0, 2)}
            </span>
          )}
        </div>
        <div
          style={{
            color: theme.colors.text,
            fontWeight: 700,
            fontSize: t.teamSize,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {team.team}
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          color: theme.colors.text,
          fontSize: t.numberSize,
          fontWeight: 700,
          fontFamily: numbersFont,
        }}
      >
        {team.finishes ?? 0}
      </div>

      {finishPointsRankingOnly ? null : (
        <div
          style={{
            textAlign: "center",
            color: theme.colors.text,
            fontSize: t.numberSize,
            fontWeight: 700,
            fontFamily: numbersFont,
          }}
        >
          {team.points ?? 0}
        </div>
      )}

      {rondoRecallColumn ? (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            width: "100%",
            minWidth: 52,
            overflow: "visible",
          }}
        >
          <AliveIndicator count={recallCharges} theme={rowTheme} styleId="bolt" layout="line" tightCluster />
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: aliveStyle === "bar" ? "flex-end" : "center",
          alignItems: "center",
          width: "100%",
          minWidth: 52,
          overflow: "visible",
        }}
      >
        <AliveIndicator
          count={alive}
          theme={rowTheme}
          styleId={aliveStyle}
          layout={aliveLayout}
          customAlivePath={aliveCustomAlive}
          customDeadPath={aliveCustomDead}
        />
      </div>
    </div>
  );
}

export default memo(ThemedRow);
