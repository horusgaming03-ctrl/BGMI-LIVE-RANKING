/**
 * Live roster order (matches backend `sortTeams` / Socket `teamsUpdated`).
 *
 * - `displayOrder` 1…N pins that team to that **row** (rank on screen).
 * - `displayOrder` 0 / missing → “auto”: fills empty rows in **team id** order (not A–Z, not points).
 * - Two teams same slot: first by id keeps it; the other goes to the auto pool (server swap usually prevents this).
 */

export function buildLiveRankingOrder(teams) {
  const arr = Array.isArray(teams) ? [...teams] : [];
  const n = arr.length;
  if (n === 0) return [];

  const byRow = new Map();
  const auto = [];
  const sortedInput = [...arr].sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));

  for (const t of sortedInput) {
    const raw = Number(t?.displayOrder);
    if (Number.isFinite(raw) && raw > 0) {
      let row = Math.trunc(raw);
      if (row < 1) row = 1;
      if (row > n) row = n;
      if (byRow.has(row)) auto.push(t);
      else byRow.set(row, t);
    } else {
      auto.push(t);
    }
  }

  auto.sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));

  const out = [];
  let ai = 0;
  for (let row = 1; row <= n; row++) {
    if (byRow.has(row)) out.push(byRow.get(row));
    else if (ai < auto.length) out.push(auto[ai++]);
  }
  while (ai < auto.length) out.push(auto[ai++]);

  const seen = new Set(out.map((t) => t.id));
  for (const t of arr) {
    if (!seen.has(t.id)) {
      out.push(t);
      seen.add(t.id);
    }
  }
  return out;
}

function overlayAliveCountForSort(t) {
  const s = String(t?.status || "alive").toLowerCase();
  if (s === "eliminated") return 0;
  if (s === "rondo_benched") {
    const ap = Number(t?.alivePlayers);
    return Number.isFinite(ap) ? Math.max(0, Math.min(4, Math.floor(ap))) : 0;
  }
  const ap = Number(t?.alivePlayers);
  if (Number.isFinite(ap) && ap >= 0) return Math.max(0, Math.min(4, Math.floor(ap)));
  if (s === "alive") return 4;
  return 0;
}

/**
 * **OBS / stream output only** — dynamic leaderboard order for overlays.
 * Ignores `displayOrder` row pins (unlike `buildLiveRankingOrder` used by Admin + backend).
 *
 * Default sort: total points DESC → alive players DESC → team id ASC (stable tie-break).
 * Options.sortPrimary `'finishes'`: FIN column DESC → alive → id — total points are not used for ordering.
 */
export function buildOverlayStreamRankingOrder(teams, options = {}) {
  const arr = Array.isArray(teams) ? [...teams] : [];
  const primary = options.sortPrimary === "finishes" ? "finishes" : "points";
  return arr.sort((a, b) => {
    if (primary === "finishes") {
      const fa = Number(a?.finishes) || 0;
      const fb = Number(b?.finishes) || 0;
      if (fb !== fa) return fb - fa;
      const va = overlayAliveCountForSort(a);
      const vb = overlayAliveCountForSort(b);
      if (vb !== va) return vb - va;
      return (Number(a?.id) || 0) - (Number(b?.id) || 0);
    }
    const pa = Number(a?.points) || 0;
    const pb = Number(b?.points) || 0;
    if (pb !== pa) return pb - pa;
    const va = overlayAliveCountForSort(a);
    const vb = overlayAliveCountForSort(b);
    if (vb !== va) return vb - va;
    return (Number(a?.id) || 0) - (Number(b?.id) || 0);
  });
}
