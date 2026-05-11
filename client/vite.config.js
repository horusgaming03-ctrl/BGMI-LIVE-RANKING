import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Forward to Node API on 127.0.0.1 to avoid localhost IPv6 vs IPv4 mismatches on Windows. */
const proxy = {
  "/socket.io": { target: "http://127.0.0.1:3001", ws: true },
  "/api": {
    target: "http://127.0.0.1:3001",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ""),
    /** Large PNGs through Vite dev/preview proxy */
    timeout: 120_000,
    proxyTimeout: 120_000,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy,
  },
  preview: {
    proxy,
  },
});
