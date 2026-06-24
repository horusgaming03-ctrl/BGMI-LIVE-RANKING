import { memo } from "react";
import ThemedTopLine from "./ThemedTopLine";
import ThemedHeader from "./ThemedHeader";
import ThemedRow from "./ThemedRow";

function themedBoardColumns({ compactMode, finishPointsRankingOnly, rondoRecallColumn }) {
  if (finishPointsRankingOnly) {
    if (rondoRecallColumn) {
      return compactMode ? "44px 96px 40px 52px 76px" : "52px 108px 48px 58px 88px";
    }
    return compactMode ? "44px 96px 40px 76px" : "52px 108px 48px 88px";
  }
  if (rondoRecallColumn) {
    return compactMode ? "44px 80px 32px 44px 52px 64px" : "52px 92px 38px 52px 58px 70px";
  }
  return compactMode ? "44px 80px 32px 44px 56px" : "52px 92px 38px 52px 62px";
}

function ThemedBoard({
  teams,
  theme,
  anim,
  config,
  finishPointsRankingOnly = false,
  rondoRecallColumn = false,
  aliveStyle = "rounded",
  aliveLayout = "grid",
  aliveCustomAlive = null,
  aliveCustomDead = null,
}) {
  const boardWidth = (config?.board?.width || 320) + 14 + (rondoRecallColumn ? 66 : 0);
  const columns = themedBoardColumns({
    compactMode: config?.compactMode,
    finishPointsRankingOnly,
    rondoRecallColumn,
  });

  return (
    <div
      style={{
        width: boardWidth,
        background: theme.gradients.panel,
        border: theme.borders.panel,
        overflow: "hidden",
        boxShadow: config?.enableGlow ? theme.shadows.board : theme.shadows.board.replace(/rgba\([^)]+\)/g, "rgba(0,0,0,.4)"),
        animation: anim.board,
        fontFamily: theme.typography.fontFamily,
        position: "relative",
        zIndex: 1,
      }}
    >
      <ThemedTopLine theme={theme} />
      <ThemedHeader
        theme={theme}
        anim={anim.header}
        columns={columns}
        finishPointsRankingOnly={finishPointsRankingOnly}
        rondoRecallColumn={rondoRecallColumn}
      />

      {teams.map((t, i) => (
        <ThemedRow
          key={t.id ?? i}
          team={t}
          index={i}
          theme={theme}
          anim={anim.row(i)}
          columns={columns}
          finishPointsRankingOnly={finishPointsRankingOnly}
          rondoRecallColumn={rondoRecallColumn}
          aliveStyle={aliveStyle}
          aliveLayout={aliveLayout}
          aliveCustomAlive={aliveCustomAlive}
          aliveCustomDead={aliveCustomDead}
        />
      ))}
    </div>
  );
}

export default memo(ThemedBoard);
