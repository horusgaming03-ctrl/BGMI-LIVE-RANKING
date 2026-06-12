import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { scheduleOverlayApiPlugin } from "./vite-schedule-overlay-api.js";

/** Forward to Node API on 127.0.0.1 to avoid localhost IPv6 vs IPv4 mismatches on Windows. */
const proxy = {
  /** Socket.IO connects directly to :3001 in dev (see client/src/apiOrigin.js) — no ws proxy. */
  "/api": {
    target: "http://127.0.0.1:3001",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ""),
    bypass(req) {
      const u = req.url || "";
      if (u.startsWith("/api/schedule-of-the-match")) return false;
    },
    /** Large PNGs through Vite dev/preview proxy */
    timeout: 120_000,
    proxyTimeout: 120_000,
  },
  "/uploads": {
    target: "http://127.0.0.1:3001",
    changeOrigin: true,
    timeout: 120_000,
    proxyTimeout: 120_000,
  },
};

export default defineConfig({
  plugins: [react(), scheduleOverlayApiPlugin()],
  server: {
    /** true listens on LAN + avoids localhost→::1 refusal when only IPv4 is bound (common on Windows) */
    host: true,
    port: 5173,
    proxy,
  },
  preview: {
    host: true,
    proxy,
  },
});
