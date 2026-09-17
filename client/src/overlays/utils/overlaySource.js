/** Optional OBS lock. Default (no `source`) listens to Simple and Round Robin. */
export const OVERLAY_SOURCE_ROUND_ROBIN = "roundRobin";
export const OVERLAY_SOURCE_SIMPLE = "simple";

export function getOverlaySource() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("source") || "").trim();
}

export function isRoundRobinOverlaySource(source = getOverlaySource()) {
  return source === OVERLAY_SOURCE_ROUND_ROBIN;
}

export function isSimpleOverlaySource(source = getOverlaySource()) {
  return source === OVERLAY_SOURCE_SIMPLE;
}

export function overlayListensToSimple(source = getOverlaySource()) {
  return source !== OVERLAY_SOURCE_ROUND_ROBIN;
}

export function overlayListensToRoundRobin(source = getOverlaySource()) {
  return source !== OVERLAY_SOURCE_SIMPLE;
}

function eventIsRoundRobin(eventSource) {
  return String(eventSource || "").trim() === OVERLAY_SOURCE_ROUND_ROBIN;
}

/** Default URL accepts Simple + RR. `?source=simple` / `?source=roundRobin` lock one lobby. */
export function overlayEventMatchesPage(eventSource, pageSource = getOverlaySource()) {
  const rrEvent = eventIsRoundRobin(eventSource);
  if (pageSource === OVERLAY_SOURCE_ROUND_ROBIN) return rrEvent;
  if (pageSource === OVERLAY_SOURCE_SIMPLE) return !rrEvent;
  return true;
}

export function simpleOverlaySourceQuery() {
  return `source=${OVERLAY_SOURCE_SIMPLE}`;
}

export function roundRobinOverlaySourceQuery() {
  return `source=${OVERLAY_SOURCE_ROUND_ROBIN}`;
}
