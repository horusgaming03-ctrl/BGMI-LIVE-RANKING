"use strict";

/**
 * Start API (SERVE_SPA=false) + Vite client together so `/api` uploads always hit current backend.
 * Clears stale listeners on 3001/5173, waits for API, then starts Vite (avoids ECONNRESET / EADDRINUSE).
 * Ctrl+C terminates both processes.
 */
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const root = path.join(__dirname, "..");
const procList = [];
const API_PORT = Number(process.env.PORT) || 3001;
const VITE_PORT = Number(process.env.VITE_PORT) || 5173;

function killPorts(ports) {
  const script = path.join(root, "scripts", "kill-port-listeners.mjs");
  try {
    execSync(`"${process.execPath}" "${script}" ${ports.join(" ")}`, {
      cwd: root,
      stdio: "inherit",
    });
  } catch {
    /* no listeners or already free */
  }
}

function viteEntryPath() {
  return path.join(root, "client", "node_modules", "vite", "bin", "vite.js");
}

function verifyViteInstalled() {
  const p = viteEntryPath();
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

function waitForPort(port, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      const socket = net.connect({ port, host: "127.0.0.1" }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`API did not open on port ${port} within ${timeoutMs / 1000}s`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
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
  setTimeout(() => process.exit(code), 250);
}

console.log(`[run-dev] Freeing ports ${API_PORT} (API) and ${VITE_PORT} (Vite)…`);
killPorts([API_PORT, VITE_PORT]);

const viteEntry = verifyViteInstalled();
const viteCwd = path.join(root, "client");
const viteArgs = process.argv.slice(2);

const apiChild = spawn(process.execPath, [path.join(root, "scripts", "start-backend.js")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PORT: String(API_PORT) },
});
procList.push(apiChild);

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

apiChild.on("exit", (c) => {
  if (c !== 0 && c !== null) shutdown(c);
});

waitForPort(API_PORT)
  .then(() => {
    console.log(`[run-dev] API listening on ${API_PORT} — starting Vite…`);
    const viteChild = spawn(process.execPath, [viteEntry, ...viteArgs], {
      cwd: viteCwd,
      stdio: "inherit",
      env: { ...process.env },
    });
    procList.push(viteChild);
    viteChild.on("exit", (c) => {
      if (c !== 0 && c !== null) shutdown(c);
    });
  })
  .catch((err) => {
    console.error(`[run-dev] ${err.message}`);
    shutdown(1);
  });
