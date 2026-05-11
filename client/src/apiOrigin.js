/**
 * In Vite dev (`import.meta.env.DEV`), HTTP and Socket.IO are proxied through the dev
 * server so the browser sees same-origin requests (no CORS). Preview uses port 4173+proxy.
 * Set VITE_API_URL to force a full origin (e.g. production).
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
    if (port === "4173" || port === "4174") {
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

export function connectSocket(options = {}) {
  const base = getApiBase();
  const opts = { transports: ["polling", "websocket"], ...options };
  if (base === "/api" || base === "") {
    return io(opts);
  }
  return io(base, opts);
}
