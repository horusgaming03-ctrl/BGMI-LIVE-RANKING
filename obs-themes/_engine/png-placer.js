/**
 * PNG auto-detection and professional frame placement.
 */

const DEFAULT_PATTERNS = {
  liveRanking: /^live[-_]?rank(ing)?/i,
  eliminator: /^eliminator/i,
  teamLogo: /^team[-_]?logo/i,
  topFourPlayer: /^top[-_]?4|topfour|alive[-_]?player/i,
  mvp: /^mvp/i,
  character: /^char(acter)?/i,
  teamBanner: /^team[-_]?banner|banner/i,
  background: /^bg[-_]|background/i,
};

function pct(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildFilter(slot) {
  const parts = [];
  if (slot.shadow) parts.push("drop-shadow(0 0.35em 1em rgba(0,0,0,0.55))");
  if (slot.glow) {
    const c = slot.glowColor || "rgba(255,200,80,0.65)";
    parts.push(`drop-shadow(0 0 1.2em ${c})`);
  }
  if (slot.brightness) parts.push(`brightness(${slot.brightness})`);
  if (slot.saturate) parts.push(`saturate(${slot.saturate})`);
  return parts.length ? parts.join(" ") : "none";
}

export async function discoverAssets(themeBaseUrl, layout) {
  const patterns = { ...DEFAULT_PATTERNS, ...(layout?.assets?.patterns || {}) };
  const manifest = layout?.assets?.files || {};
  const found = {};

  for (const [key, pattern] of Object.entries(patterns)) {
    if (manifest[key]) {
      found[key] = new URL(manifest[key], themeBaseUrl).href;
      continue;
    }
    if (typeof pattern === "string" && !pattern.startsWith("^")) {
      found[key] = new URL(pattern, themeBaseUrl).href;
    }
  }

  if (layout?.assets?.background) {
    found.background = new URL(layout.assets.background, themeBaseUrl).href;
  }

  try {
    const res = await fetch(new URL("assets/manifest.json", themeBaseUrl));
    if (res.ok) {
      const files = await res.json();
      for (const [key, filename] of Object.entries(files)) {
        found[key] = new URL(`assets/${filename}`, themeBaseUrl).href;
      }
    }
  } catch {
    /* optional manifest */
  }

  return found;
}

export function mountPngFrames(root, layout, assets, themeHooks = {}) {
  const slots = layout?.pngSlots || {};
  const container = document.createElement("div");
  container.className = "obs-png-root";
  container.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1;";

  for (const [slotId, slot] of Object.entries(slots)) {
    const frame = slot?.frame || {};
    const el = document.createElement("div");
    el.className = `obs-png-frame mask-${slot.mask || "none"}`;
    el.dataset.slot = slotId;
    el.style.left = `${pct(frame.x, 0)}%`;
    el.style.top = `${pct(frame.y, 0)}%`;
    el.style.width = `${pct(frame.w, 10)}%`;
    el.style.height = `${pct(frame.h, 10)}%`;
    el.style.setProperty("--png-fit", slot.fit || "contain");
    el.style.setProperty("--png-filter", buildFilter(slot));

    const assetKey = slot.assetKey || slotId;
    const src = assets[assetKey];
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = slotId;
      img.loading = "eager";
      img.decoding = "async";
      img.onerror = () => { img.style.display = "none"; };
      el.appendChild(img);
    }

    if (typeof themeHooks.decoratePngFrame === "function") {
      themeHooks.decoratePngFrame(el, slotId, slot);
    }

    container.appendChild(el);
  }

  root.appendChild(container);
  return container;
}

export function applyLogoToFrame(root, slotId, logoUrl) {
  const frame = root.querySelector(`.obs-png-frame[data-slot="${slotId}"]`);
  if (!frame || !logoUrl) return;
  let img = frame.querySelector("img");
  if (!img) {
    img = document.createElement("img");
    img.className = "obs-logo";
    frame.appendChild(img);
  }
  if (img.src !== logoUrl) img.src = logoUrl;
}

export function fitImageInCell(imgEl, mode = "contain") {
  if (!imgEl) return;
  imgEl.style.objectFit = mode;
  imgEl.style.width = "100%";
  imgEl.style.height = "100%";
}
