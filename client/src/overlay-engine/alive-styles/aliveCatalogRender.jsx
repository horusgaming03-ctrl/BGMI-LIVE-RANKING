function cell(base, alive, extra = {}) {
  return {
    background: alive ? base.color : base.deadColor,
    transition: "background 0.28s ease, transform 0.25s ease, box-shadow 0.25s ease",
    boxShadow: alive ? base.glow : "none",
    border: alive ? "1px solid rgba(0,0,0,.18)" : "1px solid rgba(255,255,255,.24)",
    boxSizing: "border-box",
    ...extra,
  };
}

/** Procedural `alv_XXX` entries from aliveCatalog.js */
export function renderAliveCatalogEntry(entry, { c, size, gap, color, deadColor, base, layout = "grid" }) {
  const lay = layout === "line" ? "line" : "grid";
  const v = entry.variant % 5;
  const brSoft = 2 + v;
  const bw = v === 0 ? 1 : v <= 2 ? 2 : 3;

  const wrapGrid = {
    display: "grid",
    gridTemplateColumns: `${size}px ${size}px`,
    gridTemplateRows: `${size}px ${size}px`,
    gap,
    justifySelf: "center",
    alignItems: "center",
  };

  const wrapCells =
    lay === "line"
      ? {
          display: "flex",
          flexDirection: "row",
          gap: gap + 2,
          justifySelf: "center",
          alignItems: "center",
          flexWrap: "nowrap",
        }
      : wrapGrid;

  const mk = (i, ex) => (
    <div key={i} style={cell(base, i < c, { width: size, height: size, ...ex })} />
  );

  switch (entry.mode) {
    case "quad_sq":
      return (
        <div style={wrapCells}>
          {[0, 1, 2, 3].map((i) => mk(i, { borderRadius: 1 }))}
        </div>
      );
    case "quad_round":
      return (
        <div style={wrapCells}>
          {[0, 1, 2, 3].map((i) => mk(i, { borderRadius: brSoft }))}
        </div>
      );
    case "quad_circ":
      return (
        <div style={wrapCells}>
          {[0, 1, 2, 3].map((i) => mk(i, { borderRadius: "50%" }))}
        </div>
      );
    case "quad_hex":
      return (
        <div style={wrapCells}>
          {[0, 1, 2, 3].map((i) =>
            mk(i, {
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            }),
          )}
        </div>
      );
    case "quad_diamond":
      return (
        <div style={wrapCells}>
          {[0, 1, 2, 3].map((i) => mk(i, { borderRadius: 2, transform: "rotate(45deg)" }))}
        </div>
      );
    case "row_dots":
      return (
        <div style={wrapCells}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={cell(base, i < c, {
                width: size * (0.55 + v * 0.05),
                height: size * (0.55 + v * 0.05),
                borderRadius: "50%",
              })}
            />
          ))}
        </div>
      );
    case "bar_seg":
      return (
        <div
          style={{
            display: "flex",
            width: size * 4 + gap * 5,
            height: Math.max(6, size * (0.45 + v * 0.06)),
            border: `1px solid ${color}66`,
            borderRadius: 6,
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
                borderRadius: 3,
                background: i < c ? color : deadColor,
                minWidth: 3,
              }}
            />
          ))}
        </div>
      );
    case "ring_hollow":
      return (
        <div style={wrapCells}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: size,
                height: size,
                borderRadius: "50%",
                border: `${bw}px solid ${i < c ? color : deadColor}`,
                background: "transparent",
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
      );
    case "strip_wide":
      return (
        <div
          style={{
            width: size * 4.8,
            height: Math.max(8, 6 + v * 2),
            background: deadColor,
            borderRadius: 99,
            overflow: "hidden",
            justifySelf: "center",
            border: `1px solid ${color}44`,
          }}
        >
          <div
            style={{
              width: `${(c / 4) * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${color}, ${deadColor})`,
              transition: "width 0.35s ease",
            }}
          />
        </div>
      );
    case "pill_row":
      return (
        <div style={wrapCells}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={cell(base, i < c, {
                width: size * 0.95,
                height: size * 0.65,
                borderRadius: 99,
              })}
            />
          ))}
        </div>
      );
    case "outline_sq":
      return (
        <div style={wrapCells}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: size,
                height: size,
                borderRadius: 3,
                border: `${bw}px solid ${i < c ? color : deadColor}`,
                background: i < c ? `${color}22` : "transparent",
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
      );
    case "skew_tile":
      return (
        <div style={{ ...wrapCells, transform: `skewX(${-3 - v}deg)` }}>
          {[0, 1, 2, 3].map((i) => mk(i, { borderRadius: 2 }))}
        </div>
      );
    case "mini_grid": {
      const s2 = Math.max(4, size - 2 - v);
      if (lay === "line") {
        return (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: Math.max(1, gap - 1) + 2,
              justifySelf: "center",
              alignItems: "center",
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={cell(base, i < c, { borderRadius: "50%", width: s2, height: s2 })} />
            ))}
          </div>
        );
      }
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${s2}px ${s2}px`,
            gridTemplateRows: `${s2}px ${s2}px`,
            gap: Math.max(1, gap - 1),
            justifySelf: "center",
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={cell(base, i < c, { borderRadius: "50%" })} />
          ))}
        </div>
      );
    }
    case "bar_tight":
      return (
        <div
          style={{
            display: "flex",
            width: size * 3.8 + gap * 4,
            height: Math.max(4, size * 0.35),
            border: `1px solid ${color}55`,
            borderRadius: 3,
            padding: 1,
            gap: 1,
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
                minWidth: 2,
              }}
            />
          ))}
        </div>
      );
    case "hex_dot":
      return (
        <div style={wrapCells}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={cell(base, i < c, {
                width: size * 0.75,
                height: size * 0.75,
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              })}
            />
          ))}
        </div>
      );
    case "split_vert":
      return (
        <div style={wrapCells}>
          {[0, 1, 2, 3].map((i) => mk(i, { borderRadius: 2, boxShadow: i < c ? base.glow : "none" }))}
        </div>
      );
    default:
      return null;
  }
}
