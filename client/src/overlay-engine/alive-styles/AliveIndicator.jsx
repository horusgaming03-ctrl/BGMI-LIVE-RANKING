import { memo } from "react";
import { getAllAliveStyleIds, getAliveEntry } from "./aliveCatalog";
import { renderAliveCatalogEntry } from "./aliveCatalogRender.jsx";
import { getApiBase } from "../../apiOrigin";

/** Legacy + procedural library (`alv_000` …) — 200+ IDs */
export const ALIVE_STYLE_IDS = getAllAliveStyleIds();

/** Font stack so symbols render in OBS / custom theme fonts (Orbitron has no ♥). */
const GLYPH_FONT = `"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif`;

function AliveHeartGlyph({ fill, muted, size }) {
  const s = Math.max(12, Math.round(size) + 6);
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" style={{ display: "block", opacity: muted ? 0.3 : 1 }} aria-hidden="true">
      <path
        fill={fill}
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
    </svg>
  );
}

function cellStyle(base, alive, deadIgnored, extra = {}) {
  return {
    background: alive ? base.color : base.deadColor,
    transition: "background 0.28s ease, transform 0.25s ease, box-shadow 0.25s ease",
    boxShadow: alive ? base.glow : "none",
    border: alive ? "1px solid rgba(0,0,0,.18)" : "1px solid rgba(255,255,255,.24)",
    boxSizing: "border-box",
    ...extra,
  };
}

function makeWrap(layout, size, gap, { heartMode = false } = {}) {
  if (heartMode) {
    if (layout === "line") {
      return {
        display: "flex",
        flexDirection: "row",
        gap: gap + 3,
        justifySelf: "center",
        alignItems: "center",
      };
    }
    const cell = Math.max(12, size + 6);
    return {
      display: "grid",
      gridTemplateColumns: `${cell}px ${cell}px`,
      gridTemplateRows: `${cell}px ${cell}px`,
      gap,
      justifySelf: "center",
      alignItems: "center",
    };
  }
  if (layout === "line") {
    return {
      display: "flex",
      flexDirection: "row",
      gap: gap + 2,
      justifySelf: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      fontFamily: GLYPH_FONT,
    };
  }
  return {
    display: "grid",
    gridTemplateColumns: `${size}px ${size}px`,
    gridTemplateRows: `${size}px ${size}px`,
    gap,
    justifySelf: "center",
    alignItems: "center",
    fontFamily: GLYPH_FONT,
  };
}

function AliveCustomPngIndicator({ count: c, size, gap, layout, alivePath, deadPath }) {
  const api = getApiBase();
  const aliveSrc = alivePath ? `${api}${alivePath}` : deadPath ? `${api}${deadPath}` : "";
  const deadSrc = deadPath ? `${api}${deadPath}` : aliveSrc;
  if (!aliveSrc) return null;
  const imgPx = Math.max(12, Math.round(size * 1.35));
  const wrap =
    layout === "line"
      ? {
          display: "flex",
          flexDirection: "row",
          gap: gap + 2,
          justifySelf: "center",
          alignItems: "center",
        }
      : {
          display: "grid",
          gridTemplateColumns: `${imgPx}px ${imgPx}px`,
          gridTemplateRows: `${imgPx}px ${imgPx}px`,
          gap: Math.max(2, gap),
          justifySelf: "center",
          alignItems: "center",
        };
  return (
    <div style={wrap}>
      {[0, 1, 2, 3].map((i) => (
        <img
          key={i}
          src={i < c ? aliveSrc : deadSrc}
          alt=""
          draggable={false}
          style={{
            width: imgPx,
            height: imgPx,
            objectFit: "contain",
            opacity: i < c ? 1 : 0.48,
            filter: i < c ? undefined : "grayscale(55%) brightness(0.85)",
            display: "block",
          }}
        />
      ))}
    </div>
  );
}

function AliveIndicator({ count, theme, styleId = "square", layout = "grid", customAlivePath = null, customDeadPath = null }) {
  const c = Math.max(0, Math.min(4, Math.round(Number(count) || 0)));
  const a = theme.alive || {};
  const size = Math.max(4, a.size || 8);
  const gap = a.gap ?? 2;
  const color = a.color || "#ff4655";
  const deadColor = a.deadColor || "#1e2a3a";
  const glow = `0 0 ${size}px ${color}99`;
  const base = { color, deadColor, glow };

  const lay = layout === "line" ? "line" : "grid";

  if (customAlivePath || customDeadPath) {
    return (
      <AliveCustomPngIndicator
        count={c}
        size={size}
        gap={gap}
        layout={lay}
        alivePath={customAlivePath}
        deadPath={customDeadPath}
      />
    );
  }

  const wrap = makeWrap(lay, size, gap);

  const mk = (p, i, shape) => (
    <div
      key={i}
      style={cellStyle(
        base,
        p < c,
        p >= c,
        shape === "circle" ? { borderRadius: "50%" } : shape === "diamond" ? { borderRadius: 2, transform: "rotate(45deg)" } : shape === "rounded" ? { borderRadius: 4 } : { borderRadius: 2 }
      )}
    />
  );

  if (styleId === "circle") {
    return (
      <div style={wrap}>
        {[0, 1, 2, 3].map((i) => mk(i, i, "circle"))}
      </div>
    );
  }
  if (styleId === "diamond") {
    return (
      <div style={wrap}>
        {[0, 1, 2, 3].map((i) => mk(i, i, "diamond"))}
      </div>
    );
  }
  if (styleId === "rounded" || styleId === "square") {
    return (
      <div style={wrap}>
        {[0, 1, 2, 3].map((i) => mk(i, i, styleId === "rounded" ? "rounded" : undefined))}
      </div>
    );
  }

  if (styleId === "box") {
    return (
      <div style={wrap}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              ...cellStyle(base, i < c, i >= c, { borderRadius: 3 }),
              border: `2px solid ${i < c ? color : deadColor}`,
              boxSizing: "border-box",
            }}
          />
        ))}
      </div>
    );
  }

  if (styleId === "star") {
    return (
      <div style={{ ...wrap, fontSize: size + 2, lineHeight: 1, color }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ opacity: i < c ? 1 : 0.22, textAlign: "center" }}>
            ★
          </span>
        ))}
      </div>
    );
  }

  if (styleId === "heart") {
    return (
      <div style={makeWrap(lay, size, gap, { heartMode: true })}>
        {[0, 1, 2, 3].map((i) => (
          <AliveHeartGlyph key={i} fill={i < c ? color : deadColor} muted={i >= c} size={size} />
        ))}
      </div>
    );
  }

  if (styleId === "skull") {
    return (
      <div style={{ ...wrap, fontSize: size + 2, lineHeight: 1 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ opacity: i < c ? 1 : 0.18, textAlign: "center" }}>
            💀
          </span>
        ))}
      </div>
    );
  }

  if (styleId === "shield") {
    return (
      <div style={{ ...wrap, fontSize: size + 2, lineHeight: 1, color }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ opacity: i < c ? 1 : 0.2, textAlign: "center" }}>
            🛡
          </span>
        ))}
      </div>
    );
  }

  if (styleId === "dots" || styleId === "minimal_dot") {
    const d = size * 0.65;
    const dotWrap =
      lay === "line"
        ? { display: "flex", flexDirection: "row", gap: gap + 2, justifySelf: "center", alignItems: "center" }
        : {
            display: "grid",
            gridTemplateColumns: `${d + 2}px ${d + 2}px`,
            gridTemplateRows: `${d + 2}px ${d + 2}px`,
            gap,
            justifySelf: "center",
            alignItems: "center",
          };
    return (
      <div style={dotWrap}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: d,
              height: d,
              borderRadius: "50%",
              ...cellStyle(base, i < c, i >= c),
            }}
          />
        ))}
      </div>
    );
  }

  /** Horizontal or vertical line of 4 cells (avoid 2×2 grid). */
  const lineFlex = (dir, childStyleForIndex) => (
    <div
      style={{
        display: "flex",
        flexDirection: dir,
        gap: gap + (dir === "row" ? 2 : 3),
        justifySelf: "center",
        alignItems: "center",
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={childStyleForIndex(i)} />
      ))}
    </div>
  );

  if (styleId === "line_square") {
    return lineFlex("row", (i) => cellStyle(base, i < c, i >= c, { width: size, height: size, borderRadius: 2 }));
  }
  if (styleId === "line_circle") {
    return lineFlex("row", (i) => cellStyle(base, i < c, i >= c, { width: size, height: size, borderRadius: "50%" }));
  }
  if (styleId === "line_rounded") {
    return lineFlex("row", (i) => cellStyle(base, i < c, i >= c, { width: size, height: size, borderRadius: Math.max(3, Math.round(size * 0.25)) }));
  }
  if (styleId === "line_diamond") {
    return lineFlex("row", (i) =>
      cellStyle(base, i < c, i >= c, { width: size, height: size, borderRadius: 2, transform: "rotate(45deg)" }),
    );
  }
  if (styleId === "line_hex") {
    return lineFlex("row", (i) =>
      cellStyle(base, i < c, i >= c, {
        width: size,
        height: size,
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
      }),
    );
  }
  if (styleId === "line_box") {
    return lineFlex("row", (i) => ({
      ...cellStyle(base, i < c, i >= c, { borderRadius: 3, width: size, height: size }),
      border: `2px solid ${i < c ? color : deadColor}`,
      boxSizing: "border-box",
    }));
  }
  if (styleId === "line_neon") {
    return lineFlex("row", (i) => ({
      borderRadius: "50%",
      border: `2px solid ${i < c ? color : deadColor}`,
      boxShadow: i < c ? `0 0 ${size}px ${color}` : "none",
      background: i < c ? `${color}33` : "transparent",
      width: size,
      height: size,
      boxSizing: "border-box",
    }));
  }
  if (styleId === "line_pulse") {
    return lineFlex("row", (i) => ({
      borderRadius: "50%",
      border: `2px solid ${i < c ? color : deadColor}`,
      width: size,
      height: size,
      boxSizing: "border-box",
      animation: i < c ? "oe_pulse 1.6s ease-in-out infinite" : undefined,
    }));
  }
  if (styleId === "column_square") {
    return lineFlex("column", (i) => cellStyle(base, i < c, i >= c, { width: size, height: size, borderRadius: 2 }));
  }
  if (styleId === "column_circle") {
    return lineFlex("column", (i) => cellStyle(base, i < c, i >= c, { width: size, height: size, borderRadius: "50%" }));
  }
  if (styleId === "column_rounded") {
    return lineFlex("column", (i) =>
      cellStyle(base, i < c, i >= c, { width: size, height: size, borderRadius: Math.max(3, Math.round(size * 0.25)) }),
    );
  }

  if (styleId === "flame") {
    return (
      <div style={{ ...wrap, fontSize: size + 1, lineHeight: 1 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ opacity: i < c ? 1 : 0.2, textAlign: "center" }}>
            🔥
          </span>
        ))}
      </div>
    );
  }

  if (styleId === "battery") {
    return (
      <div
        style={{
          display: "flex",
          width: size * 4 + gap * 5,
          height: size * 0.7,
          border: `1px solid ${color}66`,
          borderRadius: 4,
          padding: 2,
          gap: 2,
          boxSizing: "border-box",
          justifySelf: "center",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: 2,
              background: i < c ? color : deadColor,
              minWidth: 4,
            }}
          />
        ))}
      </div>
    );
  }

  if (styleId === "health_strip") {
    return (
      <div style={{ width: size * 4.5, height: size * 0.55, background: deadColor, borderRadius: 99, overflow: "hidden", justifySelf: "center" }}>
        <div
          style={{
            width: `${(c / 4) * 100}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${theme.colors?.gold || "#ffd700"})`,
            transition: "width 0.35s ease",
          }}
        />
      </div>
    );
  }

  if (styleId === "crown") {
    return (
      <div style={{ ...wrap, fontSize: size + 3, lineHeight: 1 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ opacity: i < c ? 1 : 0.2, textAlign: "center" }}>
            ♚
          </span>
        ))}
      </div>
    );
  }

  if (styleId === "helmet") {
    return (
      <div style={{ ...wrap, fontSize: size + 3, lineHeight: 1 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ opacity: i < c ? 1 : 0.2, textAlign: "center" }}>
            ⛑
          </span>
        ))}
      </div>
    );
  }

  if (styleId === "crystal") {
    return (
      <div style={{ ...wrap, fontSize: size + 1, lineHeight: 1 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ opacity: i < c ? 1 : 0.22, textAlign: "center" }}>
            ◆
          </span>
        ))}
      </div>
    );
  }

  if (styleId === "crosshair") {
    return (
      <div style={{ ...wrap, fontSize: size, lineHeight: 1, color }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ opacity: i < c ? 1 : 0.2, textAlign: "center" }}>
            ⌖
          </span>
        ))}
      </div>
    );
  }

  if (styleId === "bolt") {
    return (
      <div style={{ ...wrap, fontSize: size + 4, lineHeight: 1, color }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ opacity: i < c ? 1 : 0.2, textAlign: "center" }}>
            ⚡
          </span>
        ))}
      </div>
    );
  }

  if (styleId === "hex") {
    return (
      <div style={{ ...wrap }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: size,
              height: size,
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              ...cellStyle(base, i < c, i >= c),
            }}
          />
        ))}
      </div>
    );
  }

  if (styleId === "target") {
    return (
      <div style={{ ...wrap, fontSize: size + 2, lineHeight: 1, color }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ opacity: i < c ? 1 : 0.2, textAlign: "center" }}>
            ◎
          </span>
        ))}
      </div>
    );
  }

  if (styleId === "neon_node") {
    return (
      <div style={wrap}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              borderRadius: "50%",
              border: `2px solid ${i < c ? color : deadColor}`,
              boxShadow: i < c ? `0 0 ${size}px ${color}` : "none",
              background: i < c ? `${color}33` : "transparent",
              width: size,
              height: size,
            }}
          />
        ))}
      </div>
    );
  }

  if (styleId === "pulse_ring" || styleId === "esports_ring") {
    return (
      <div style={wrap}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              borderRadius: "50%",
              border: `2px solid ${i < c ? color : deadColor}`,
              width: size,
              height: size,
              animation: i < c && styleId === "pulse_ring" ? "oe_pulse 1.6s ease-in-out infinite" : undefined,
            }}
          />
        ))}
      </div>
    );
  }

  if (styleId === "badge") {
    return (
      <div style={{ ...wrap, fontSize: size - 1, fontWeight: 900, color }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ opacity: i < c ? 1 : 0.2, textAlign: "center", letterSpacing: -1 }}>
            {i < c ? "▣" : "▢"}
          </span>
        ))}
      </div>
    );
  }

  const catalogEntry = getAliveEntry(styleId);
  if (catalogEntry) {
    const node = renderAliveCatalogEntry(catalogEntry, { c, size, gap, color, deadColor, base, layout: lay });
    if (node) return node;
  }

  return (
    <div style={wrap}>
      {[0, 1, 2, 3].map((i) => mk(i, i, "rounded"))}
    </div>
  );
}

export default memo(AliveIndicator);
