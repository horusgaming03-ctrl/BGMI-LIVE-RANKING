import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import socket, { API, apiUrl } from "./socket";
import { buildOverlayStreamRankingOrder } from "../teamDisplayOrder";
import { normalizeTeamsPayload, overlayPackEqual, teamsPayloadEqual } from "./hooks/useSocketTeams";
import { mergeObsBgmiLayerPack, OBS_BGMI_LAYER_IDS, resolveBgmiLayerPlateId } from "../obsBgmiLayerPack";

/**
 * OBS / CEF sometimes resolves root-relative `/api/uploads/...` incorrectly. Use full URL on the page origin.
 */
function toAbsoluteMediaUrl(pathOrUrl) {
  if (pathOrUrl == null || pathOrUrl === "") return null;
  const s = String(pathOrUrl).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (typeof window !== "undefined" && window.location?.origin && s.startsWith("/")) {
    return `${window.location.origin}${s}`;
  }
  return s;
}

/** Team logos live under `/uploads/…`; allow missing leading slash. */
function resolveTeamLogoSrc(logoPath) {
  if (typeof logoPath !== "string" || !logoPath.trim()) return null;
  let s = logoPath.trim();
  if (s.includes("..")) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const normalized = (s.startsWith("/") ? s : `/${s}`).replace(/\/+/g, "/");
  if (normalized.includes("..")) return null;
  if (!/^\/uploads\//i.test(normalized)) return null;
  return toAbsoluteMediaUrl(`${API}${normalized}`);
}

function cacheBustUrl(url, fingerprint) {
  if (!url) return url;
  if (fingerprint == null || fingerprint === "") return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_cv=${encodeURIComponent(String(fingerprint))}`;
}

function alivePlayersCount(team) {
  const st = String(team.status || "alive").toLowerCase();
  if (st === "eliminated") return 0;
  const ap = team.alivePlayers;
  if (typeof ap === "number" && Number.isFinite(ap)) return Math.max(0, Math.min(4, Math.trunc(ap)));
  if (st === "alive") return 4;
  return 0;
}

function getContainedBitmapRectPx(imgEl, rootEl) {
  if (!imgEl || !rootEl || !imgEl.naturalWidth || !imgEl.naturalHeight) return null;
  const nw = imgEl.naturalWidth;
  const nh = imgEl.naturalHeight;
  /** Layout box is NOT CSS-transform-expanded; bbox is — wrong for contain math when scale≠100%. */
  const layoutW = Math.max(1, imgEl.offsetWidth);
  const layoutH = Math.max(1, imgEl.offsetHeight);
  const bx = imgEl.getBoundingClientRect();
  const rr = rootEl.getBoundingClientRect();
  const innerScale = Math.min(layoutW / nw, layoutH / nh);
  const cw = nw * innerScale;
  const ch = nh * innerScale;
  const left = bx.left - rr.left;
  const top = bx.top - rr.top;
  return { left, top, width: cw, height: ch };
}

/** OBS/CEF: flex row + % bases is far more predictable than dense grid minmax() for PNG overlays */
function minimalRowFlexWidths(showRankPill, metricsSplit, showFfAndTf) {
  if (showRankPill) {
    if (metricsSplit)
      return { rank: "0 0 clamp(34px,5.8vmin,56px)", team: "1 1 min(52%,560px)", fp: "0 0 10%", fp2: "0 0 10%", dots: "0 0 clamp(92px,11%,140px)" };
    if (showFfAndTf)
      return { rank: "0 0 clamp(34px,5.8vmin,56px)", team: "1 1 min(50%,560px)", fp: "0 0 17%", fp2: null, dots: "0 0 clamp(84px,10%,136px)" };
    return {
      rank: "0 0 clamp(34px,5.8vmin,56px)",
      team: "1 1 min(54%,620px)",
      fp: "0 0 clamp(96px,12%,148px)",
      fp2: null,
      dots: "0 0 clamp(92px,11%,136px)",
    };
  }
  if (metricsSplit)
    return { rank: null, team: "1 1 min(56%,620px)", fp: "0 0 10%", fp2: "0 0 10%", dots: "0 0 clamp(92px,11%,140px)" };
  if (showFfAndTf)
    return { rank: null, team: "1 1 min(54%,620px)", fp: "0 0 18%", fp2: null, dots: "0 0 clamp(92px,11%,138px)" };
  return {
    rank: null,
    team: "1 1 min(58%,640px)",
    fp: "0 0 clamp(96px,12%,148px)",
    fp2: null,
    dots: "0 0 clamp(92px,11%,136px)",
  };
}

/**
 * OBS BGMI layered plates + live data. Data chrome: PNG-only text (`chrome=minimal`) or optional built-in gold board (`chrome=board`).
 */
export default function ObsBgmiLayeredRankingOverlay() {
  const location = useLocation();
  const params = useParams();
  const pathname = String(location.pathname || "").replace(/\/+$/, "");
  const viewMode =
    pathname.includes("/overlay/bgmi-layer-plate/") || pathname.endsWith("/bgmi-layer-plate")
      ? "plate"
      : pathname.includes("/overlay/bgmi-layered-rows")
        ? "rows"
        : "composite";

  const plateLayerId = viewMode === "plate" ? resolveBgmiLayerPlateId(String(params.plateId ?? "").trim()) : null;

  const searchParams = useMemo(() => new URLSearchParams(location.search || ""), [location.search]);
  const debug = searchParams.get("debug") === "1";

  const [pack, setPack] = useState(() => mergeObsBgmiLayerPack({}));
  const [teams, setTeams] = useState([]);
  const [assetsEpoch, setAssetsEpoch] = useState(0);
  const [layoutTick, setLayoutTick] = useState(0);
  /** Letterboxed drawable area of live-ranking PNG, px relative to `.bgmi-layered-root`. */
  const [contentRect, setContentRect] = useState(null);
  const rootRef = useRef(null);
  const mainRankingImgRef = useRef(null);

  useEffect(() => {
    const apply = (payload) => {
      if (!payload?.obsBgmiLayerPack || typeof payload.obsBgmiLayerPack !== "object") return;
      const nextPack = mergeObsBgmiLayerPack({}, payload.obsBgmiLayerPack);
      setPack((prevPack) => {
        if (overlayPackEqual(prevPack, nextPack)) return prevPack;
        setAssetsEpoch((n) => n + 1);
        return nextPack;
      });
    };
    socket.on("settingsUpdated", apply);
    socket.emit("requestSettings");
    fetch(apiUrl("/settings"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => payload && apply(payload))
      .catch(() => {});
    return () => socket.off("settingsUpdated", apply);
  }, []);

  useEffect(() => {
    const onTeams = (data) => {
      const next = normalizeTeamsPayload(data);
      setTeams((prev) => (teamsPayloadEqual(prev, next) ? prev : next));
    };
    socket.on("teamsUpdated", onTeams);
    socket.emit("requestTeams");
    return () => socket.off("teamsUpdated", onTeams);
  }, []);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.background = "transparent";
    return () => {
      document.body.style.margin = "";
      document.body.style.background = "";
    };
  }, []);

  const dp = pack.dataPanel;
  const fpMetric = dp.fpMetric === "points" ? "points" : "finishes";
  const showFfAndTf = fpMetric === "points";
  const chromeParam = searchParams.get("chrome");
  /** Built-in gradients vs PNG-only backdrop: persist in settings; URL `?chrome=board|minimal` overrides. */
  let dataChrome = dp.chrome === "board" ? "board" : "minimal";
  if (chromeParam === "board" || chromeParam === "minimal") dataChrome = chromeParam;

  const anchorQs = searchParams.get("anchor");
  let dataAnchor = dp.dataAnchor === "contain" ? "contain" : "viewport";
  if (anchorQs === "contain" || anchorQs === "viewport") dataAnchor = anchorQs;

  const mainRankingLayer = pack.layers?.main_ranking_png;
  const useContainAnchor =
    dataAnchor === "contain" &&
    viewMode !== "rows" &&
    Boolean(mainRankingLayer?.path) &&
    mainRankingLayer?.visible !== false;

  const metricsSplit = showFfAndTf && dp.metricLayout === "split";
  const showRankPill = dp.showRankPill !== false;

  const minimalFlex = useMemo(() => {
    if (dataChrome !== "minimal") return null;
    return minimalRowFlexWidths(showRankPill, metricsSplit, showFfAndTf);
  }, [dataChrome, showRankPill, metricsSplit, showFfAndTf]);

  useLayoutEffect(() => {
    if (!useContainAnchor) {
      setContentRect(null);
      return undefined;
    }
    const rootEl = rootRef.current;
    const imgEl = mainRankingImgRef.current;
    function run() {
      if (!rootEl || !imgEl) {
        setContentRect(null);
        return;
      }
      const next = getContainedBitmapRectPx(imgEl, rootEl);
      setContentRect(next && next.width >= 8 && next.height >= 8 ? next : null);
    }
    run();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => queueMicrotask(run)) : null;
    try {
      if (rootEl) ro?.observe(rootEl);
      if (imgEl) ro?.observe(imgEl);
    } catch {
      /* ignore */
    }
    window.addEventListener("resize", run);
    let id;
    try {
      id = window.requestAnimationFrame(run);
    } catch {
      id = null;
    }
    return () => {
      window.removeEventListener("resize", run);
      ro?.disconnect();
      if (id != null) window.cancelAnimationFrame(id);
    };
  }, [useContainAnchor, layoutTick, assetsEpoch, pack.layers?.main_ranking_png?.path, pack.layers?.main_ranking_png?.visible, viewMode]);

  const sorted = useMemo(() => {
    const rows = buildOverlayStreamRankingOrder(teams);
    const cap = Math.max(4, Math.min(32, Number(dp.rowCap) || 18));
    return rows.slice(0, cap);
  }, [teams, dp.rowCap]);

  const layerSorted = useMemo(() => {
    if (viewMode === "rows") return [];
    if (viewMode === "plate") {
      if (!plateLayerId) return [];
      const L = pack.layers[plateLayerId];
      if (!L || !L.path) return [];
      return [{ id: plateLayerId, ...L }];
    }
    return OBS_BGMI_LAYER_IDS.map((id) => {
      const L = pack.layers[id];
      if (!L || L.visible === false || !L.path) return null;
      return { id, ...L };
    })
      .filter(Boolean)
      .sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));
  }, [pack.layers, viewMode, plateLayerId]);

  useEffect(() => {
    const t =
      viewMode === "rows"
        ? "OBS · BGMI rows only"
        : viewMode === "plate"
          ? `OBS · BGMI plate · ${plateLayerId || "?"}`
          : "OBS · BGMI layered ranking";
    document.title = t;
  }, [viewMode, plateLayerId]);

  const accent =
    typeof dp.accent === "string" && dp.accent.startsWith("#") && dp.accent.length >= 7 ? dp.accent : "#22c55e";

  /** Rows: combined + rows-only URLs, and live-ranking plate (main board art + table in one OBS source). */
  const showData =
    dp.visible !== false &&
    (viewMode !== "plate" || plateLayerId === "main_ranking_png");

  const dataShellStyle = useMemo(() => {
    const outline = debug ? "2px dashed rgba(34,211,238,0.95)" : "none";
    const tp = Number(dp.topPct) || 0;
    const lp = Number(dp.leftPct) || 0;
    const wp = Number(dp.widthPct) || 20;
    const hp = Number(dp.heightPct) || 50;
    if (useContainAnchor && contentRect) {
      const cr = contentRect;
      return {
        position: "absolute",
        boxSizing: "border-box",
        top: cr.top + (tp / 100) * cr.height,
        left: cr.left + (lp / 100) * cr.width,
        width: (wp / 100) * cr.width,
        height: (hp / 100) * cr.height,
        outline,
        zIndex: 120,
      };
    }
    return {
      position: "absolute",
      boxSizing: "border-box",
      top: `${tp}%`,
      left: `${lp}%`,
      width: `${wp}%`,
      height: `${hp}%`,
      outline,
      zIndex: 120,
    };
  }, [
    useContainAnchor,
    contentRect,
    dp.topPct,
    dp.leftPct,
    dp.widthPct,
    dp.heightPct,
    debug,
  ]);

  return (
    <div className="bgmi-layered-root" ref={rootRef}>
      {layerSorted.map((L) => {
        const abs = toAbsoluteMediaUrl(`${API}${L.path}`);
        return (
          <img
            key={L.id}
            src={cacheBustUrl(abs, `${assetsEpoch}:${L.path}`)}
            alt=""
            draggable={false}
            ref={(el) => {
              if (L.id === "main_ranking_png") mainRankingImgRef.current = el;
            }}
            onLoad={() => {
              if (L.id === "main_ranking_png") setLayoutTick((n) => n + 1);
            }}
            className="bgmi-layered-png"
            style={{
              left: `${Number(L.leftPct) || 0}%`,
              top: `${Number(L.topPct) || 0}%`,
              width: `${Math.max(0.2, Number(L.widthPct) || 10)}%`,
              height: `${Math.max(0.2, Number(L.heightPct) || 10)}%`,
              objectFit: "contain",
              objectPosition: "top left",
              zIndex: Number(L.zIndex) || 0,
              pointerEvents: "none",
              transform: `scale(${(Number(L.scalePct) || 100) / 100})`,
              transformOrigin: "top left",
            }}
          />
        );
      })}

      {showData ? (
        <div
          className={`bgmi-data-shell${showFfAndTf && metricsSplit ? " bgmi-data-shell--split-metrics" : showFfAndTf ? " bgmi-data-shell--dual-fp" : ""}${dataChrome === "minimal" ? " bgmi-data-shell--minimal" : ""}`}
          style={dataShellStyle}
        >
          {dataChrome === "board" ? (
            <header className={`bgmi-board-head${showRankPill ? "" : " bgmi-board-head--no-rank"}`}>
              {showRankPill ? <div className="bgmi-head-rank">#</div> : null}
              <div className={`bgmi-head-bar${metricsSplit ? " bgmi-head-bar--split" : ""}`}>
                <span className="bgmi-head-team">TEAM NAME</span>
                {metricsSplit ? (
                  <>
                    <span className="bgmi-head-fp">FF</span>
                    <span className="bgmi-head-fp">TF</span>
                  </>
                ) : (
                  <span className="bgmi-head-fp">{showFfAndTf ? "FF / TF" : "FF"}</span>
                )}
                <span className="bgmi-head-status">STATUS</span>
              </div>
            </header>
          ) : null}

          <div
            className={`bgmi-board-body${dataChrome === "minimal" ? " bgmi-board-body--edge" : ""}`}
            style={
              dataChrome === "minimal" && sorted.length > 0
                ? {
                    display: "grid",
                    gridTemplateRows: `repeat(${sorted.length}, minmax(0, 1fr))`,
                    gap: 0,
                    flex: 1,
                    minHeight: 0,
                  }
                : undefined
            }
          >
            {sorted.map((t, idx) => {
              const ff = Math.max(0, Math.floor(Number(t.finishes) || 0));
              const tf = Math.max(0, Math.floor(Number(t.points) || 0));
              const dots = alivePlayersCount(t);
              const rank = idx + 1;
              const rankLabel = String(rank).padStart(2, "0");
              const lg = resolveTeamLogoSrc(t.logo);
              const logoUrl = cacheBustUrl(lg, `${assetsEpoch}:${t.logo || ""}:${t.id}`);
              const name = String(t.team || "").trim() || "—";

              return (
                <div key={String(t.id)} className="bgmi-board-row">
                  {dataChrome === "board" && showRankPill ? <div className="bgmi-rank-pill">{rankLabel}</div> : null}
                  <div className="bgmi-row-gradient">
                    {minimalFlex ? (
                      <div
                        className="bgmi-row-minimal-flex"
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          width: "100%",
                          minHeight: "100%",
                          boxSizing: "border-box",
                          columnGap: "clamp(3px, 0.45vmin, 8px)",
                          padding: "0 4px 0 2px",
                        }}
                      >
                        {showRankPill ? (
                          <div className="bgmi-rank-cell" style={{ flex: minimalFlex.rank, minWidth: 0 }}>
                            {rankLabel}
                          </div>
                        ) : null}
                        <div className="bgmi-team-block" style={{ flex: minimalFlex.team, minWidth: 0 }}>
                          <div className="bgmi-logo-t">
                            {logoUrl ? (
                              <img src={logoUrl} alt="" draggable={false} loading="eager" decoding="async" />
                            ) : (
                              <span>{name.slice(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="bgmi-team-name">{name}</div>
                        </div>
                        {metricsSplit ? (
                          <>
                            <div className="bgmi-fp-slot" style={{ flex: minimalFlex.fp, minWidth: 0 }}>
                              <span className="bgmi-fp-num">{ff}</span>
                            </div>
                            <div className="bgmi-tf-slot" style={{ flex: minimalFlex.fp2 || "0 0 10%", minWidth: 0 }}>
                              <span className="bgmi-fp-num">{tf}</span>
                            </div>
                          </>
                        ) : (
                          <div className="bgmi-fp-slot" style={{ flex: minimalFlex.fp, minWidth: 0 }}>
                            {showFfAndTf ? (
                              <span className="bgmi-dual-num" aria-label={`${ff} finish, ${tf} total`}>
                                <strong>{ff}</strong>
                                <span className="bgmi-mini-lbl">FF</span>
                                <span className="bgmi-slash">/</span>
                                <strong>{tf}</strong>
                                <span className="bgmi-mini-lbl">TF</span>
                              </span>
                            ) : (
                              <span className="bgmi-fp-num">{ff}</span>
                            )}
                          </div>
                        )}
                        <div className="bgmi-status-slot" style={{ flex: minimalFlex.dots, minWidth: 0 }}>
                          {dp.showAliveDots !== false ? (
                            <div className="bgmi-mini-dots" aria-hidden>
                              {[0, 1, 2, 3].map((i) => (
                                <span key={i} data-on={i < dots ? "1" : "0"} />
                              ))}
                            </div>
                          ) : (
                            <span className="bgmi-status-fallback">{dots > 0 ? "●●●●".slice(0, dots) : "—"}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={`bgmi-row-inner${metricsSplit ? " bgmi-row-inner--split" : ""}`}>
                        <div className="bgmi-team-block">
                          <div className="bgmi-logo-t">
                            {logoUrl ? (
                              <img src={logoUrl} alt="" draggable={false} loading="eager" decoding="async" />
                            ) : (
                              <span>{name.slice(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="bgmi-team-name">{name}</div>
                        </div>
                        {metricsSplit ? (
                          <>
                            <div className="bgmi-fp-slot">
                              <span className="bgmi-fp-num">{ff}</span>
                            </div>
                            <div className="bgmi-tf-slot">
                              <span className="bgmi-fp-num">{tf}</span>
                            </div>
                          </>
                        ) : (
                          <div className="bgmi-fp-slot">
                            {showFfAndTf ? (
                              <span className="bgmi-dual-num" aria-label={`${ff} finish, ${tf} total`}>
                                <strong>{ff}</strong>
                                <span className="bgmi-mini-lbl">FF</span>
                                <span className="bgmi-slash">/</span>
                                <strong>{tf}</strong>
                                <span className="bgmi-mini-lbl">TF</span>
                              </span>
                            ) : (
                              <span className="bgmi-fp-num">{ff}</span>
                            )}
                          </div>
                        )}
                        <div className="bgmi-status-slot">
                          {dp.showAliveDots !== false ? (
                            <div className="bgmi-mini-dots" aria-hidden>
                              {[0, 1, 2, 3].map((i) => (
                                <span key={i} data-on={i < dots ? "1" : "0"} />
                              ))}
                            </div>
                          ) : (
                            <span className="bgmi-status-fallback">{dots > 0 ? "●●●●".slice(0, dots) : "—"}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <style>{`
        html, body { margin:0; overflow:hidden; background:transparent !important; }
        .bgmi-layered-root { position:relative; width:100vw; height:100vh; overflow:hidden; }
        .bgmi-layered-png { position:absolute; display:block; }

        /* Gold tournament board (matches static template look; alive dots use admin accent) */
        .bgmi-data-shell {
          --bgmi-g1: #0c0a08;
          --bgmi-g2: #1a1410;
          --bgmi-g3: #4a3a18;
          --bgmi-g4: #a68420;
          --bgmi-g5: #e8c547;
          --bgmi-text: #faf8f2;
          position:absolute;
          display:flex;
          flex-direction:column;
          gap: 3px;
          box-sizing:border-box;
          padding: 2px 2px 0;
          isolation: isolate;
          font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif;
        }

        /* Text-only overlay: no duplicate gradients when PNG already paints the leaderboard frame */
        .bgmi-data-shell--minimal {
          background: transparent;
          /* Any row gap steals height vs the PNG grid and stacks rows wrong */
          gap: 0;
          padding: 0;
        }
        .bgmi-data-shell--minimal .bgmi-board-body--edge {
          gap: 0;
        }
        .bgmi-data-shell--minimal .bgmi-rank-pill {
          background: transparent;
          border-color: transparent;
          text-shadow: 0 0 10px #000, 0 2px 4px rgba(0,0,0,.95), 1px 1px 0 rgba(0,0,0,.8);
        }
        .bgmi-data-shell--minimal .bgmi-row-gradient {
          background: transparent;
          border: none;
          box-shadow: none;
          flex: 1;
          min-width: 0;
          width: 100%;
        }
        .bgmi-data-shell--minimal .bgmi-logo-t {
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .bgmi-data-shell--minimal .bgmi-team-name,
        .bgmi-data-shell--minimal .bgmi-rank-cell,
        .bgmi-data-shell--minimal .bgmi-fp-num,
        .bgmi-data-shell--minimal .bgmi-tf-slot .bgmi-fp-num,
        .bgmi-data-shell--minimal .bgmi-dual-num,
        .bgmi-data-shell--minimal .bgmi-status-fallback {
          text-shadow: 0 0 10px #000, 0 2px 4px rgba(0,0,0,.9);
        }

        .bgmi-board-head {
          display: flex;
          align-items: stretch;
          gap: 4px;
          flex-shrink: 0;
        }
        .bgmi-board-head--no-rank .bgmi-head-bar {
          flex: 1;
          min-width: 0;
        }
        .bgmi-head-rank {
          width: clamp(30px, 3.4vmin, 42px);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: clamp(9px, 1.35vmin, 12px);
          letter-spacing: 0.12em;
          color: var(--bgmi-text);
          background: linear-gradient(135deg, var(--bgmi-g4) 0%, var(--bgmi-g5) 40%, var(--bgmi-g3) 100%);
          border-radius: 8px;
          border: 1px solid rgba(232,197,71,0.45);
        }
        .bgmi-head-bar {
          flex: 1;
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(12ch, 42%) minmax(2.25rem, 16%) minmax(5rem, 22%);
          align-items: center;
          gap: 6px;
          padding: 4px 10px 4px 12px;
          border-radius: 8px;
          background: linear-gradient(90deg, var(--bgmi-g5) 0%, var(--bgmi-g4) 22%, var(--bgmi-g3) 45%, var(--bgmi-g1) 100%);
          border: 1px solid rgba(232,197,71,0.35);
          font-weight: 800;
          font-size: clamp(8px, 1.25vmin, 11px);
          letter-spacing: 0.1em;
          color: var(--bgmi-text);
          text-transform: uppercase;
          text-shadow: 0 1px 2px rgba(0,0,0,0.85);
        }
        .bgmi-head-team { justify-self: start; }
        .bgmi-head-fp { justify-self: end; text-align: right; }
        .bgmi-head-status { justify-self: end; text-align: right; padding-right: 2px; }

        .bgmi-data-shell--dual-fp .bgmi-head-bar {
          grid-template-columns: minmax(12ch, 38%) minmax(3.5rem, 22%) minmax(5rem, 22%);
        }
        .bgmi-head-bar.bgmi-head-bar--split {
          grid-template-columns: minmax(11ch, 36%) minmax(2rem, 12%) minmax(2rem, 12%) minmax(4.5rem, 18%);
          align-items: center;
          gap: 5px;
        }

        .bgmi-board-body {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
          overflow: hidden;
        }

        .bgmi-board-row {
          flex: 1;
          display: flex;
          align-items: stretch;
          gap: 4px;
          min-height: 0;
        }

        .bgmi-rank-pill {
          width: clamp(30px, 3.4vmin, 42px);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
          font-size: clamp(10px, 1.45vmin, 14px);
          color: var(--bgmi-text);
          background: #050505;
          border: 1px solid rgba(255,255,255,0.12);
          text-shadow: 0 1px 2px #000;
        }

        .bgmi-row-gradient {
          flex: 1;
          min-width: 0;
          border-radius: 10px;
          overflow: visible;
          background: linear-gradient(
            90deg,
            #050504 0%,
            #12100e 28%,
            #2e2616 52%,
            #6e5420 78%,
            #caa23a 100%
          );
          border: 1px solid rgba(232,197,71,0.22);
          box-shadow: inset 0 1px 0 rgba(255,248,210,0.12);
        }
        /* Gold-board rows clip to the faux bar; minimal stays open so glyphs align to PNG grids */
        .bgmi-data-shell:not(.bgmi-data-shell--minimal) .bgmi-row-gradient {
          overflow: hidden;
        }

        /*
         * Team column uses % + ch mins so FIN/TOT cells keep space (OBS/old CEF choke on minmax(0,1fr)).
         * All cells min-width:0 so grid items cannot spill into the STATUS track.
         */
        .bgmi-row-inner {
          display: grid;
          grid-template-columns: minmax(12ch, 42%) minmax(2.25rem, 16%) minmax(5rem, 22%);
          align-items: center;
          gap: 4px;
          padding: 0 4px 0 2px;
          min-height: 100%;
          width: 100%;
          box-sizing: border-box;
        }
        .bgmi-row-inner > * {
          min-width: 0;
        }
        .bgmi-data-shell--dual-fp .bgmi-row-inner {
          grid-template-columns: minmax(12ch, 38%) minmax(3.5rem, 22%) minmax(5rem, 22%);
        }
        .bgmi-row-inner.bgmi-row-inner--split {
          grid-template-columns: minmax(11ch, 36%) minmax(2rem, 12%) minmax(2rem, 12%) minmax(4.5rem, 18%);
          align-items: center;
          gap: 3px;
        }

        /* Minimal rows are flex (not grid); justify-self does not apply — align numbers like the board grid */
        .bgmi-row-minimal-flex .bgmi-fp-slot,
        .bgmi-row-minimal-flex .bgmi-tf-slot {
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        .bgmi-data-shell--minimal .bgmi-board-row {
          min-height: 0;
        }
        .bgmi-rank-cell {
          font-weight: 900;
          font-variant-numeric: tabular-nums;
          font-size: clamp(9px, 1.35vmin, 13px);
          text-align: center;
          align-self: center;
          color: var(--bgmi-text);
          min-width: 0;
        }

        .bgmi-team-block {
          display: flex;
          align-items: center;
          gap: 5px;
          max-width: 100%;
          overflow: hidden;
        }
        .bgmi-logo-t {
          width: clamp(26px, 3.6vmin, 40px);
          height: clamp(26px, 3.6vmin, 40px);
          flex-shrink: 0;
          border-radius: 7px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: clamp(8px, 1.3vmin, 12px);
          color: var(--bgmi-text);
        }
        .bgmi-logo-t img { width: 100%; height: 100%; object-fit: contain; }

        .bgmi-team-name {
          font-weight: 800;
          font-size: clamp(9px, 1.42vmin, 14px);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--bgmi-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 1px 3px rgba(0,0,0,0.9);
          min-width: 0;
          flex: 1 1 0%;
        }

        .bgmi-fp-slot {
          justify-self: end;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .bgmi-tf-slot {
          justify-self: end;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .bgmi-fp-num {
          font-weight: 900;
          font-size: clamp(11px, 1.72vmin, 17px);
          color: var(--bgmi-text);
          text-shadow: 0 0 10px rgba(0,0,0,0.75);
        }
        .bgmi-dual-num {
          font-weight: 800;
          font-size: clamp(9px, 1.45vmin, 14px);
          color: var(--bgmi-text);
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0,0,0,0.85);
        }
        .bgmi-dual-num strong { font-weight: 900; }
        .bgmi-mini-lbl {
          font-size: 0.62em;
          font-weight: 800;
          opacity: 0.88;
          margin-left: 1px;
          letter-spacing: 0.04em;
        }
        .bgmi-slash {
          margin: 0 3px;
          opacity: 0.55;
          font-weight: 700;
        }

        .bgmi-status-slot {
          justify-self: end;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .bgmi-status-fallback {
          font-size: clamp(8px, 1.2vmin, 11px);
          color: var(--bgmi-text);
          opacity: 0.7;
        }

        .bgmi-mini-dots {
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .bgmi-mini-dots span {
          display: inline-block;
          width: clamp(6px, 1vmin, 10px);
          height: clamp(6px, 1vmin, 10px);
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(0,0,0,0.35);
          box-sizing: border-box;
        }
        .bgmi-mini-dots span[data-on="1"] {
          background: ${accent};
          border-color: ${accent};
          box-shadow: 0 0 8px ${accent}aa;
        }
      `}</style>
    </div>
  );
}
