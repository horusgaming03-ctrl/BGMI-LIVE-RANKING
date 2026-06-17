/**
 * Reusable OBS overlay modules — live ranking, elimination, top 4, recall, MVP, etc.
 */

import { topFourAlive } from "./data-bridge.js";
import { applyLogoToFrame, fitImageInCell } from "./png-placer.js";

const MODULE_IDS = [
  "live-ranking",
  "eliminated",
  "top-four",
  "recall",
  "mvp",
  "match-winner",
  "kill-feed",
  "team-spotlight",
  "final-results",
];

export { MODULE_IDS };

function fieldVisible(layout, key) {
  const fields = layout?.fields || {};
  if (Object.prototype.hasOwnProperty.call(fields, key)) return Boolean(fields[key]);
  return true;
}

function gridTemplate(layout, moduleCfg) {
  const cols = [];
  if (fieldVisible(layout, "rank")) cols.push("var(--col-rank, 3.5em)");
  if (fieldVisible(layout, "teamLogo")) cols.push("var(--col-logo, 2.8em)");
  cols.push("1fr");
  if (fieldVisible(layout, "finishPoints")) cols.push("var(--col-fp, 4em)");
  if (fieldVisible(layout, "placementPoints")) cols.push("var(--col-pp, 4em)");
  if (fieldVisible(layout, "totalPoints")) cols.push("var(--col-tp, 4.5em)");
  if (fieldVisible(layout, "alivePlayers")) cols.push("var(--col-alive, 5em)");
  return cols.join(" ");
}

function cell(text, cls = "") {
  const el = document.createElement("span");
  el.className = `obs-cell ${cls}`.trim();
  el.textContent = text ?? "";
  return el;
}

function aliveDots(count, max = 4) {
  const wrap = document.createElement("span");
  wrap.className = "obs-alive-dots";
  for (let i = 0; i < max; i++) {
    const d = document.createElement("span");
    d.className = `obs-alive-dot${i < count ? " on" : ""}`;
    wrap.appendChild(d);
  }
  return wrap;
}

function logoCell(url) {
  const el = document.createElement("span");
  el.className = "obs-cell obs-cell-logo";
  if (url) {
    const img = document.createElement("img");
    img.className = "obs-logo";
    img.src = url;
    img.alt = "";
    fitImageInCell(img);
    el.appendChild(img);
  }
  return el;
}

function buildRow(team, layout, prevRankMap, hooks) {
  const row = document.createElement("div");
  row.className = "obs-row";
  row.dataset.teamId = String(team.id);
  row.style.gridTemplateColumns = gridTemplate(layout);

  const prev = prevRankMap.get(String(team.id));
  if (prev != null && team.rank < prev) row.classList.add("is-rank-up");
  if (team.eliminated) row.classList.add("is-eliminated");

  if (fieldVisible(layout, "rank")) {
    row.appendChild(cell(String(team.rank).padStart(2, "0"), "obs-cell-rank"));
  }
  if (fieldVisible(layout, "teamLogo")) {
    row.appendChild(logoCell(team.teamLogo));
  }

  row.appendChild(cell(team.teamName, "obs-cell-name"));

  if (fieldVisible(layout, "finishPoints")) {
    const fp = cell(String(team.finishPoints), "obs-cell-fp");
    if (!fieldVisible(layout, "finishPoints")) fp.classList.add("hidden-field");
    row.appendChild(fp);
  }
  if (fieldVisible(layout, "placementPoints")) {
    row.appendChild(cell(String(team.placementPoints), "obs-cell-pp"));
  }
  if (fieldVisible(layout, "totalPoints")) {
    row.appendChild(cell(String(team.totalPoints), "obs-cell-tp"));
  }
  if (fieldVisible(layout, "alivePlayers")) {
    const aliveWrap = document.createElement("span");
    aliveWrap.className = "obs-cell obs-cell-alive";
    aliveWrap.appendChild(aliveDots(team.alivePlayers));
    row.appendChild(aliveWrap);
  }

  if (typeof hooks?.decorateRow === "function") hooks.decorateRow(row, team, layout);
  return row;
}

function diffRows(container, teams, layout, hooks) {
  const prevRankMap = new Map();
  container.querySelectorAll(".obs-row").forEach((el) => {
    const id = el.dataset.teamId;
    const rankEl = el.querySelector(".obs-cell-rank");
    if (id && rankEl) prevRankMap.set(id, Number(rankEl.textContent) || 99);
  });

  const maxRows = layout?.modules?.["live-ranking"]?.maxRows ?? 16;
  const slice = teams.slice(0, maxRows);
  const existing = new Map();
  container.querySelectorAll(".obs-row").forEach((el) => existing.set(el.dataset.teamId, el));

  const frag = document.createDocumentFragment();
  slice.forEach((team, idx) => {
    const id = String(team.id);
    let row = existing.get(id);
    if (row) {
      existing.delete(id);
      const fresh = buildRow({ ...team, rank: idx + 1 }, layout, prevRankMap, hooks);
      row.replaceWith(fresh);
      frag.appendChild(fresh);
    } else {
      row = buildRow({ ...team, rank: idx + 1 }, layout, prevRankMap, hooks);
      row.classList.add("is-new");
      frag.appendChild(row);
    }
  });

  existing.forEach((el) => el.remove());
  container.innerHTML = "";
  container.appendChild(frag);
}

export function renderLiveRanking(ctx) {
  const cfg = ctx.layout?.modules?.["live-ranking"] || {};
  if (cfg.enabled === false) return null;

  const mod = document.createElement("div");
  mod.className = "obs-module obs-mod-live-ranking obs-anim-fade";
  mod.innerHTML = `
    <div class="obs-content">
      <header class="obs-panel-head">
        <span class="obs-match-badge obs-status-live">${ctx.match?.matchLabel || `Match ${ctx.match?.number || 1}`}</span>
        <span class="obs-panel-title">${cfg.title || "Live Ranking"}</span>
      </header>
      <div class="obs-rows"></div>
    </div>`;

  const rowsEl = mod.querySelector(".obs-rows");
  const render = () => diffRows(rowsEl, ctx.teams, ctx.layout, ctx.hooks);
  render();
  ctx.onTeams(render);
  ctx.onMatch(() => {
    const badge = mod.querySelector(".obs-match-badge");
    if (badge) badge.textContent = ctx.match?.matchLabel || `Match ${ctx.match?.number || 1}`;
  });

  return mod;
}

export function renderEliminated(ctx) {
  const cfg = ctx.layout?.modules?.eliminated || {};
  if (cfg.enabled === false) return null;

  const mod = document.createElement("div");
  mod.className = "obs-module obs-mod-eliminated";
  mod.innerHTML = `<div class="obs-elim-panel obs-anim-scale"><div class="obs-elim-inner"></div></div>`;

  const inner = mod.querySelector(".obs-elim-inner");
  mod.style.opacity = "0";

  ctx.onElimination((payload) => {
    const t = payload || {};
    inner.innerHTML = "";
    const panel = document.createElement("div");
    panel.className = "obs-elim-card obs-anim-slide";

    if (fieldVisible(ctx.layout, "teamLogo") && t.logo) {
      const img = document.createElement("img");
      img.className = "obs-logo";
      img.src = t.logo.startsWith("/") ? `${ctx.apiOrigin}${t.logo}` : t.logo;
      panel.appendChild(img);
    }

    const title = document.createElement("div");
    title.className = "obs-elim-title";
    title.textContent = t.team || "TEAM ELIMINATED";
    panel.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "obs-elim-meta";
    const parts = [];
    if (fieldVisible(ctx.layout, "rank") && t.rank != null) parts.push(`#${t.rank}`);
    if (fieldVisible(ctx.layout, "finishPoints")) parts.push(`${t.finishes ?? 0} finishes`);
    if (fieldVisible(ctx.layout, "totalPoints")) parts.push(`${t.points ?? 0} pts`);
    if (fieldVisible(ctx.layout, "eliminatorName") && t.eliminatorName) parts.push(`by ${t.eliminatorName}`);
    meta.textContent = parts.join(" · ");
    panel.appendChild(meta);

    inner.appendChild(panel);
    mod.style.opacity = "1";
    if (typeof ctx.hooks?.onElimination === "function") ctx.hooks.onElimination(mod, t);

    clearTimeout(mod._hideTimer);
    mod._hideTimer = setTimeout(() => { mod.style.opacity = "0"; }, cfg.durationMs || 6000);
  });

  return mod;
}

export function renderTopFour(ctx) {
  const cfg = ctx.layout?.modules?.["top-four"] || {};
  if (cfg.enabled === false) return null;

  const mod = document.createElement("div");
  mod.className = "obs-module obs-mod-top-four obs-anim-fade";
  mod.innerHTML = `<div class="obs-content"><div class="obs-top4-grid"></div></div>`;
  const grid = mod.querySelector(".obs-top4-grid");

  const render = () => {
    const top = topFourAlive(ctx.teams.map((t) => t.raw));
    grid.innerHTML = "";
    top.forEach((team, i) => {
      const card = document.createElement("div");
      card.className = "obs-top4-card obs-anim-scale";
      card.style.animationDelay = `${i * 0.08}s`;
      if (team.teamLogo) {
        const img = document.createElement("img");
        img.className = "obs-logo";
        img.src = team.teamLogo;
        card.appendChild(img);
      }
      const name = document.createElement("div");
      name.className = "obs-top4-name";
      name.textContent = team.teamName;
      card.appendChild(name);
      if (fieldVisible(ctx.layout, "alivePlayers")) {
        card.appendChild(aliveDots(team.alivePlayers));
      }
      grid.appendChild(card);
      applyLogoToFrame(ctx.root, "topFourPlayer", team.teamLogo);
    });
  };

  render();
  ctx.onTeams(render);
  return mod;
}

export function renderRecall(ctx) {
  const cfg = ctx.layout?.modules?.recall || {};
  if (cfg.enabled === false) return null;

  const mod = document.createElement("div");
  mod.className = "obs-module obs-mod-recall";
  mod.innerHTML = `<div class="obs-recall-popup obs-anim-scale"><span class="obs-recall-label">RECALL</span><span class="obs-recall-team"></span></div>`;
  mod.style.opacity = "0";

  const teamEl = mod.querySelector(".obs-recall-team");
  ctx.onRecall((payload) => {
    teamEl.textContent = payload?.team || payload?.teamName || "Team";
    mod.style.opacity = "1";
    mod.querySelector(".obs-recall-popup").classList.remove("obs-anim-scale");
    void mod.querySelector(".obs-recall-popup").offsetWidth;
    mod.querySelector(".obs-recall-popup").classList.add("obs-anim-scale");
    clearTimeout(mod._hideTimer);
    mod._hideTimer = setTimeout(() => { mod.style.opacity = "0"; }, cfg.durationMs || 4500);
  });

  return mod;
}

export function renderMvp(ctx) {
  const cfg = ctx.layout?.modules?.mvp || {};
  if (cfg.enabled === false) return null;

  const mod = document.createElement("div");
  mod.className = "obs-module obs-mod-mvp";
  mod.innerHTML = `<div class="obs-mvp-panel obs-anim-scale"><div class="obs-mvp-tag">MVP</div><div class="obs-mvp-name">—</div><div class="obs-mvp-stat"></div></div>`;

  ctx.onCommand((cmd) => {
    if (cmd?.type !== "showMvp" && cmd?.action !== "showMvp") return;
    const nameEl = mod.querySelector(".obs-mvp-name");
    const statEl = mod.querySelector(".obs-mvp-stat");
    nameEl.textContent = cmd.playerName || cmd.name || "Player";
    statEl.textContent = cmd.kills != null ? `${cmd.kills} finishes` : "";
    mod.classList.add("is-visible");
  });

  return mod;
}

export function renderMatchWinner(ctx) {
  const cfg = ctx.layout?.modules?.["match-winner"] || {};
  if (cfg.enabled === false) return null;

  const mod = document.createElement("div");
  mod.className = "obs-module obs-mod-winner";
  mod.innerHTML = `<div class="obs-winner-burst"><div class="obs-winner-label">WINNER</div><div class="obs-winner-team"></div></div>`;
  mod.style.opacity = "0";

  const teamEl = mod.querySelector(".obs-winner-team");
  ctx.onWinner((payload) => {
    teamEl.textContent = payload?.team || payload?.winner || "CHICKEN DINNER";
    mod.style.opacity = "1";
    mod.querySelector(".obs-winner-burst").style.animation = "obsWinnerBurst 0.9s cubic-bezier(0.22,1,0.36,1) both";
  });

  ctx.onCommand((cmd) => {
    if (cmd?.action === "showChickenDinner" || cmd?.type === "chickenDinner") {
      teamEl.textContent = cmd.team || cmd.winner || "WINNER";
      mod.style.opacity = "1";
    }
  });

  return mod;
}

export function renderKillFeed(ctx) {
  const cfg = ctx.layout?.modules?.["kill-feed"] || {};
  if (cfg.enabled === false) return null;

  const mod = document.createElement("div");
  mod.className = "obs-module obs-mod-kill-feed";
  const list = document.createElement("div");
  list.className = "obs-kill-list";
  mod.appendChild(list);

  const push = (text) => {
    const item = document.createElement("div");
    item.className = "obs-kill-item obs-anim-slide";
    item.textContent = text;
    list.prepend(item);
    while (list.children.length > (cfg.maxItems || 5)) list.lastChild.remove();
    setTimeout(() => item.remove(), cfg.itemMs || 8000);
  };

  ctx.onCommand((cmd) => {
    if (cmd?.type === "killFeed" || cmd?.action === "killFeed") {
      push(cmd.text || `${cmd.killer || "?"} eliminated ${cmd.victim || "?"}`);
    }
  });

  ctx.onElimination((t) => {
    if (fieldVisible(ctx.layout, "eliminatorName") && t?.eliminatorName) {
      push(`${t.eliminatorName} → ${t.team}`);
    }
  });

  return mod;
}

export function renderTeamSpotlight(ctx) {
  const cfg = ctx.layout?.modules?.["team-spotlight"] || {};
  if (cfg.enabled === false) return null;

  const mod = document.createElement("div");
  mod.className = "obs-module obs-mod-spotlight";
  mod.innerHTML = `<div class="obs-spotlight-card obs-anim-scale"><img class="obs-spotlight-logo obs-logo" alt="" /><div class="obs-spotlight-name"></div></div>`;
  mod.style.opacity = "0";

  const logo = mod.querySelector(".obs-spotlight-logo");
  const name = mod.querySelector(".obs-spotlight-name");

  ctx.onCommand((cmd) => {
    if (cmd?.type !== "teamSpotlight" && cmd?.action !== "teamSpotlight") return;
    name.textContent = cmd.teamName || cmd.team || "";
    logo.src = cmd.logo || "";
    logo.style.display = cmd.logo ? "" : "none";
    mod.style.opacity = "1";
  });

  return mod;
}

export function renderFinalResults(ctx) {
  const cfg = ctx.layout?.modules?.["final-results"] || {};
  if (cfg.enabled === false) return null;

  const mod = document.createElement("div");
  mod.className = "obs-module obs-mod-final obs-anim-fade";
  mod.innerHTML = `<div class="obs-content"><header class="obs-panel-head"><span class="obs-panel-title">${cfg.title || "Final Standings"}</span></header><div class="obs-rows"></div></div>`;

  const rowsEl = mod.querySelector(".obs-rows");
  const render = () => {
    const stats = ctx.tournament.length ? ctx.tournament : ctx.teams;
    const list = [...stats].sort((a, b) => (Number(b.totalPoints ?? b.points) || 0) - (Number(a.totalPoints ?? a.points) || 0));
    rowsEl.innerHTML = "";
    list.slice(0, cfg.maxRows || 16).forEach((t, i) => {
      const row = document.createElement("div");
      row.className = "obs-row";
      row.style.gridTemplateColumns = gridTemplate(ctx.layout);
      if (fieldVisible(ctx.layout, "rank")) row.appendChild(cell(String(i + 1).padStart(2, "0")));
      const logo = t.logo ? (t.logo.startsWith("/") ? `${ctx.apiOrigin}${t.logo}` : t.logo) : t.teamLogo;
      if (fieldVisible(ctx.layout, "teamLogo")) row.appendChild(logoCell(logo));
      row.appendChild(cell(t.team || t.teamName || "—"));
      if (fieldVisible(ctx.layout, "finishPoints")) row.appendChild(cell(String(t.totalKills ?? t.finishPoints ?? t.finishes ?? 0)));
      if (fieldVisible(ctx.layout, "totalPoints")) row.appendChild(cell(String(t.totalPoints ?? t.points ?? 0)));
      rowsEl.appendChild(row);
    });
  };

  render();
  ctx.onTeams(render);
  ctx.onTournament(render);
  return mod;
}

const RENDERERS = {
  "live-ranking": renderLiveRanking,
  eliminated: renderEliminated,
  "top-four": renderTopFour,
  recall: renderRecall,
  mvp: renderMvp,
  "match-winner": renderMatchWinner,
  "kill-feed": renderKillFeed,
  "team-spotlight": renderTeamSpotlight,
  "final-results": renderFinalResults,
};

export function renderModule(moduleId, ctx) {
  const fn = RENDERERS[moduleId];
  if (!fn) return null;
  const modCfg = ctx.layout?.modules?.[moduleId];
  if (modCfg?.enabled === false) return null;
  return fn(ctx);
}

export function resolveModuleFromUrl() {
  const sp = new URLSearchParams(window.location.search);
  const m = sp.get("module") || "live-ranking";
  return MODULE_IDS.includes(m) ? m : "live-ranking";
}
