/**
 * Kill process(es) listening on the given TCP port(s). Uses netstat/taskkill on Windows.
 * Usage: node scripts/kill-port-listeners.mjs 3001
 */
import { execSync } from "child_process";

const ports = process.argv.slice(2).map(Number).filter((n) => n > 0);
if (!ports.length) {
  console.error("Usage: node scripts/kill-port-listeners.mjs <port> [<port>...]");
  process.exit(1);
}

function killPortWindows(port) {
  let text = "";
  try {
    text = execSync(`netstat -ano`, { encoding: "utf8" });
  } catch {
    return;
  }
  const pids = new Set();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.includes("LISTENING")) continue;
    if (!trimmed.includes(`:${port}`)) continue;
    const parts = trimmed.split(/\s+/);
    const pid = parts[parts.length - 1];
    if (/^\d+$/.test(pid)) pids.add(pid);
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "inherit" });
      console.log(`[kill-port] Stopped PID ${pid} (port ${port})`);
    } catch {
      // ignore — process may already be gone
    }
  }
}

for (const p of ports) {
  if (process.platform === "win32") {
    killPortWindows(p);
  } else {
    try {
      execSync(`sh -c 'lsof -ti:${p} | xargs kill -9 2>/dev/null'`);
    } catch {
      console.warn(`[kill-port] No listener cleared on ${p} (unix)`);
    }
  }
}
