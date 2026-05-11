/** Default ?alive= style when the URL omits it — each major overlay route gets a distinct look */
export function defaultAliveStyleForPathname(pathname) {
  const p = String(pathname || "").replace(/\/+$/, "") || "/";
  if (p.includes("/overlay/broadcast-engine")) return "battery";
  if (p.includes("/overlay/themed/overall")) return "hex";
  if (p.includes("/overlay/themed")) return "heart";
  if (p.includes("/overlay/elimination")) return "skull";
  if (p.includes("/overlay/wwcd-four")) return "pulse_ring";
  if (p.includes("/overlay/wwcd")) return "pulse_ring";
  if (p === "/overlay" || p.endsWith("/overlay")) return "dots";
  return "rounded";
}
