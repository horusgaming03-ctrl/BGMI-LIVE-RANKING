import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import socket, { API } from "./socket";
import { buildLiveRankingOrder } from "../teamDisplayOrder";

const SLOT_LABEL = {
  eliminations: "Eliminations",
  "top-four": "Top 4",
  "live-ranking": "Live ranking",
};

function eliminationStatus(t) {
  const r = t.eliminationRank;
  return r != null ? `OUT #${r}` : "OUT";
}

function aliveDotsFilled(t) {
  const s = String(t.status || "alive").toLowerCase();
  if (s === "eliminated") return 0;
  if (s === "rondo_benched") {
    const ap = t.alivePlayers;
    return typeof ap === "number" && Number.isFinite(ap) ? Math.max(0, Math.min(4, ap)) : 0;
  }
  const ap = t.alivePlayers;
  if (typeof ap === "number" && Number.isFinite(ap)) return Math.max(0, Math.min(4, ap));
  if (s === "alive") return 4;
  return 0;
}

function resolveTeamTitle(t) {
  const nm = typeof t.team === "string" ? t.team.trim() : "";
  return nm !== "" ? nm : "(unnamed)";
}

function resolveLogoSrc(logoPath) {
  if (typeof logoPath !== "string" || !logoPath.trim()) return null;
  const s = logoPath.trim();
  if (s.includes("..")) return null;
  if (s.startsWith("/uploads/")) return `${API}${s}`;
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

function teamStableKey(t) {
  return t.id != null ? String(t.id) : `@${resolveTeamTitle(t)}`;
}

function topFourAliveKeys(teamsList) {
  const ordered = buildLiveRankingOrder(Array.isArray(teamsList) ? teamsList : []);
  const alive = ordered.filter((t) => {
    const s = String(t.status || "alive").toLowerCase();
    return s === "alive" || s === "rondo_benched";
  });
  return new Set(alive.slice(0, 4).map(teamStableKey));
}

/** FP cell for gold4 template — wired to Dashboard PTS or Kills. */
function fpValue(t, fpMetric) {
  if (fpMetric === "finishes") return Number(t.finishes) || 0;
  return Number(t.points) || 0;
}

function goldStatus(slotId, t, topFourKeys) {
  const s = String(t.status || "alive").toLowerCase();
  if (s === "eliminated") return eliminationStatus(t);
  if (s === "rondo_benched") return "BENCH";
  if (slotId === "eliminations") return eliminationStatus(t);
  if (slotId === "top-four") return "TOP";
  if (topFourKeys.has(teamStableKey(t))) return "TOP 4";
  return "ALIVE";
}

/**
 * Position + theme · URL overrides server settings when present.
 * columns=gold4|live5  fp=pts|kills  rank=pad|hash
 */
function readLayout(search) {
  const sp = new URLSearchParams(search || "");
  const num = (k, d) => {
    const v = Number(sp.get(k));
    return Number.isFinite(v) ? v : d;
  };
  const c = sp.get("columns");
  const colsQS = c === "gold4" || c === "live5" ? c : null;
  const fpq = sp.get("fp");
  const fpQS = fpq === "kills" ? "finishes" : fpq === "pts" ? "points" : null;

  let rankExplicit = false;
  let rankStyle = "hash";
  if (sp.has("rank")) {
    rankExplicit = true;
    rankStyle = sp.get("rank") === "pad" ? "pad" : "hash";
  }

  return {
    topPct: num("top", 13),
    leftPct: num("left", 44),
    widthPct: num("w", 56),
    heightPct: num("h", 78),
    rowCap: Math.max(4, Math.min(32, Math.trunc(num("cap", 24)))),
    debug: sp.get("debug") === "1",
    theme: sp.get("theme") === "dark" ? "dark" : "gold",
    colsQS,
    fpQS,
    rankExplicit,
    rankStyle,
  };
}

function formatRank(displayIdx, rankStyle) {
  if (rankStyle === "pad") return String(displayIdx).padStart(2, "0");
  return `#${displayIdx}`;
}

/**
 * @param {'live5'|'gold4'} columnMode
 * @param {'points'|'finishes'} fpMetric
 */
function buildRows(slotId, teamsList, cap, columnMode, fpMetric, topFourKeys) {
  const teams = Array.isArray(teamsList) ? teamsList : [];

  const fromLive = (t, displayIdx, showDots) => ({
    mode: "live5",
    key: String(t.id ?? `t-${displayIdx}-${t.team}`),
    idx: displayIdx,
    empty: false,
    team: resolveTeamTitle(t),
    logo: resolveLogoSrc(t.logo),
    initials: resolveTeamTitle(t).slice(0, 2).toUpperCase(),
    fin: Number(t.finishes) || 0,
    pts: Number(t.points) || 0,
    fpNum: null,
    statusText: null,
    showAliveDots: showDots,
    aliveFilled: aliveDotsFilled(t),
    elimLabel: eliminationStatus(t),
  });

  const fromGold = (t, displayIdx) => ({
    mode: "gold4",
    key: String(t.id ?? `g-${displayIdx}-${t.team}`),
    idx: displayIdx,
    empty: false,
    team: resolveTeamTitle(t),
    logo: resolveLogoSrc(t.logo),
    initials: resolveTeamTitle(t).slice(0, 2).toUpperCase(),
    fin: null,
    pts: null,
    fpNum: fpValue(t, fpMetric),
    statusText: goldStatus(slotId, t, topFourKeys),
    showAliveDots: false,
    aliveFilled: 0,
    elimLabel: eliminationStatus(t),
  });

  const emptyPadLive = (i, slotForDots) => ({
    mode: "live5",
    key: `empty-l-${i}`,
    idx: i,
    empty: true,
    team: "",
    logo: null,
    initials: "",
    fin: "",
    pts: "",
    fpNum: null,
    statusText: null,
    showAliveDots: slotForDots,
    aliveFilled: 0,
    elimLabel: "",
  });

  const emptyPadGold = (i) => ({
    mode: "gold4",
    key: `empty-g-${i}`,
    idx: i,
    empty: true,
    team: "",
    logo: null,
    initials: "",
    fin: "",
    pts: "",
    fpNum: "",
    statusText: "",
    showAliveDots: false,
    aliveFilled: 0,
    elimLabel: "",
  });

  if (columnMode === "gold4") {
    if (slotId === "live-ranking") {
      const sorted = buildLiveRankingOrder(teams);
      return sorted.slice(0, cap).map((t, i) => fromGold(t, i + 1));
    }
    if (slotId === "top-four") {
      const ordered = buildLiveRankingOrder(teams);
      const sorted = ordered
        .filter((t) => {
          const s = String(t.status || "alive").toLowerCase();
          return s === "alive" || s === "rondo_benched";
        })
        .slice(0, 4);
      const out = sorted.map((t, i) => fromGold(t, i + 1));
      while (out.length < 4) out.push(emptyPadGold(out.length + 1));
      return out.slice(0, Math.min(cap, out.length || 4));
    }
    if (slotId === "eliminations") {
      const eliminated = [...teams].filter((t) => String(t.status || "").toLowerCase() === "eliminated");
      eliminated.sort((a, b) => (Number(b.eliminationRank) || 0) - (Number(a.eliminationRank) || 0));
      return eliminated.slice(0, cap).map((t, i) => fromGold(t, i + 1));
    }
    return [];
  }

  /** live5 */
  if (slotId === "live-ranking") {
    const sorted = buildLiveRankingOrder(teams);
    return sorted.slice(0, cap).map((t, i) => fromLive(t, i + 1, true));
  }
  if (slotId === "top-four") {
    const ordered = buildLiveRankingOrder(teams);
    const sorted = ordered
      .filter((t) => {
        const s = String(t.status || "alive").toLowerCase();
        return s === "alive" || s === "rondo_benched";
      })
      .slice(0, 4);
    const out = sorted.map((t, i) => fromLive(t, i + 1, true));
    while (out.length < 4) out.push(emptyPadLive(out.length + 1, true));
    return out.slice(0, Math.min(cap, out.length || 4));
  }
  if (slotId === "eliminations") {
    const eliminated = [...teams].filter((t) => String(t.status || "").toLowerCase() === "eliminated");
    eliminated.sort((a, b) => (Number(b.eliminationRank) || 0) - (Number(a.eliminationRank) || 0));
    return eliminated.slice(0, cap).map((t, i) => fromLive(t, i + 1, false));
  }

  return [];
}

const ROW_BASE_GOLD = {
  fontFamily: `"Segoe UI", system-ui, -apple-system, sans-serif`,
  fontWeight: 700,
  letterSpacing: "0.02em",
  textShadow:
    "0 0 1px rgba(255,248,232,0.9), -1px -1px 0 rgba(212,167,76,0.42), 1px 1px 0 rgba(255,218,143,0.32), 0 1px 2px rgba(0,0,0,0.65)",
};
const ROW_BASE_GOLDOFF = {
  fontFamily: `"Segoe UI", system-ui, -apple-system, sans-serif`,
  fontWeight: 700,
  letterSpacing: "0.015em",
  textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.5)",
};

function ThemeColors(theme) {
  if (theme === "dark") {
    return {
      rank: "#f8fafc",
      rankFontStyle: "italic",
      team: "#f8fafc",
      fin: "#7dd3fc",
      pts: "#f1f5f9",
      status: "#fecaca",
      rowBase: ROW_BASE_GOLDOFF,
      logoBg: "rgba(180,140,48,0.35)",
      logoText: "#facc15",
      dotAlive: "#ef4444",
      dotDead: "rgba(60,52,52,0.65)",
      borderDot: "1px solid rgba(0,0,0,0.35)",
    };
  }
  return {
    rank: "#1a1510",
    rankFontStyle: "normal",
    team: "#1a1510",
    fin: "#0c4a6e",
    pts: "#0f172a",
    status: "#5c3410",
    rowBase: ROW_BASE_GOLD,
    logoBg: "rgba(60,52,38,0.55)",
    logoText: "#fde68a",
    dotAlive: "#b45309",
    dotDead: "rgba(60,52,42,0.45)",
    borderDot: "1px solid rgba(80,64,44,0.5)",
  };
}

function AliveDots({ filled, themeColors, cellSizePx }) {
  const n = Math.max(0, Math.min(4, filled || 0));
  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center", flexWrap: "nowrap" }}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            width: cellSizePx,
            height: cellSizePx,
            maxWidth: "22%",
            borderRadius: "50%",
            boxSizing: "border-box",
            background: i < n ? themeColors.dotAlive : themeColors.dotDead,
            border: themeColors.borderDot,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

function coerceColumns(v) {
  return v === "gold4" ? "gold4" : "live5";
}

function coerceFp(v) {
  return v === "finishes" ? "finishes" : "points";
}

export default function ObsSharedTripleSlotOverlay() {
  const { slotId } = useParams();
  const { search } = useLocation();
  const label = Object.prototype.hasOwnProperty.call(SLOT_LABEL, slotId) ? SLOT_LABEL[slotId] : null;
  const unknownSlot = slotId && !label;
  const [relPath, setRelPath] = useState(() => null);
  const [teams, setTeams] = useState([]);
  const [tripleColumns, setTripleColumns] = useState("live5");
  const [tripleFpMetric, setTripleFpMetric] = useState("points");

  const layoutPx = useMemo(() => readLayout(search), [search]);
  const columnMode = useMemo(
    () => layoutPx.colsQS ?? coerceColumns(tripleColumns),
    [layoutPx.colsQS, tripleColumns],
  );
  const fpMetric = useMemo(() => layoutPx.fpQS ?? coerceFp(tripleFpMetric), [layoutPx.fpQS, tripleFpMetric]);

  const rankStyleEff = useMemo(() => {
    if (layoutPx.rankExplicit) return layoutPx.rankStyle;
    return columnMode === "gold4" ? "pad" : "hash";
  }, [layoutPx.rankExplicit, layoutPx.rankStyle, columnMode]);

  const themeColors = useMemo(() => ThemeColors(layoutPx.theme), [layoutPx.theme]);
  const teamsFromSocketRef = useRef(false);

  useEffect(() => {
    const onSettings = (d) => {
      if (!d || typeof d !== "object") return;
      if (Object.prototype.hasOwnProperty.call(d, "obsSharedTriplePng")) {
        setRelPath(d.obsSharedTriplePng ? String(d.obsSharedTriplePng) : null);
      }
      if (Object.prototype.hasOwnProperty.call(d, "obsSharedTripleColumns")) {
        setTripleColumns(coerceColumns(d.obsSharedTripleColumns));
      }
      if (Object.prototype.hasOwnProperty.call(d, "obsTripleFpMetric")) {
        setTripleFpMetric(coerceFp(d.obsTripleFpMetric));
      }
    };
    socket.on("settingsUpdated", onSettings);
    socket.emit("requestSettings");
    return () => socket.off("settingsUpdated", onSettings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/settings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || typeof d !== "object") return;
        if (d.obsSharedTriplePng) setRelPath(String(d.obsSharedTriplePng));
        setTripleColumns(coerceColumns(d.obsSharedTripleColumns));
        setTripleFpMetric(coerceFp(d.obsTripleFpMetric));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onTeams(data) {
      teamsFromSocketRef.current = true;
      setTeams(Array.isArray(data) ? data : []);
    }
    function requestTeams() {
      socket.emit("requestTeams");
    }
    socket.on("teamsUpdated", onTeams);
    socket.on("connect", requestTeams);
    if (socket.connected) requestTeams();
    return () => {
      socket.off("teamsUpdated", onTeams);
      socket.off("connect", requestTeams);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API}/teams`);
        const text = await r.text();
        if (cancelled) return;
        if (!r.ok) return;
        let d;
        try {
          d = JSON.parse(text);
        } catch {
          return;
        }
        if (!Array.isArray(d)) return;
        if (!teamsFromSocketRef.current) setTeams(d);
      } catch {
        /* offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.background = "transparent";
    return () => {
      document.body.style.margin = "";
      document.body.style.background = "";
    };
  }, []);

  const src =
    relPath &&
    typeof relPath === "string" &&
    relPath.startsWith("/uploads/obs-shared-triple/") &&
    !relPath.includes("..")
      ? `${API}${relPath}`
      : "";

  useEffect(() => {
    document.title = label ? `OBS · ${label}` : "OBS · shared PNG slot";
  }, [label]);

  const topFourKeys = useMemo(() => topFourAliveKeys(teams), [teams]);

  const rows = useMemo(
    () =>
      label && slotId && !unknownSlot
        ? buildRows(slotId, teams, layoutPx.rowCap, columnMode, fpMetric, topFourKeys)
        : [],
    [label, slotId, unknownSlot, teams, layoutPx.rowCap, columnMode, fpMetric, topFourKeys],
  );

  const dotPx = useMemo(() => {
    const n = rows.length || 1;
    return Math.max(5, Math.min(11, 220 / n));
  }, [rows.length]);

  const gridTplLive =
    "minmax(3rem,.48fr) minmax(112px,2.72fr) minmax(3.25rem,.5fr) minmax(3.5rem,.53fr) minmax(4.85rem,.85fr)";
  const gridTplGold =
    "minmax(2.65rem,.4fr) minmax(116px,2.65fr) minmax(3.15rem,.45fr) minmax(5.2rem,.95fr)";

  return (
    <div
      data-obs-shared-triple-slot={slotId || ""}
      data-obs-columns={columnMode}
      style={{
        margin: 0,
        padding: 0,
        width: "100vw",
        height: "100vh",
        background: src ? "transparent" : "rgba(8,10,14,0.55)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {unknownSlot ? (
        <span style={{ opacity: 0.35, fontSize: 13, fontFamily: "system-ui,sans-serif", color: "#bef264" }}>
          Unknown slot &quot;{slotId}&quot;. Allowed: eliminations, top-four, live-ranking.
        </span>
      ) : null}

      {!unknownSlot && label ? (
        <>
          {src ? (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                margin: 0,
                padding: 0,
                border: "none",
                outline: "none",
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center center",
                position: "absolute",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
          ) : (
            <span
              style={{
                position: "absolute",
                bottom: 12,
                left: 12,
                opacity: 0.55,
                fontSize: 12,
                fontFamily: "system-ui,sans-serif",
                color: "#e2e8f0",
                zIndex: 0,
              }}
            >
              No PNG backdrop — Live data only · Assign art in Admin → OBS PNG triple slot
            </span>
          )}

          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: `${layoutPx.topPct}%`,
                left: `${layoutPx.leftPct}%`,
                width: `${layoutPx.widthPct}%`,
                height: `${layoutPx.heightPct}%`,
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
                outline: layoutPx.debug ? "2px dashed rgba(255,0,220,0.85)" : "none",
              }}
            >
              {rows.map((row) =>
                row.mode === "gold4" ? (
                  <div
                    key={row.key}
                    style={{
                      flex: 1,
                      display: "grid",
                      gridTemplateColumns: gridTplGold,
                      alignItems: "center",
                      columnGap: "0.4rem",
                      minHeight: 0,
                      ...themeColors.rowBase,
                      fontSize: "clamp(8.5px, min(2vw, 2vh), 17px)",
                      opacity: row.empty ? 0 : 1,
                    }}
                  >
                    <div style={{ textAlign: "center", color: themeColors.rank, fontStyle: themeColors.rankFontStyle }}>
                      {!row.empty ? formatRank(row.idx, rankStyleEff) : ""}
                    </div>
                    <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: "0.42rem" }}>
                      {!row.empty ? (
                        <>
                          <div
                            style={{
                              width: "clamp(22px, 3.25vh, 34px)",
                              height: "clamp(22px, 3.25vh, 34px)",
                              borderRadius: 6,
                              flexShrink: 0,
                              overflow: "hidden",
                              background: themeColors.logoBg,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "clamp(7px, 1.05vh, 11px)",
                              color: themeColors.logoText,
                              fontWeight: 800,
                              border:
                                layoutPx.theme === "dark"
                                  ? "1px solid rgba(250,204,21,.25)"
                                  : "1px solid rgba(60,52,42,0.4)",
                            }}
                          >
                            {row.logo ? (
                              <img
                                src={row.logo}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                draggable={false}
                              />
                            ) : (
                              row.initials
                            )}
                          </div>
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              textAlign: "left",
                              minWidth: 0,
                              color: themeColors.team,
                            }}
                          >
                            {row.team}
                          </div>
                        </>
                      ) : null}
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                        color: themeColors.fin,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.fpNum === "" ? "" : row.fpNum}
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        color: themeColors.status,
                        fontSize: "clamp(7.5px, min(1.75vw, 1.72vh), 15px)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {!row.empty ? row.statusText : ""}
                    </div>
                  </div>
                ) : (
                  <div
                    key={row.key}
                    style={{
                      flex: 1,
                      display: "grid",
                      gridTemplateColumns: gridTplLive,
                      alignItems: "center",
                      columnGap: "0.35rem",
                      minHeight: 0,
                      ...themeColors.rowBase,
                      fontSize: "clamp(8.5px, min(2vw, 2vh), 17px)",
                      opacity: row.empty ? 0 : 1,
                    }}
                  >
                    <div
                      style={{
                        textAlign: "center",
                        color: themeColors.rank,
                        fontStyle: themeColors.rankFontStyle,
                      }}
                    >
                      {!row.empty ? formatRank(row.idx, rankStyleEff) : ""}
                    </div>
                    <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: "0.42rem" }}>
                      {!row.empty ? (
                        <>
                          <div
                            style={{
                              width: "clamp(22px, 3.25vh, 34px)",
                              height: "clamp(22px, 3.25vh, 34px)",
                              borderRadius: 6,
                              flexShrink: 0,
                              overflow: "hidden",
                              background: themeColors.logoBg,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "clamp(7px, 1.05vh, 11px)",
                              color: themeColors.logoText,
                              fontWeight: 800,
                              border:
                                layoutPx.theme === "dark"
                                  ? "1px solid rgba(250,204,21,.25)"
                                  : "1px solid rgba(60,52,42,0.4)",
                            }}
                          >
                            {row.logo ? (
                              <img
                                src={row.logo}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                draggable={false}
                              />
                            ) : (
                              row.initials
                            )}
                          </div>
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              textAlign: "left",
                              minWidth: 0,
                              color: themeColors.team,
                            }}
                          >
                            {row.team}
                          </div>
                        </>
                      ) : null}
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                        color: themeColors.fin,
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                    >
                      {row.fin === "" ? "" : row.fin}
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                        color: themeColors.pts,
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                    >
                      {row.pts === "" ? "" : row.pts}
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        minWidth: 0,
                        color: themeColors.status,
                        fontSize: "clamp(7.5px, min(1.75vw, 1.7vh), 15px)",
                      }}
                    >
                      {row.showAliveDots ? (
                        <AliveDots filled={row.aliveFilled} themeColors={themeColors} cellSizePx={dotPx} />
                      ) : (
                        row.elimLabel ?? ""
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </>
      ) : null}

      {!unknownSlot && !label ? (
        <span style={{ opacity: 0.28, fontSize: 13, fontFamily: "system-ui,sans-serif", color: "#e2e8f0" }}>
          Invalid OBS slot route
        </span>
      ) : null}
    </div>
  );
}
