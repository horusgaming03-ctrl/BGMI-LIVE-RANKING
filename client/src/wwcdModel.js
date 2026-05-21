/**
 * WWCD % model shared with WWCD squad strip routes (`/overlay/wwcd-only`, `/overlay/wwcd-4-teams`, `/overlay/wwcd-four`; WwcFourAliveStripOverlay.jsx).
 * Integer percentages among the final 1–4 non-eliminated squads match the strip overlay exactly.
 */

import { buildOverlayStreamRankingOrder } from "./teamDisplayOrder";

/** Integer percentages that sum to 100 from non-negative weights */
export function distributePercents(weights) {
  const safe = weights.map((w) => Math.max(0, Number(w) || 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  if (!weights.length) return [];
  if (sum <= 0) return safe.map(() => Math.floor(100 / weights.length));
  const exact = safe.map((w) => (w / sum) * 100);
  const floors = exact.map((x) => Math.floor(x));
  let rem = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  if (order.length === 0) return floors;
  for (let k = 0; k < rem; k++) floors[order[k % order.length].i]++;
  return floors;
}

export function wwcdStripWeightForTeam(t) {
  const ap = Math.max(0, Math.min(4, Number(t.alivePlayers) || 0));
  const pts = Math.max(0, Number(t.points) || 0);
  const fin = Math.max(0, Number(t.finishes) || 0);
  return ap * 24 + pts * 0.45 + fin * 3.5 + 1;
}

/** Full roster order first, then non-eliminated only — same ordering as stream overlay (pts, alive, id). */
export function stripTeamsFromAlive(teams) {
  const ordered = buildOverlayStreamRankingOrder(teams);
  const alive = ordered.filter((t) => String(t.status || "").toLowerCase() !== "eliminated");
  const n = alive.length;
  if (n < 1 || n > 4) return [];
  return alive;
}

/** Integer % per card index — same sequence as WWCD strip routes when strip is visible. */
export function wwcdPercentsForStripTeams(stripTeams) {
  if (!stripTeams?.length) return [];
  const weights = stripTeams.map((t) => wwcdStripWeightForTeam(t));
  return distributePercents(weights);
}

/** True for squads actively competing on the battlefield (matches server winner detection). */
export function isTeamCompetingForWwcdStrip(t) {
  const s = String(t?.status || "").toLowerCase();
  return s === "alive" || s === "knocked";
}

/** Map team id → WWCD %. Non-strip teams (including eliminated, benched, or round with &gt;4 competing squads) → 0. */
export function wwcdPercentMapFromTeams(teams) {
  const map = new Map();
  const list = Array.isArray(teams) ? teams : [];
  list.forEach((t) => {
    if (t && t.id != null) map.set(t.id, 0);
  });

  const stripTeams = stripTeamsFromAlive(list).filter((t) => isTeamCompetingForWwcdStrip(t));
  if (!stripTeams.length) return map;

  const percents = wwcdPercentsForStripTeams(stripTeams);
  stripTeams.forEach((t, i) => {
    if (t && t.id != null) map.set(t.id, percents[i] ?? 0);
  });
  return map;
}
