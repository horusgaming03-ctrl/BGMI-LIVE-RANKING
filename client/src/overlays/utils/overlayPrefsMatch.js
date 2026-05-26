function normOverlayPath(p) {
  let x = String(p).trim();
  if (!x.startsWith("/")) x = `/${x}`;
  const y = x.replace(/\/+$/, "");
  return y || "/";
}

/**
 * OBS routes that reuse the **same persisted** themed match-board alive prefs (`themedOverlayPrefs` path / Theme Preview saves).
 * Must stay in sync whenever a sibling overlay is added (e.g. FIN-only board).
 */
export const SHARED_THEMED_MATCH_BOARD_PATHS = Object.freeze(["/overlay/themed", "/overlay/finish-points-ranking"]);

/** @returns {boolean} */
export function themedMatchBoardPrefsApply(savedOverlayPath, currentPathname) {
  if (!savedOverlayPath || !currentPathname) return false;
  const s = normOverlayPath(savedOverlayPath);
  const c = normOverlayPath(currentPathname);
  const shared = new Set(SHARED_THEMED_MATCH_BOARD_PATHS);
  if (shared.has(s) && shared.has(c)) return true;
  return s === c;
}

/** True when saved overlay target applies to current page (pathname). */
export function overlayPathMatches(savedPath, pathname) {
  if (!savedPath || !pathname) return false;
  const normPath = normOverlayPath;
  return normPath(pathname) === normPath(savedPath);
}
