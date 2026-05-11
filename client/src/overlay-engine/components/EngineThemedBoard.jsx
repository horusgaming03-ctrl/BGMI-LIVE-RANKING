import { memo } from "react";
import ThemedTopLine from "../../overlays/components/ThemedTopLine";
import ThemedHeader from "../../overlays/components/ThemedHeader";
import EngineThemedRow from "./EngineThemedRow";

function EngineThemedBoard({ teams, theme, anim, config, design, aliveStyle, aliveLayout, aliveCustomAlive, aliveCustomDead }) {
  const offset = design?.boardWidthOffset ?? 0;
  const boardWidth = Math.max(272, Math.min(432, (config?.board?.width || 320) + offset + 12));
  const compact = design?.compactColumnsBias || config?.compactMode;
  const columns = compact ? "44px 80px 32px 44px 58px" : "52px 92px 38px 52px 66px";

  const frameStyle = design?.frameStyle || "default";
  const extraShadow =
    frameStyle === "floating"
      ? "0 22px 48px rgba(0,0,0,.55)"
      : frameStyle === "rim"
        ? theme.shadows.board
        : theme.shadows.board;

  return (
    <div
      style={{
        width: boardWidth,
        margin: design?.panelInset ? design.panelInset : 0,
        background: theme.gradients.panel,
        border: theme.borders.panel,
        overflow: "hidden",
        boxShadow: config?.enableGlow ? extraShadow : "0 8px 28px rgba(0,0,0,.5)",
        animation: anim.board,
        fontFamily: theme.typography.fontFamily,
        position: "relative",
        zIndex: 1,
        borderRadius: frameStyle === "rounded_pack" ? 12 : undefined,
        transform: frameStyle === "raised" ? "translateY(-2px)" : undefined,
      }}
    >
      <ThemedTopLine theme={theme} />
      <ThemedHeader theme={theme} anim={anim.header} columns={columns} />

      {teams.map((t, i) => (
        <EngineThemedRow
          key={t.id ?? i}
          team={t}
          index={i}
          theme={theme}
          anim={anim.row(i)}
          columns={columns}
          aliveStyle={aliveStyle}
          aliveLayout={aliveLayout}
          aliveCustomAlive={aliveCustomAlive}
          aliveCustomDead={aliveCustomDead}
        />
      ))}
    </div>
  );
}

export default memo(EngineThemedBoard);
