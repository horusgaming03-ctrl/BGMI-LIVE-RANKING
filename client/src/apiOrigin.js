/**
 * HTTP uses `/api` → Node on Vite/preview ports. Socket.IO connects directly to
 * `VITE_DEV_SOCKET_ORIGIN` (default `http://127.0.0.1:3001`) on those ports so Vite does not
 * tunnel WebSockets (avoids noisy `ECONNABORTED` ws proxy logs on reload / API restarts). CORS allows it.
 */
import { io } from "socket.io-client";

export function getApiBase() {
  const custom = import.meta.env.VITE_API_URL;
  if (custom !== undefined && custom !== null && String(custom).trim() !== "") {
    return String(custom).replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "/api";
  }
  if (typeof window !== "undefined") {
    const port = window.location.port;
    /** Vite client (5173) and preview aliases — production bundle still needs `/api` proxy to Node */
    if (port === "4173" || port === "4174" || port === "5173" || port === "5174") {
      return "/api";
    }
  }
  if (import.meta.env.PROD) {
    return "";
  }
  if (typeof window !== "undefined" && window.location.hostname) {
    return `http://${window.location.hostname}:3001`;
  }
  return "http://127.0.0.1:3001";
}

export function apiUrl(path) {
  if (path == null || path === "") return "";
  const p = String(path).startsWith("/") ? String(path) : `/${path}`;
  return `${getApiBase()}${p}`;
}

/** Team logo path or URL → fetchable src for <img> / CSS url(). */
export function teamLogoUrl(logoPath) {
  if (logoPath == null || logoPath === "") return "";
  const s = String(logoPath).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/api/")) return s;
  const p = s.startsWith("/") ? s : `/${s}`;
  return apiUrl(p);
}

/**
 * Origin for OBS URLs and Preview — same base as clipboard.
 * Uses VITE_PUBLIC_UI_ORIGIN when set (tunnel / alternate UI host).
 * Rewrites localhost / ::1 to 127.0.0.1 so previews match IPv4-bound dev servers on Windows.
 */
export function getOverlayPageOrigin() {
  const raw = import.meta.env.VITE_PUBLIC_UI_ORIGIN;
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    return String(raw).replace(/\/$/, "");
  }
  if (typeof window === "undefined" || !window.location?.href) return "";
  try {
    const u = new URL(window.location.href);
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "[::1]" || h === "::1") {
      u.hostname = "127.0.0.1";
    }
    return u.origin.replace(/\/$/, "");
  } catch {
    return String(window.location.origin || "").replace(/\/$/, "");
  }
}

function viteDevUiPorts() {
  return new Set(["5173", "5174", "4173", "4174"]);
}

function isBrowserLoopbackHostname(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

/**
 * Socket.IO target when UI is on Vite dev/preview (:5173 etc.).
 * Must match the machine running Node — never force 127.0.0.1 when the page is opened via LAN IP,
 * or OBS / browsers on another PC will connect to their own localhost (blank overlay).
 */
function directSocketBackendOrigin() {
  const raw = import.meta.env.VITE_DEV_SOCKET_ORIGIN;
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    return String(raw).trim().replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname;
    if (!isBrowserLoopbackHostname(host)) {
      return `http://${host}:3001`;
    }
  }
  return "http://127.0.0.1:3001";
}

export function connectSocket(options = {}) {
  const base = getApiBase();
  const opts = {
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    ...options,
  };

  /**
   * Vite dev/preview: always connect Socket.IO straight to Node on :3001 (API binds 0.0.0.0).
   * Never tunnel WebSockets through Vite — that causes `ws proxy ECONNRESET` when the API restarts.
   */
  const port = typeof window !== "undefined" ? String(window.location.port || "") : "";
  if (base === "/api" && viteDevUiPorts().has(port)) {
    return io(directSocketBackendOrigin(), opts);
  }

  if (base === "/api" || base === "") {
    return io(opts);
  }
  return io(base, opts);
}
