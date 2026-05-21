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
