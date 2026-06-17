/**
 * OBS Theme Engine — boots a theme pack, connects live data, renders modular overlays.
 */

import { createDataBridge } from "./data-bridge.js";
import { discoverAssets, mountPngFrames } from "./png-placer.js";
import { renderModule, resolveModuleFromUrl, MODULE_IDS } from "./modules.js";

export { MODULE_IDS };

export async function bootObsTheme({ themeId, hooks = {} }) {
  const root = document.getElementById("obs-root");
  if (!root) throw new Error("Missing #obs-root");

  const themeBase = new URL(".", window.location.href);
  const layoutUrl = new URL("layout.json", themeBase);
  const layoutRes = await fetch(layoutUrl);
  if (!layoutRes.ok) throw new Error(`layout.json not found for ${themeId}`);
  const layout = await layoutRes.json();

  document.body.dataset.theme = themeId;
  document.body.dataset.module = resolveModuleFromUrl();
  if (layout?.typography?.fontFamily) {
    document.body.style.fontFamily = layout.typography.fontFamily;
  }

  const assets = await discoverAssets(themeBase.href, layout);
  if (assets.background) {
    const bg = document.createElement("div");
    bg.className = "obs-bg-layer";
    bg.style.backgroundImage = `url("${assets.background}")`;
    root.appendChild(bg);
  }

  mountPngFrames(root, layout, assets, hooks);

  const listeners = { teams: [], match: [], tournament: [], elimination: [], winner: [], command: [], recall: [] };
  const bridge = createDataBridge({
    teams: (t) => listeners.teams.forEach((fn) => fn(t)),
    match: (m) => { bridge.match = m; listeners.match.forEach((fn) => fn(m)); },
    tournament: (t) => { bridge.tournament = t; listeners.tournament.forEach((fn) => fn(t)); },
    elimination: (e) => listeners.elimination.forEach((fn) => fn(e)),
    winner: (w) => listeners.winner.forEach((fn) => fn(w)),
    command: (c) => listeners.command.forEach((fn) => fn(c)),
    recall: (r) => listeners.recall.forEach((fn) => fn(r)),
    settings: (s) => { bridge.settings = s; },
  });

  bridge.teams = bridge.getTeams();
  bridge.match = bridge.getMatch();
  bridge.tournament = bridge.getTournament();
  bridge.settings = bridge.getSettings();

  const ctx = {
    root,
    themeId,
    layout,
    assets,
    hooks,
    apiOrigin: bridge.apiOrigin,
    get teams() { return bridge.teams; },
    get match() { return bridge.match; },
    get tournament() { return bridge.tournament; },
    onTeams(fn) { listeners.teams.push(fn); fn(bridge.teams); },
    onMatch(fn) { listeners.match.push(fn); fn(bridge.match); },
    onTournament(fn) { listeners.tournament.push(fn); fn(bridge.tournament); },
    onElimination(fn) { listeners.elimination.push(fn); },
    onWinner(fn) { listeners.winner.push(fn); },
    onCommand(fn) { listeners.command.push(fn); },
    onRecall(fn) { listeners.recall.push(fn); },
  };

  if (typeof hooks.onMount === "function") hooks.onMount(ctx);

  const moduleId = resolveModuleFromUrl();
  const mod = renderModule(moduleId, ctx);
  if (mod) root.appendChild(mod);

  if (new URLSearchParams(window.location.search).get("debug") === "1") {
    root.appendChild(Object.assign(document.createElement("div"), { className: "obs-debug-grid" }));
  }

  return ctx;
}
