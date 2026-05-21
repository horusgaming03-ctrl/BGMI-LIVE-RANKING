"use strict";

/**
 * Start API (SERVE_SPA=false) + Vite client together so `/api` uploads always hit current backend.
 * Ctrl+C terminates both processes.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const procList = [];

function viteCliPath() {
  const cw = path.join(root, "client");
  const win = /^win/i.test(process.platform);
  return path.join(cw, "node_modules", ".bin", win ? "vite.cmd" : "vite");
}

function verifyViteInstalled() {
  const p = viteCliPath();
  if (!fs.existsSync(p)) {
    console.error(
      `[run-dev] Missing Vite at ${p}\n` +
        "Install client dependencies:\n" +
        "  cd client && npm install\n" +
        "Then run npm run dev again from the repo root.",
    );
    process.exit(1);
  }
  return p;
}

function shutdown(code = 0) {
  for (const child of procList) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

const viteBin = verifyViteInstalled();
const viteCwd = path.join(root, "client");
const win = /^win/i.test(process.platform);

const apiChild = spawn(process.execPath, [path.join(root, "scripts", "start-backend.js")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env },
});
procList.push(apiChild);

/** Prefer the local Vite binary (more reliable than `npm.cmd run dev` on some Windows setups). */
const viteChild = spawn(viteBin, [], {
  cwd: viteCwd,
  stdio: "inherit",
  shell: win,
});
procList.push(viteChild);

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

apiChild.on("exit", (c) => {
  if (c !== 0 && c !== null) shutdown(c);
});
viteChild.on("exit", (c) => {
  if (c !== 0 && c !== null) shutdown(c);
});
