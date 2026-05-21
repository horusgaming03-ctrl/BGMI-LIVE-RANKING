import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { connectSocket, getApiBase } from "../apiOrigin";
import { getTheme, getThemeNames } from "./themes";
import { mergeThemeOverride } from "./utils/mergeThemeOverride";
import { normalizeMatchMeta } from "../normalizeMatchMeta";
import { buildLiveRankingOrder } from "../teamDisplayOrder";

const API = getApiBase();
const sock = connectSocket();

/** Character portrait: equal width × height (square) inside each card. */
const CHAR_BOX = 200;

function normalizeWwcdArts(arr) {
  const src = Array.isArray(arr) ? arr : [];
  return [0, 1, 2, 3].map((i) => (typeof src[i] === "string" && src[i].trim() ? src[i].trim() : null));
}

function padSquadNames(playerList, teamName) {
  const arr = Array.isArray(playerList) ? playerList.filter(Boolean).map((s) => String(s).trim()) : [];
  const t = String(teamName || "TEAM").toUpperCase();
  for (let i = arr.length; i < 4; i++) arr.push(`${t} · P${i + 1}`);
  return arr.slice(0, 4).map((s) => s.toUpperCase());
}

function splitFinishesAcrossSquad(total) {
  const t = Math.max(0, Number(total) || 0);
  const base = Math.floor(t / 4);
  let r = t % 4;
  return [0, 1, 2, 3].map((i) => base + (i < r ? 1 : 0));
}

function buildPayloadFromTeam(team, matchNum) {
  const names = padSquadNames(team.players, team.team);
  const finishes = splitFinishesAcrossSquad(team.finishes);
  return {
    team: team.team,
    logo: team.logo,
    id: team.id,
    matchNumber: matchNum,
    teamFinishes: team.finishes || 0,
    players: names.map((name, i) => ({
      name,
      finishes: finishes[i],
    })),
  };
}

/** Bumped when replacing `public/wwcd/char-*.png` so browsers reload assets. */
const WWCD_CHAR_VER = "5";

function characterArtUrl(idx) {
  const base = import.meta.env.BASE_URL || "/";
  const path = `${base}${base.endsWith("/") ? "" : "/"}wwcd/char-${idx % 4}.png?v=${WWCD_CHAR_VER}`;
  if (typeof window !== "undefined") {
    const u = new URL(path, window.location.origin);
    return u.href;
  }
  return path;
}

function tournamentLogoSrc(pathOrUrl, cacheBust) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const u = new URL(pathOrUrl);
    u.searchParams.set("v", String(cacheBust));
    return u.href;
  }
  const base = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${API}${base}?v=${cacheBust}`;
}

function resolveCharacterArtSrc(custom, idx, cacheBust) {
  if (custom && typeof custom === "string") {
    const t = custom.trim();
    if (!t) return characterArtUrl(idx);
    if (/^https?:\/\//i.test(t)) {
      try {
        const u = new URL(t);
        u.searchParams.set("v", String(cacheBust));
        return u.href;
      } catch {
        return t;
      }
    }
    if (t.startsWith("/")) return `${API}${t}?v=${cacheBust}`;
  }
  return characterArtUrl(idx);
}

function WWCDTeamStatsBoard({
  payload,
  theme,
  tournamentLogoPath,
  logoCacheBust,
  boardKey,
  characterArts,
  charArtCacheBust,
}) {
  const gold = theme?.colors?.gold || "#F5C542";
  const primary = theme?.colors?.primary || "#7c3aed";
  const secondary = typeof theme?.colors?.secondary === "string" ? theme.colors.secondary : "#12081f";
  const text = theme?.colors?.text || "#ffffff";
  const boardBg =
    theme?.gradients?.wwcd && typeof theme.gradients.wwcd === "string"
      ? theme.gradients.wwcd
      : `linear-gradient(145deg, ${secondary} 0%, #1e1035 45%, ${primary}33 72%, ${secondary} 100%)`;
  const arts = normalizeWwcdArts(characterArts);

  const cardBgFinal =
    typeof primary === "string" && primary.startsWith("#")
      ? `linear-gradient(180deg, ${primary}66 0%, rgba(26,13,46,.95) 100%)`
      : "linear-gradient(180deg, #2a1848 0%, #1a0d2e 100%)";

  const players = payload.players || [];
  const logoSrc = tournamentLogoSrc(tournamentLogoPath, logoCacheBust);

  const nameBarBg =
    typeof theme?.colors?.textMuted === "string"
      ? `linear-gradient(180deg, rgba(255,255,255,.82) 0%, rgba(200,200,210,.75) 100%)`
      : "linear-gradient(180deg, #e8e4ef 0%, #c8c2d4 100%)";

  const charStageTint =
    typeof primary === "string" && primary.startsWith("#")
      ? `linear-gradient(180deg, #e8e4ef 0%, #c8c2d4 100%), linear-gradient(180deg, ${primary}22 0%, transparent 55%)`
      : "linear-gradient(180deg, #e8e4ef 0%, #c8c2d4 100%)";

  return (
    <div
      key={boardKey}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        fontFamily: theme?.typography?.fontFamily || "'Segoe UI', 'Inter', system-ui, sans-serif",
        background: boardBg,
        overflow: "hidden",
        animation: "wwcd-board-fade 0.5s ease-out",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.12,
          backgroundImage: `
            linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
          backgroundPosition: "0 100%",
          backgroundRepeat: "repeat",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: -40,
          left: -80,
          width: "55%",
          height: 56,
          background: `repeating-linear-gradient(
            -35deg,
            ${gold} 0px,
            ${gold} 18px,
            #111 18px,
            #111 36px
          )`,
          transform: "rotate(-12deg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 24px rgba(0,0,0,.5)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 3,
            color: "#111",
            whiteSpace: "nowrap",
          }}
        >
          BREAKBOUND &nbsp; BREAKBOUND &nbsp; BREAKBOUND
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 16,
          right: 20,
          left: "auto",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 14,
          flexWrap: "wrap",
          maxWidth: "min(480px, 45vw)",
          zIndex: 20,
        }}
      >
        {logoSrc ? (
          <img
            src={logoSrc}
            alt=""
            style={{
              maxHeight: 64,
              maxWidth: 220,
              width: "auto",
              height: "auto",
              objectFit: "contain",
              flexShrink: 0,
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,.5))",
            }}
          />
        ) : null}
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 3,
            color: gold,
            opacity: 0.95,
            padding: "6px 12px",
            border: `1px solid ${gold}55`,
            borderRadius: 4,
            flexShrink: 0,
            whiteSpace: "nowrap",
            background: primary && String(primary).startsWith("#") ? `${primary}28` : "transparent",
            boxShadow: `0 0 24px ${primary}44`,
          }}
        >
          LIVE
        </div>
      </div>

      <div style={{ padding: "72px 48px 24px", textAlign: "center" }}>
        <h1
          style={{
            margin: 0,
            fontSize: 42,
            fontWeight: 900,
            color: text,
            letterSpacing: 2,
            textTransform: "uppercase",
            textShadow: `0 0 40px ${primary}99`,
          }}
        >
          WWCD TEAM STATS
        </h1>
        <div
          style={{
            marginTop: 8,
            fontSize: 18,
            fontWeight: 700,
            color: gold,
            letterSpacing: 6,
          }}
        >
          MATCH {payload.matchNumber ?? 1}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 18,
          padding: "12px 40px 100px",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {players.map((p, idx) => (
          <div
            key={`${p.name}-${idx}-${boardKey}`}
            style={{
              flex: 1,
              minWidth: 0,
              maxWidth: 280,
              borderRadius: 4,
              overflow: "hidden",
              boxShadow: `0 12px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08)`,
              animation: `wwcd-card-up 0.55s ease-out ${idx * 0.1}s both`,
            }}
          >
            <div
              style={{
                minHeight: CHAR_BOX,
                height: CHAR_BOX,
                background: charStageTint,
                backgroundBlendMode: "normal",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                padding: "0 12px",
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 8%)",
              }}
            >
              <div
                style={{
                  width: CHAR_BOX,
                  height: CHAR_BOX,
                  minWidth: CHAR_BOX,
                  minHeight: CHAR_BOX,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <img
                  src={resolveCharacterArtSrc(arts[idx], idx, charArtCacheBust)}
                  alt=""
                  width={CHAR_BOX}
                  height={CHAR_BOX}
                  style={{
                    width: CHAR_BOX,
                    height: CHAR_BOX,
                    maxWidth: CHAR_BOX,
                    maxHeight: CHAR_BOX,
                    objectFit: "contain",
                    objectPosition: "bottom center",
                    display: "block",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                background: nameBarBg,
                padding: "12px 10px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#111",
                  letterSpacing: 0.5,
                  lineHeight: 1.2,
                  wordBreak: "break-word",
                }}
              >
                {p.name}
              </div>
            </div>
            <div
              style={{
                background: cardBgFinal,
                padding: "14px 12px 16px",
                borderTop: `1px solid ${primary}33`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.75)" }}>FINISHES</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: text }}>{p.finishes}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: 48,
          right: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 36,
            fontWeight: 900,
            color: gold,
            letterSpacing: 2,
            textTransform: "uppercase",
            textShadow: `0 0 28px ${primary}88`,
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: "0.35em",
          }}
        >
          <span style={{ fontWeight: 800 }}>TEAM</span>
          <span>{payload.team}</span>
        </h2>
        {payload.logo && (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 8,
              overflow: "hidden",
              border: `2px solid ${gold}66`,
              background: "#fff",
            }}
          >
            <img src={`${API}${payload.logo}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes wwcd-board-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes wwcd-card-up {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function normalizeChickenPayload(data, teamsList, matchMeta) {
  if (data && Array.isArray(data.players) && data.players.length === 4) return data;
  const team =
    (data?.id && teamsList.find((t) => t.id === data.id)) ||
    teamsList.find((t) => t.team === data?.team) ||
    null;
  if (team) return buildPayloadFromTeam(team, matchMeta.number);
  return buildPayloadFromTeam(
    { team: data?.team || "CHAMPION", logo: data?.logo, finishes: 0, players: [], id: data?.id },
    matchMeta.number
  );
}

function WwcdEditToolbar({ characterArts, onRefresh }) {
  const [slot, setSlot] = useState(0);
  const [urlDraft, setUrlDraft] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    const a = normalizeWwcdArts(characterArts)[slot];
    setUrlDraft(a && /^https?:\/\//i.test(a) ? a : "");
  }, [characterArts, slot]);

  const applyUrl = async () => {
    const res = await fetch(`${API}/overlay/wwcd-characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, imageUrl: urlDraft.trim() || null }),
    });
    if (res.ok) onRefresh?.();
  };

  const clearSlot = async () => {
    const res = await fetch(`${API}/overlay/wwcd-characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, imageUrl: null }),
    });
    if (res.ok) {
      setUrlDraft("");
      onRefresh?.();
    }
  };

  const onPickFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch(`${API}/upload/wwcd-character/${slot}`, { method: "POST", body: fd });
    if (res.ok) onRefresh?.();
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100000,
        background: "rgba(0,0,0,.88)",
        borderTop: "1px solid rgba(255,215,0,.35)",
        padding: "10px 16px 14px",
        pointerEvents: "auto",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", color: "#fff", fontSize: 11 }}>
        <div style={{ fontWeight: 800, color: "#FFD700", marginBottom: 8, letterSpacing: 1 }}>WWCD CHARACTER EDITOR (?edit=1 — hide in OBS)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlot(i)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: slot === i ? "2px solid #FFD700" : "1px solid rgba(255,255,255,.2)",
                background: slot === i ? "rgba(255,215,0,.15)" : "rgba(255,255,255,.06)",
                color: slot === i ? "#FFD700" : "#ccc",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Slot {i + 1}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#FFD700", color: "#000", fontWeight: 800, cursor: "pointer" }}
          >
            Upload image…
          </button>
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="Or paste image URL (browser / CDN)"
            style={{
              flex: "1 1 220px",
              minWidth: 180,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.2)",
              background: "rgba(255,255,255,.06)",
              color: "#fff",
            }}
          />
          <button
            type="button"
            onClick={applyUrl}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(115,231,190,.5)", background: "rgba(56,189,248,.12)", color: "#73E7BE", fontWeight: 800, cursor: "pointer" }}
          >
            Apply URL
          </button>
          <button
            type="button"
            onClick={clearSlot}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,100,100,.4)", background: "rgba(200,60,60,.2)", color: "#ffb4b4", fontWeight: 800, cursor: "pointer" }}
          >
            Remove / default art
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WWCDOverlay() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const editMode = params.get("edit") === "1";

  const [displayPayload, setDisplayPayload] = useState(null);
  const [boardKey, setBoardKey] = useState(0);
  const [themeName, setThemeName] = useState("esports");
  const [matchNum, setMatchNum] = useState(1);
  const [wwcdColors, setWwcdColors] = useState(null);
  const [tournamentLogo, setTournamentLogo] = useState(null);
  const [logoCacheBust, setLogoCacheBust] = useState(() => Date.now());
  const [themeColorOverrides, setThemeColorOverrides] = useState({});
  const [wwcdCharacterArts, setWwcdCharacterArts] = useState([null, null, null, null]);
  const [charArtCacheBust, setCharArtCacheBust] = useState(() => Date.now());

  const teamsRef = useRef([]);
  const matchRef = useRef({ number: 1, startedAt: Date.now() });

  const refreshSettingsSlice = useCallback((s) => {
    if (!s || typeof s !== "object") return;
    if ("tournamentLogo" in s) {
      setTournamentLogo(s.tournamentLogo || null);
      setLogoCacheBust(Date.now());
    }
    if (s.themeColorOverrides && typeof s.themeColorOverrides === "object") {
      setThemeColorOverrides(s.themeColorOverrides);
    }
    if (Array.isArray(s.wwcdCharacterArts)) {
      setWwcdCharacterArts(normalizeWwcdArts(s.wwcdCharacterArts));
      setCharArtCacheBust(Date.now());
    }
  }, []);

  const applyWwcdPayload = (full) => {
    setDisplayPayload(full);
    setBoardKey((k) => k + 1);
  };

  useEffect(() => {
    const onTeams = (data) => {
      teamsRef.current = Array.isArray(data) ? data : [];
    };
    const onMatch = (m) => {
      const meta = normalizeMatchMeta(m);
      if (!meta) return;
      matchRef.current.number = meta.number;
      matchRef.current.startedAt = meta.startedAt;
      setMatchNum(meta.number);
    };
    const onTheme = (name) => {
      if (typeof name === "string" && getThemeNames().includes(name)) setThemeName(name);
    };
    const onColors = (c) => setWwcdColors(c);
    const onSettings = (s) => refreshSettingsSlice(s);

    const onTournamentLogo = (p) => {
      if (p && "tournamentLogo" in p) {
        setTournamentLogo(p.tournamentLogo || null);
        setLogoCacheBust(Date.now());
      }
    };

    const onChicken = (data) => {
      const full = normalizeChickenPayload(data, teamsRef.current, matchRef.current);
      applyWwcdPayload(full);
    };

    const onCommand = (cmd) => {
      if (cmd.type === "showChickenDinner") {
        let team = teamsRef.current.find((t) => t.eliminationRank === 1);
        if (!team) {
          const sorted = buildLiveRankingOrder(teamsRef.current);
          team = sorted[0];
        }
        const raw = team
          ? buildPayloadFromTeam(team, matchRef.current.number)
          : normalizeChickenPayload({ team: "CHAMPION" }, [], matchRef.current);
        applyWwcdPayload(raw);
      }
    };

    sock.on("teamsUpdated", onTeams);
    sock.on("matchUpdated", onMatch);
    sock.on("activeThemeChanged", onTheme);
    sock.on("wwcdColorsChanged", onColors);
    sock.on("settingsUpdated", onSettings);
    sock.on("tournamentLogoUpdated", onTournamentLogo);
    sock.on("chickenDinner", onChicken);
    sock.on("overlayCommand", onCommand);

    sock.emit("requestTeams");
    sock.emit("requestMatch");
    sock.emit("requestActiveTheme");
    sock.emit("requestWwcdColors");
    sock.emit("requestSettings");
    sock.emit("requestTournamentLogo");

    fetch(`${API}/settings`)
      .then((r) => r.json())
      .then((s) => refreshSettingsSlice(s))
      .catch(() => {});

    fetch(`${API}/overlay/active-theme`)
      .then((r) => r.json())
      .then((d) => {
        const t = d?.theme;
        if (typeof t === "string" && getThemeNames().includes(t)) setThemeName(t);
      })
      .catch(() => {});

    return () => {
      sock.off("teamsUpdated", onTeams);
      sock.off("matchUpdated", onMatch);
      sock.off("activeThemeChanged", onTheme);
      sock.off("wwcdColorsChanged", onColors);
      sock.off("settingsUpdated", onSettings);
      sock.off("tournamentLogoUpdated", onTournamentLogo);
      sock.off("chickenDinner", onChicken);
      sock.off("overlayCommand", onCommand);
    };
  }, [refreshSettingsSlice]);

  const baseTheme = useMemo(() => getTheme(themeName), [themeName]);

  const themeFromPreview = useMemo(
    () => mergeThemeOverride(baseTheme, themeColorOverrides[themeName] || {}),
    [baseTheme, themeName, themeColorOverrides]
  );

  const finalTheme = useMemo(() => {
    if (!wwcdColors || (!wwcdColors.primary && !wwcdColors.gold && !wwcdColors.accent)) return themeFromPreview;
    return {
      ...themeFromPreview,
      colors: {
        ...themeFromPreview.colors,
        ...(wwcdColors.primary && { primary: wwcdColors.primary }),
        ...(wwcdColors.gold && { gold: wwcdColors.gold }),
        ...(wwcdColors.accent && { accent: wwcdColors.accent }),
      },
    };
  }, [themeFromPreview, wwcdColors]);

  const refetchSettings = useCallback(() => {
    fetch(`${API}/settings`)
      .then((r) => r.json())
      .then((s) => refreshSettingsSlice(s))
      .catch(() => {});
  }, [refreshSettingsSlice]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", position: "relative", overflow: "hidden" }}>
      {displayPayload ? (
        <WWCDTeamStatsBoard
          payload={displayPayload}
          theme={finalTheme}
          tournamentLogoPath={tournamentLogo}
          logoCacheBust={logoCacheBust}
          boardKey={boardKey}
          characterArts={wwcdCharacterArts}
          charArtCacheBust={charArtCacheBust}
        />
      ) : (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "#000",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🍗</div>
            <div
              style={{
                color: "#555",
                fontSize: 16,
                fontFamily: "Inter, system-ui, sans-serif",
                fontWeight: 700,
                letterSpacing: 2,
              }}
            >
              WWCD TEAM STATS OUTPUT
            </div>
            <div
              style={{
                color: "#333",
                fontSize: 12,
                fontFamily: "Inter, system-ui, sans-serif",
                marginTop: 8,
                letterSpacing: 1,
                maxWidth: 440,
                lineHeight: 1.5,
              }}
            >
              Waiting for the first winner. After the stats run once, this screen stays on the final frame (no black screen). Character art:{" "}
              <strong style={{ color: "#666" }}>Admin → Overlay → WWCD character cards</strong>, or open{" "}
              <code style={{ color: "#666" }}>/overlay/wwcd?edit=1</code>. Background follows Theme Preview + WWCD color overrides.
            </div>
            <div style={{ color: "#222", fontSize: 11, fontFamily: "monospace", marginTop: 16 }}>
              Match {matchNum} · Theme {themeName}
            </div>
          </div>
        </div>
      )}

      {editMode ? <WwcdEditToolbar characterArts={wwcdCharacterArts} onRefresh={refetchSettings} /> : null}

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden; background: #000; }
      `}</style>
    </div>
  );
}
