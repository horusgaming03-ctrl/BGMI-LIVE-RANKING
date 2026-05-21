/** Rondo squad recall budget: one charge per seated player redeploy (max 4). */
export const RONDO_RECALL_CHARGE_CAP = 4;

/** Mirrors backend coerceJsonBool — Boolean("false") would wrongly be true. */
function coerceConsumedFlag(team) {
  const v = team?.rondoRecallConsumed;
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (v == null || v === "") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
    return false;
  }
  return Boolean(v);
}

/** @returns {number} 0..RONDO_RECALL_CHARGE_CAP */
export function getRondoRecallChargesRemaining(team) {
  const raw = team?.rondoRecallChargesRemaining;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(RONDO_RECALL_CHARGE_CAP, Math.trunc(raw)));
  }
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.max(0, Math.min(RONDO_RECALL_CHARGE_CAP, Math.trunc(n)));
  }
  return coerceConsumedFlag(team) ? 0 : RONDO_RECALL_CHARGE_CAP;
}
