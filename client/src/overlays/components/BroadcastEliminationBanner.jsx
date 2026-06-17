import { getApiBase } from "../../apiOrigin";
import { broadcastElimStyleFromTheme } from "../broadcastGfxUtils";

const API = getApiBase();

/**
 * BMPS-style flat elimination banner — rank + logo left, stats + ELIMINATED right.
 */
export default function BroadcastEliminationBanner({
  banner,
  theme,
  style,
  animClass = "",
  scale = 1,
  origin = "bottom left",
}) {
  if (!banner) return null;

  const s = style && typeof style === "object" ? style : broadcastElimStyleFromTheme(theme);
  const name = String(banner.team || "TEAM").trim() || "TEAM";
  const rank = banner.rank ?? "?";
  const finishes = banner.finishes ?? 0;
  const initials = name.slice(0, 2).toUpperCase();
  const logo = banner.logo;

  const wrapStyle =
    scale === 1
      ? { display: "flex", flexDirection: "column", position: "relative", filter: "drop-shadow(0 6px 18px rgba(0,0,0,.55))" }
      : {
          display: "flex",
          flexDirection: "column",
          position: "relative",
          transform: `scale(${scale})`,
          transformOrigin: origin,
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,.5))",
        };

  return (
    <div className={animClass} style={wrapStyle}>
      <div
        style={{
          alignSelf: "flex-start",
          maxWidth: "100%",
          background: s.nameTagBg,
          color: s.nameTagText,
          padding: "3px 14px 2px",
          fontFamily: s.fontFamily,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          lineHeight: 1.1,
          marginBottom: 2,
        }}
      >
        {name}
      </div>

      <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch" }}>
        <div style={{ width: 108, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div
            style={{
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              background: s.panelBg,
              color: s.rankText,
              fontFamily: s.fontFamily,
              fontWeight: 700,
            }}
          >
            <span style={{ fontSize: 18, opacity: 0.85 }}>#</span>
            <span style={{ fontSize: 28, lineHeight: 1 }}>{rank}</span>
          </div>
          <div
            style={{
              height: 88,
              display: "grid",
              placeItems: "center",
              background: s.panelBg,
              borderTop: "1px solid rgba(255,255,255,.08)",
            }}
          >
            {logo ? (
              <img
                src={`${API}${logo}`}
                alt=""
                style={{ width: 64, height: 64, objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 0,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(255,255,255,.12)",
                  color: s.rankText,
                  fontFamily: s.fontFamily,
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {initials}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", minWidth: 360, flex: 1 }}>
          <div
            style={{
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 18px",
              background: s.statsBg,
              color: s.statsText,
              fontFamily: s.fontFamily,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              fontSize: 15,
            }}
          >
            FINISH <span style={{ fontSize: 18, marginLeft: 6 }}>{finishes}</span>
          </div>
          <div
            style={{
              height: 88,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: s.elimBg,
              color: s.elimText,
              fontFamily: s.fontFamily,
              fontWeight: 700,
              fontSize: 42,
              letterSpacing: 3,
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            ELIMINATED
          </div>
        </div>
      </div>
    </div>
  );
}
