import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBase, getOverlayPageOrigin } from "../apiOrigin";

const MODULE_LABELS = {
  "live-ranking": "Live Ranking Panel",
  eliminated: "Eliminated Team Panel",
  "top-four": "Top 4 Alive Panel",
  recall: "Recall Popup",
  mvp: "MVP Panel",
  "match-winner": "Match Winner Animation",
  "kill-feed": "Kill Feed",
  "team-spotlight": "Team Spotlight",
  "final-results": "Final Results Screen",
};

function obsThemeUrl(origin, themeId, moduleId) {
  const base = origin.replace(/\/$/, "");
  return `${base}/obs-themes/${themeId}/index.html?module=${encodeURIComponent(moduleId)}`;
}

export default function ObsEngineCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("Theme_Green");
  const [selectedModule, setSelectedModule] = useState("live-ranking");

  const pageOrigin = getOverlayPageOrigin();
  const apiBase = getApiBase();

  useEffect(() => {
    const url = apiBase === "/api" ? "/api/obs-themes/catalog" : `${apiBase}/obs-themes/catalog`;
    fetch(url)
      .then((r) => r.json())
      .then(setCatalog)
      .catch((e) => setError(e.message || "Failed to load catalog"));
  }, [apiBase]);

  const themes = catalog?.themes || [];
  const modules = catalog?.modules || Object.keys(MODULE_LABELS);

  const currentUrl = useMemo(
    () => obsThemeUrl(pageOrigin || "http://127.0.0.1:3001", selectedTheme, selectedModule),
    [pageOrigin, selectedTheme, selectedModule],
  );

  const copy = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(""), 2000);
    });
  }, []);

  const theme = themes.find((t) => t.id === selectedTheme);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <p className="text-amber-400/90 text-sm font-semibold tracking-widest uppercase mb-2">
            OBS Theme Engine
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Dynamic Esports Overlay Themes
          </h1>
          <p className="mt-3 text-zinc-400 max-w-2xl leading-relaxed">
            Each theme is an independent OBS browser source pack with its own layout, visuals, and
            field visibility — all synced to the same live tournament data via Socket.IO.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-red-200">
            {error}
          </div>
        )}

        <section className="grid md:grid-cols-3 gap-4">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTheme(t.id)}
              className={`text-left rounded-xl border p-4 transition ${
                selectedTheme === t.id
                  ? "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600"
              }`}
            >
              <div className="font-semibold text-lg">{t.name}</div>
              <div className="text-xs text-zinc-500 mt-1 font-mono">{t.id}</div>
              <p className="text-sm text-zinc-400 mt-2">{t.description}</p>
            </button>
          ))}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <h2 className="text-lg font-semibold">Overlay module</h2>
          <div className="flex flex-wrap gap-2">
            {modules.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedModule(m)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                  selectedModule === m
                    ? "border-amber-500 bg-amber-500/15 text-amber-100"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {MODULE_LABELS[m] || m}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
          <h2 className="text-lg font-semibold">OBS Browser Source URL</h2>
          <p className="text-sm text-zinc-400">
            Add a <strong>Browser Source</strong> in OBS and paste this URL. Width 1920 × Height 1080.
            Use your LAN IP instead of 127.0.0.1 if OBS runs on another PC.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 text-xs sm:text-sm bg-black/40 border border-zinc-700 rounded-lg px-3 py-2 break-all">
              {currentUrl}
            </code>
            <button
              type="button"
              onClick={() => copy(currentUrl)}
              className="shrink-0 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-semibold text-sm"
            >
              {copied === currentUrl ? "Copied!" : "Copy URL"}
            </button>
            <a
              href={currentUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 px-4 py-2 rounded-lg border border-zinc-600 hover:border-zinc-400 text-center text-sm"
            >
              Preview
            </a>
          </div>
        </section>

        {theme && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-lg font-semibold mb-3">All URLs for {theme.name}</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {modules.map((m) => {
                const url = obsThemeUrl(pageOrigin || "http://127.0.0.1:3001", theme.id, m);
                return (
                  <div key={m} className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm border-b border-zinc-800/80 pb-2">
                    <span className="sm:w-44 shrink-0 text-zinc-400">{MODULE_LABELS[m] || m}</span>
                    <code className="flex-1 text-xs text-zinc-300 truncate">{url}</code>
                    <button
                      type="button"
                      onClick={() => copy(url)}
                      className="text-amber-400 hover:text-amber-300 text-xs shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400 space-y-2">
          <h2 className="text-lg font-semibold text-zinc-200">Theme pack structure</h2>
          <pre className="text-xs bg-black/30 rounded-lg p-3 overflow-x-auto">{`obs-themes/
  Theme_Green/
    index.html
    style.css
    script.js
    layout.json
    assets/
  _engine/          ← shared live data + modules`}</pre>
          <p>
            Edit <code className="text-amber-300/90">layout.json</code> to control which stats render
            (finish vs total vs placement points). Drop PNGs into <code className="text-amber-300/90">assets/</code>{" "}
            and list them in <code className="text-amber-300/90">assets/manifest.json</code> for auto placement.
          </p>
        </section>
      </div>
    </div>
  );
}
