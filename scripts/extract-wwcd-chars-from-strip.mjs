/**
 * Extracts 4 character cut-outs from the PUBG "card strip" screenshot (image 2)
 * and writes them to client/public/wwcd-status/assets/characters/char-0..3.png
 * (the WWCD STATUS default characters).
 *
 * The source strip is 5 cards in a row (1024x243). Each card = rank badge
 * (top-left) + character art on a dark-blue gradient + a light name bar + a
 * blue FINISHES bar. We:
 *   1. Split the strip into 5 equal columns and pick CARD_INDICES.
 *   2. Crop the character-art sub-region (drop borders, name bar, FINISHES bar).
 *   3. Remove the dark-blue card background with an EDGE-SEEDED flood fill so dark
 *      character clothing in the interior is preserved (a global color key would
 *      punch holes in dark suits/coats).
 *   4. Selectively clear the light rank badge from the top-left corner.
 *   5. Soft alpha edge + trim, then save.
 *
 * Re-run with: npm run wwcd:chars:strip
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SRC = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".cursor/projects/c-Users-VARMA-JI-BGMI-LIVE-RANKING/assets/c__Users_VARMA_JI_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-47dfaf4f-e3dc-4154-b3ef-894c80ea8020.png",
);
const OUT_DIR = path.join(ROOT, "client/public/wwcd-status/assets/characters");
const BACKUP_DIR = path.join(OUT_DIR, "_orig-strip");

/**
 * Which of the 5 cards (0-based, left to right) become char-0..3.
 * Skipping card index 2 ("SOHAM"): it is a dark suit on a dark background, which
 * cannot be colour-keyed cleanly at this resolution. Cards 0,1,3,4 all wear
 * light/bright clothing that separates from the near-black card bg.
 */
const CARD_INDICES = [0, 1, 3, 4];
const NUM_COLS = 5;

/** Per-card crop insets (px) relative to each equal-fifth column. */
// Left side carries the rank badge + blue accent bar, so trim more from the left.
const COL_INSET_LEFT = 40;
const COL_INSET_RIGHT = 24;
const ART_TOP = 8; // below the card's top edge line
const ART_BOTTOM = 185; // above the light name bar (~188)

/** Background removal. */
const BG_TOL = 58; // sum-abs RGB distance from sampled bg treated as background
const SOFT_TOL = 104; // soft alpha falloff band for edge pixels
const DARK_ABS = 18; // only the very darkest pixels count as background by themselves
//   (kept low so dark suits/clothing survive; holes are recovered later)
const EDGE_ERODE = 2; // px shaved off the silhouette edge to kill the dark fringe rim
// Saturated-blue accent bar at the card edge: bright-ish strong blue.
const ACCENT_BLUE_R = 30; // b - r
const ACCENT_BLUE_G = 18; // b - g
const ACCENT_MAX_BRIGHT = 130;

/** Rank-badge removal (top-left corner of the crop): cleared completely. */
const BADGE_W_FRAC = 0.34;
const BADGE_H_FRAC = 0.2;
// Thin far-left strip cleared full height (kills the leftover accent bar / frame
// highlight on the left-most card; harmless bg on the others).
const LEFT_STRIP_FRAC = 0.11;

function countOpaque(pix) {
  let n = 0;
  for (let i = 0; i < pix.length; i += 4) if (pix[i + 3] > 0) n++;
  return n;
}

const NEIGH4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Clean up the alpha mask after flood-fill:
 *  1. Fill enclosed holes — transparent pixels NOT reachable from the image border
 *     (the dark suit/hair the flood ate through the silhouette). Their original RGB
 *     is still in the buffer, so restoring alpha = recovering the real pixel.
 *  2. Keep only the largest connected opaque blob (kills detached specks/halo bits).
 */
function cleanupMask(pix, w, h) {
  const n = w * h;

  // 1. Hole fill via border-connected transparent BFS.
  const outside = new Uint8Array(n);
  const stack = [];
  const pushIfTransparent = (i) => {
    if (!outside[i] && pix[i * 4 + 3] === 0) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    pushIfTransparent(x);
    pushIfTransparent((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    pushIfTransparent(y * w);
    pushIfTransparent(y * w + (w - 1));
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i / w) | 0;
    for (const [dx, dy] of NEIGH4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      pushIfTransparent(ny * w + nx);
    }
  }
  for (let i = 0; i < n; i++) {
    if (pix[i * 4 + 3] === 0 && !outside[i]) pix[i * 4 + 3] = 255; // enclosed hole -> restore
  }

  // 2. Largest connected opaque component.
  const label = new Int32Array(n).fill(-1);
  let best = -1;
  let bestSize = 0;
  const comp = [];
  for (let s = 0; s < n; s++) {
    if (label[s] !== -1 || pix[s * 4 + 3] === 0) continue;
    comp.length = 0;
    label[s] = s;
    comp.push(s);
    let head = 0;
    while (head < comp.length) {
      const i = comp[head++];
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of NEIGH4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const ni = ny * w + nx;
        if (label[ni] === -1 && pix[ni * 4 + 3] !== 0) {
          label[ni] = s;
          comp.push(ni);
        }
      }
    }
    if (comp.length > bestSize) {
      bestSize = comp.length;
      best = s;
    }
  }
  if (best !== -1) {
    for (let i = 0; i < n; i++) {
      if (pix[i * 4 + 3] !== 0 && label[i] !== best) pix[i * 4 + 3] = 0;
    }
  }

  // 3. Erode the silhouette by a couple of pixels to shave off the dark fringe rim
  //    (edge pixels are a character+black blend, which reads as a dirty outline).
  erodeAlpha(pix, w, h, EDGE_ERODE);
}

function erodeAlpha(pix, w, h, iters) {
  for (let it = 0; it < iters; it++) {
    const clear = [];
    for (let i = 0; i < w * h; i++) {
      if (pix[i * 4 + 3] === 0) continue;
      const x = i % w;
      const y = (i / w) | 0;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
            edge = true;
            break;
          }
          if (pix[(ny * w + nx) * 4 + 3] === 0) {
            edge = true;
            break;
          }
        }
      }
      if (edge) clear.push(i);
    }
    for (const i of clear) pix[i * 4 + 3] = 0;
  }
}

function dist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function brightness(r, g, b) {
  return (r + g + b) / 3;
}

/**
 * Sample the dark card background. The character's head/shoulders sit lower and
 * the rank badge is far-left, so scan the top rows on the right ~65% and average
 * only the dark pixels (the bg) - this is robust against bright clothing/skin
 * drifting into a corner sample.
 */
function sampleBg(pix, w, h) {
  const x0 = Math.round(w * 0.35);
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let y = 0; y < 5; y++) {
    for (let x = x0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (brightness(pix[o], pix[o + 1], pix[o + 2]) < 70) {
        r += pix[o];
        g += pix[o + 1];
        b += pix[o + 2];
        n++;
      }
    }
  }
  if (!n) return [12, 12, 14];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function processCard(pix, w, h) {
  const bg = sampleBg(pix, w, h);

  // 1. Clear the rank badge box in the top-left corner completely.
  const bw = Math.round(w * BADGE_W_FRAC);
  const bh = Math.round(h * BADGE_H_FRAC);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      pix[(y * w + x) * 4 + 3] = 0;
    }
  }
  // Clear a thin far-left strip (accent bar / frame highlight) full height.
  const ls = Math.round(w * LEFT_STRIP_FRAC);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < ls; x++) {
      pix[(y * w + x) * 4 + 3] = 0;
    }
  }

  // 2. Edge-seeded flood fill: remove dark-blue bg connected to the borders.
  const visited = new Uint8Array(w * h);
  const queue = [];
  const isBg = (i) => {
    const o = i * 4;
    if (pix[o + 3] === 0) return true;
    const r = pix[o];
    const g = pix[o + 1];
    const b = pix[o + 2];
    if (dist([r, g, b], bg) <= BG_TOL) return true;
    if (brightness(r, g, b) < DARK_ABS) return true; // near-black bg
    // saturated-blue accent bar at the card edge
    return (
      brightness(r, g, b) <= ACCENT_MAX_BRIGHT && b - r >= ACCENT_BLUE_R && b - g >= ACCENT_BLUE_G
    );
  };
  const seed = (x, y) => {
    const i = y * w + x;
    if (visited[i] || !isBg(i)) return;
    visited[i] = 1;
    queue.push(i);
  };
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }
  const neigh = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i / w) | 0;
    pix[i * 4 + 3] = 0;
    for (const [dx, dy] of neigh) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (visited[ni] || !isBg(ni)) continue;
      visited[ni] = 1;
      queue.push(ni);
    }
  }

  // 3. Recover holes the flood ate through the silhouette, drop detached specks,
  //    and erode the dark fringe rim. Edge anti-aliasing happens at save (blur).
  cleanupMask(pix, w, h);
  return pix;
}

async function extractOne(srcBuf, srcW, srcH, cardIdx, outPath) {
  const colW = srcW / NUM_COLS;
  const left = Math.round(cardIdx * colW) + COL_INSET_LEFT;
  const right = Math.round((cardIdx + 1) * colW) - COL_INSET_RIGHT;
  const top = ART_TOP;
  const bottom = Math.min(ART_BOTTOM, srcH);
  const cw = right - left;
  const ch = bottom - top;

  const { data, info } = await sharp(srcBuf)
    .extract({ left, top, width: cw, height: ch })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error("expected RGBA");

  const pix = new Uint8Array(data);
  const before = countOpaque(pix);
  processCard(pix, info.width, info.height);
  const after = countOpaque(pix);
  console.log(
    `   bg=${JSON.stringify(sampleBg(new Uint8Array(data), info.width, info.height))} kept ${after}/${before} px (removed ${before - after})`,
  );

  const tmp = outPath + ".tmp.png";
  await sharp(Buffer.from(pix), { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(tmp);
  // Trim margins, lightly feather the mask edges (anti-alias the 1px alpha stairs),
  // upscale 3x with a smooth kernel, then a mild sharpen so the low-res art reads
  // cleaner in the 300x440 card.
  await sharp(tmp)
    .trim({ threshold: 10 })
    .blur(0.9)
    .resize({ width: cw * 3, fit: "inside", kernel: "lanczos3", withoutEnlargement: false })
    .sharpen({ sigma: 0.6 })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  fs.unlinkSync(tmp);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Source strip not found:", SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const srcBuf = fs.readFileSync(SRC);
  const meta = await sharp(srcBuf).metadata();

  for (let slot = 0; slot < CARD_INDICES.length; slot++) {
    const out = path.join(OUT_DIR, `char-${slot}.png`);
    if (fs.existsSync(out)) {
      const bak = path.join(BACKUP_DIR, `char-${slot}.png`);
      if (!fs.existsSync(bak)) fs.copyFileSync(out, bak);
    }
    console.log(`card #${CARD_INDICES[slot] + 1} -> char-${slot}.png`);
    await extractOne(srcBuf, meta.width, meta.height, CARD_INDICES[slot], out);
  }
  console.log("Done. Characters in", path.relative(ROOT, OUT_DIR));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
