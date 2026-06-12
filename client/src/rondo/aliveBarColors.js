/** Shared alive-bar colors — admin desk + OBS overlays stay in sync. */
export const ALIVE_BAR_GREEN = "#5CFF72";
export const ALIVE_BAR_RED = "#E63946";
export const ALIVE_BAR_BENCH = "#2d3540";
export const ALIVE_BAR_IDLE = "#3a3f48";

/**
 * @param {number} slotIndex 0..3
 * @param {number} aliveCount 0..4 players up
 * @param {{ benched?: boolean }} opts
 */
export function aliveBarBackground(slotIndex, aliveCount, { benched = false } = {}) {
  const alive = Math.max(0, Math.min(4, Number(aliveCount) || 0));
  if (slotIndex < alive) return ALIVE_BAR_GREEN;
  if (benched) return ALIVE_BAR_BENCH;
  if (alive > 0 && alive < 4) return ALIVE_BAR_RED;
  return ALIVE_BAR_IDLE;
}

/** Theme override so AliveIndicator dead slots render red when squad is partially down. */
export function themeWithKnockedDeadColor(theme, aliveCount, status) {
  const st = String(status || "").toLowerCase();
  const alive = Math.max(0, Math.min(4, Number(aliveCount) || 0));
  const partial = alive > 0 && alive < 4 && st !== "eliminated" && st !== "rondo_benched";
  if (!partial) return theme;
  const red = theme?.colors?.danger || theme?.colors?.primary || ALIVE_BAR_RED;
  return {
    ...theme,
    alive: {
      ...(theme?.alive || {}),
      deadColor: red,
    },
  };
}
