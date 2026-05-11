import { mergeDeep } from "./mergeDeep";

/** Apply design preset tokens onto a generated engine theme (immutable). */
export function applyDesignToTheme(theme, design, overrides = {}) {
  if (!design) return { ...theme };
  const h = Math.round(theme.row.height * design.rowHeightMul);
  const tw = theme.topLine?.height ?? 3;
  const patch = {
    row: {
      height: Math.max(32, Math.min(52, h)),
      borderRadius: Math.min(12, (theme.row.borderRadius || 0) + (design.borderRadiusBoost || 0)),
    },
    alive: {
      size: Math.max(5, Math.round((theme.alive.size || 8) * (design.aliveSizeMul || 1))),
    },
    topLine: {
      height: Math.max(1, tw + (design.topLineThickAdd || 0)),
    },
    typography: {
      headerSize: Math.round((theme.typography.headerSize || 11) * (design.headerPadMul || 1)),
    },
    glow: {
      primary: theme.glow.primary,
      accent: theme.glow.accent,
      board: theme.glow.board,
    },
    _engineDesign: { id: design.id, frameStyle: design.frameStyle },
  };

  if (design.compactColumnsBias) {
    patch._compactHint = true;
  }

  return mergeDeep(JSON.parse(JSON.stringify(theme)), patch, overrides);
}
