function parseHex(hex) {
  const raw = String(hex || "#ffd54a").replace("#", "").trim();
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16),
    };
  }
  if (raw.length !== 6) return { r: 255, g: 213, b: 74 };
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function lightenColor(hex, amount = 0.5) {
  const { r, g, b } = parseHex(hex);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

export function darkenColor(hex, amount = 0.35) {
  const { r, g, b } = parseHex(hex);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(r * (1 - t), g * (1 - t), b * (1 - t));
}

/** Build CSS custom properties for the broadcast title from admin color pickers. */
export function titleColorVars(header = {}) {
  const base = header.titleColor || "#ffd54a";
  const outline = header.titleOutlineColor || darkenColor(base, 0.72);
  return {
    "--os-title-top": lightenColor(base, 0.62),
    "--os-title-hi": lightenColor(base, 0.28),
    "--os-title-mid": base,
    "--os-title-bottom": darkenColor(base, 0.42),
    "--os-title-stroke": outline,
  };
}

export function applyTitleColorVars(targetEl, header = {}) {
  if (!targetEl) return;
  const vars = titleColorVars(header);
  Object.entries(vars).forEach(([key, value]) => {
    targetEl.style.setProperty(key, value);
  });
}
