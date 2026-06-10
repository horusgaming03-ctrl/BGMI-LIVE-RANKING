import { memo } from "react";

function ThemedHeader({ theme, anim, columns, finishPointsRankingOnly, rondoRecallColumn = false }) {
  const cols = columns || "52px 92px 38px 52px 46px";
  const t = theme.typography;
  const labels = finishPointsRankingOnly
    ? rondoRecallColumn
      ? ["RANK", "TEAM", "FIN", "RECALL", "ALIVE"]
      : ["RANK", "TEAM", "FIN", "ALIVE"]
    : rondoRecallColumn
      ? ["RANK", "TEAM", "FIN", "TOTAL", "RECALL", "ALIVE"]
      : ["RANK", "TEAM", "FIN", "TOTAL", "ALIVE"];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        alignItems: "center",
        padding: "8px 6px",
        background: theme.gradients.header,
        borderBottom: theme.borders.header,
        animation: anim,
      }}
    >
      {labels.map((label, i) => (
        <div
          key={label}
          style={{
            textAlign: i === 1 ? "left" : "center",
            paddingLeft: i === 1 ? 2 : 0,
            color: theme.colors.gold,
            fontSize: t.headerSize,
            fontWeight: 700,
            letterSpacing: 1,
            fontFamily: t.fontFamily,
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

export default memo(ThemedHeader);
