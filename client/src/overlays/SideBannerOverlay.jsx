import { useEffect, useMemo, useState } from "react";
import socket, { API, apiUrl } from "./socket";
import { normalizeMatchMeta } from "../normalizeMatchMeta";
import { SIDE_OVERLAY_DEFAULT_PREFS, mergeSideOverlayPrefs } from "../sideOverlayPrefs";

const BGMI_MAP_LABEL = {
  erangel: "ERANGEL",
  miramar: "MIRAMAR",
  rondo: "RONDO",
};

function resolveMapDisplay(useLive, manual, metaMap) {
  if (!useLive && typeof manual === "string" && manual.trim()) return manual.trim().toUpperCase().slice(0, 36);
  const k = String(metaMap || "erangel").toLowerCase();
  return BGMI_MAP_LABEL[k] || "ERANGEL";
}

function tournamentLogoHref(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;
  const s = pathOrUrl.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const base = s.startsWith("/") ? s : `/${s}`;
  return `${API}${base}`;
}

/**
 * Transparent OBS/browser source — broadcast-style match strip (logo + meta + map).
 * Colors/text from Admin · Side banner prefs; tournament logo shared with WWCD.
 */
export default function SideBannerOverlay() {
  const [prefs, setPrefs] = useState(() => ({ ...SIDE_OVERLAY_DEFAULT_PREFS }));
  const [tournamentLogo, setTournamentLogo] = useState(null);
  const [logoBust, setLogoBust] = useState(0);
  const [matchMeta, setMatchMeta] = useState(() => ({
    number: 1,
    map: "erangel",
    status: "live",
    startedAt: Date.now(),
    matchLabel: "",
  }));

  useEffect(() => {
    const isPlainSidePrefs = (p) => p != null && typeof p === "object" && !Array.isArray(p);

    const applySettings = (s) => {
      if (!s || typeof s !== "object") return;
      if (Object.prototype.hasOwnProperty.call(s, "tournamentLogo")) {
        setTournamentLogo(s.tournamentLogo || null);
      }
      if (isPlainSidePrefs(s.sideOverlayPrefs)) {
        setPrefs(mergeSideOverlayPrefs(s.sideOverlayPrefs));
      }
    };

    /** Socket may emit `settingsUpdated` on connect before this handler is registered — always pull HTTP too. */
    const pullHttp = () =>
      fetch(apiUrl("/settings"), { cache: "no-store" })
        .then((r) => {
          if (!r.ok) return Promise.reject(new Error(String(r.status)));
          return r.json();
        })
        .then((payload) => applySettings(payload))
        .catch(() => {});

    const onConnect = () => {
      socket.emit("requestSettings");
      pullHttp();
    };

    socket.on("settingsUpdated", applySettings);
    socket.on("connect", onConnect);
    socket.emit("requestSettings");
    pullHttp();
    if (socket.connected) pullHttp();

    const onVis = () => {
      if (!document.hidden) {
        socket.emit("requestSettings");
        pullHttp();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      socket.off("settingsUpdated", applySettings);
      socket.off("connect", onConnect);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    setLogoBust(Date.now());
  }, [tournamentLogo]);

  useEffect(() => {
    const onMatch = (m) => {
      const meta = normalizeMatchMeta(m);
      if (!meta) return;
      setMatchMeta(meta);
    };
    socket.on("matchUpdated", onMatch);
    socket.emit("requestMatch");
    return () => socket.off("matchUpdated", onMatch);
  }, []);

  const topLine = useMemo(() => {
    const g = prefs.groupLabel?.trim() || "GROUP";
    const n = prefs.useLiveMatchNumber ? Number(matchMeta.number) || 1 : Math.max(1, Number(prefs.matchNumberManual) || 1);
    let line = `${g} · MATCH ${n}`;
    if (prefs.mapOrdinal != null && Number(prefs.mapOrdinal) >= 1) {
      line += ` · MAP ${Math.min(999, Math.trunc(Number(prefs.mapOrdinal)))}`;
    }
    return line.toUpperCase();
  }, [prefs.groupLabel, prefs.useLiveMatchNumber, prefs.matchNumberManual, prefs.mapOrdinal, matchMeta.number]);

  const mapDisplay = resolveMapDisplay(prefs.useLiveMapName, prefs.mapNameManual, matchMeta.map);
  const scale = Math.max(0.5, Math.min(1.5, Number(prefs.bannerScale) || 1));
  const logoSrc = tournamentLogoHref(tournamentLogo);
  const url = logoSrc ? `${logoSrc}${logoSrc.includes("?") ? "&" : "?"}v=${logoBust}` : null;

  const accent = prefs.sparkleColor;

  const metaGrad = [
    `linear-gradient(185deg, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 42%)`,
    `linear-gradient(180deg, ${prefs.topBarBg} 0%, ${prefs.topBarBg} 100%)`,
  ].join(", ");

  const mapLayers = [
    `linear-gradient(158deg, ${prefs.mapAreaBgStart} 0%, ${prefs.mapAreaBgEnd} 62%, rgba(0,0,0,.65) 100%)`,
    "radial-gradient(ellipse 130% 55% at 50% -15%, rgba(255,255,255,.075) 0%, transparent 48%)",
    "radial-gradient(ellipse 90% 100% at 100% 105%, rgba(0,0,0,.44) 0%, transparent 44%)",
    "radial-gradient(ellipse 70% 90% at 0% 100%, rgba(0,0,0,.3) 0%, transparent 38%)",
  ].join(", ");

  return (
    <div className="side-banner-root">
      <div className="side-banner-shell" style={{ transform: `scale(${scale})`, "--accent": accent }}>
        {/* Logo cell */}
        <div
          className="side-banner-logo-cell"
          style={{
            backgroundColor: prefs.logoPanelBg,
            backgroundImage: [
              `radial-gradient(ellipse 125% 85% at 50% -6%, rgba(255,255,255,.42) 0%, transparent 50%)`,
              `linear-gradient(168deg, rgba(255,255,255,.12) 0%, transparent 48%)`,
              `linear-gradient(180deg, rgba(0,0,0,.07) 0%, transparent 32%, rgba(0,0,0,.17) 100%)`,
            ].join(", "),
          }}
        >
          <div aria-hidden className="side-banner-logo-accent" style={{ background: `linear-gradient(90deg, ${accent}47 0%, transparent 62%)` }} />
          {url ? (
            <img className="side-banner-logo-img" src={url} alt="" />
          ) : (
            <span className="side-banner-logo-ph">
              UPLOAD LOGO
              <br />
              IN ADMIN
            </span>
          )}
        </div>

        {/* Bezel rail */}
        <div aria-hidden className="side-banner-rail" />

        {/* Info column */}
        <div className="side-banner-info">
          <div className="side-banner-meta" style={{ backgroundImage: metaGrad, color: prefs.topBarText }}>
            <span className="side-banner-meta-txt">{topLine}</span>
            <div aria-hidden className="side-banner-meta-gap" style={{ background: `${prefs.topBarText}29` }} />
            {prefs.showSparkle !== false ? (
              <svg className="side-banner-star" width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                <path fill={accent} d="M12 2 13.1 11.1 22 12l-8.9.9L12 22l-.9-8.9L2 12l8.9-1.1L12 2z" />
              </svg>
            ) : (
              <div style={{ width: 24, flexShrink: 0 }} />
            )}
          </div>

          <div className="side-banner-map">
            <div aria-hidden className="side-banner-map-bg" style={{ backgroundImage: mapLayers }} />
            <div aria-hidden className="side-banner-map-veil" />
            <span className="side-banner-map-txt" style={{ color: prefs.mapNameColor }}>
              {/* border color via accent in style below */}
              {mapDisplay}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&display=swap");

        .side-banner-root *,
        .side-banner-root *::before,
        .side-banner-root *::after {
          box-sizing: border-box;
        }
        .side-banner-root {
          width: 100vw;
          min-height: 100vh;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 3vh;
          background: transparent;
          pointer-events: none;
          margin: 0;
          font-family: "Barlow Condensed", "Bahnschrift Condensed", "Segoe UI", system-ui, sans-serif;
        }
        html, body {
          overflow: hidden;
          margin: 0;
          background: transparent !important;
        }

        .side-banner-shell {
          display: flex;
          flex-direction: row;
          width: min(900px, 86vw);
          transform-origin: top center;
          border-radius: 16px;
          overflow: hidden;
          outline: 1px solid rgba(255,255,255,.085);
          box-shadow:
            0 0 0 1px rgba(0,0,0,.5),
            inset 0 1px 1px rgba(255,255,255,.06),
            0 5px 12px rgba(0,0,0,.35),
            0 26px 56px rgba(0,0,0,.5);
          background: linear-gradient(146deg, rgba(255,255,255,.05) 0%, rgba(255,255,255,0) 52%);
        }

        .side-banner-logo-cell {
          position: relative;
          flex: 0 0 clamp(150px, 27vw, 198px);
          min-height: 132px;
          display: grid;
          place-items: center;
          padding: 16px;
          box-shadow: inset -1px 0 0 rgba(0,0,0,.14), inset -8px 0 24px rgba(0,0,0,.04);
        }
        .side-banner-logo-accent {
          position: absolute;
          inset: 0;
          opacity: 0.18;
          pointer-events: none;
        }
        .side-banner-logo-img {
          position: relative;
          max-width: 90%;
          max-height: 108px;
          width: auto;
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 12px 18px rgba(0,0,0,.42));
        }
        .side-banner-logo-ph {
          position: relative;
          font-weight: 800;
          font-size: clamp(9px, 1.65vw, 11px);
          letter-spacing: 0.32em;
          line-height: 1.48;
          text-align: center;
          color: rgba(0,0,0,.38);
          text-transform: uppercase;
        }

        .side-banner-rail {
          flex-shrink: 0;
          width: 5px;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.08),
            inset -1px 0 10px rgba(0,0,0,.42);
          background: linear-gradient(
            180deg,
            var(--accent, #e63946) 0%,
            rgba(255,255,255,.28) 18%,
            rgba(255,255,255,.07) 50%,
            rgba(0,0,0,.32) 100%
          );
        }

        .side-banner-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: #060a11;
          background-image: radial-gradient(circle at 15% -10%, rgba(255,255,255,.035) 0%, transparent 40%);
        }

        .side-banner-meta {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 12px;
          min-height: 48px;
          padding: 12px 20px;
          padding-left: 18px;
          border-bottom: 1px solid rgba(0,0,0,.16);
          box-shadow:
            inset 0 -2px 0 rgba(255,255,255,.05),
            inset 0 -1px 0 rgba(0,0,0,.06);
          font-variant-numeric: tabular-nums;
        }
        .side-banner-meta-txt {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 800;
          font-size: clamp(13px, 2vw, 17px);
          letter-spacing: 0.12em;
          line-height: 1.05;
          opacity: 0.94;
          text-rendering: geometricPrecision;
        }
        .side-banner-meta-gap {
          width: 1px;
          height: 20px;
          flex-shrink: 0;
          opacity: 0.95;
          border-radius: 1px;
        }
        .side-banner-star {
          flex-shrink: 0;
          filter:
            drop-shadow(0 0 8px rgba(255,255,255,.06))
            drop-shadow(0 1px 2px rgba(0,0,0,.55))
            brightness(1.05);
          opacity: 0.93;
        }

        .side-banner-map {
          position: relative;
          flex: 1;
          min-height: 104px;
          display: grid;
          place-items: center;
          padding: 20px;
          overflow: hidden;
          box-shadow: inset 0 3px 10px rgba(0,0,0,.38);
        }
        .side-banner-map-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .side-banner-map-veil {
          position: absolute;
          inset: 0;
          opacity: 0.36;
          pointer-events: none;
          background-image:
            repeating-linear-gradient(-30deg,
              rgba(255,255,255,.036) 0,
              rgba(255,255,255,.036) 1px,
              transparent 1px,
              transparent 19px
            ),
            linear-gradient(
              90deg,
              transparent 46.5%,
              rgba(255,255,255,.03) 50%,
              transparent 53.5%
            );
        }

        .side-banner-map-txt {
          position: relative;
          font-weight: 900;
          font-size: clamp(30px, 5.75vw, 56px);
          line-height: 1;
          letter-spacing: 0.16em;
          padding-bottom: 0.06em;
          border-bottom-style: solid;
          border-bottom-width: 3px;
          text-shadow:
            0 1px 1px rgba(0,0,0,.72),
            0 8px 24px rgba(0,0,0,.5),
            0 2px 2px rgba(0,0,0,.82);
          text-transform: uppercase;
        }
      `}</style>

      <style>{`
        .side-banner-shell .side-banner-map-txt {
          border-bottom-color: ${accent}c9;
        }
      `}</style>
    </div>
  );
}
