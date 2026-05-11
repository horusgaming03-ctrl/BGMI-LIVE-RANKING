/** Deep-merge saved color tweaks onto a static theme object (used by /overlay/themed). */
export function mergeThemeOverride(base, patch) {
  if (!base) return base;
  if (!patch || typeof patch !== "object") return base;
  return {
    ...base,
    colors: patch.colors && typeof patch.colors === "object" ? { ...base.colors, ...patch.colors } : base.colors,
    alive: patch.alive && typeof patch.alive === "object" ? { ...base.alive, ...patch.alive } : base.alive,
    row: patch.row && typeof patch.row === "object" ? { ...base.row, ...patch.row } : base.row,
  };
}
