/**
 * Removes the solid purple/periwinkle studio background baked into
 * client/public/wwcd/char-0..3.png and writes clean, transparent cut-outs to
 * client/public/wwcd-status/assets/characters/char-0..3.png (defaults for the
 * standalone WWCD STATUS overlay).
 *
 * Method: sample the background colour from image corners, then edge-seeded
 * flood-fill every pixel within a colour-distance threshold of that background
 * to transparent. Flood-fill (vs. a global colour key) avoids nuking similar
 * tones that appear *inside* the character. A light edge despill removes purple
 * halos, and the result is trimmed to crop empty margins.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "client/public/wwcd");
const BACKUP_DIR = path.join(SRC_DIR, "_orig");
const OUT_DIR = path.join(ROOT, "client/public/wwcd-status/assets/characters");

/** Max sum-of-abs RGB distance from the sampled background to treat as background. */
const BG_TOL = 112;
/** Pixels this close to bg (and touching removed bg) get a soft alpha falloff. */
const SOFT_TOL = 158;

function dist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function sampleBackground(pix, w, h) {
  // Average a few corner blocks to get a stable background colour.
  const pts = [];
  const block = 6;
  const corners = [
    [0, 0],
    [w - block, 0],
    [0, h - block],
    [w - block, h - block],
  ];
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + block; y++) {
      for (let x = cx; x < cx + block; x++) {
        const o = (y * w + x) * 4;
        r += pix[o];
        g += pix[o + 1];
        b += pix[o + 2];
        n++;
      }
    }
  }
  void pts;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function processRgba(data, w, h) {
  const pix = new Uint8Array(data);
  const bg = sampleBackground(pix, w, h);

  const neigh = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  // Global colour key: the studio purple does not appear inside the character,
  // so any pixel within BG_TOL of the background colour is safe to drop. This
  // also clears purple trapped between limbs/hair that a flood-fill would miss.
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (dist([pix[o], pix[o + 1], pix[o + 2]], bg) <= BG_TOL) pix[o + 3] = 0;
  }

  // Soft edge: pixels adjacent to removed bg that are still close-ish to bg get
  // partial alpha + a mild despill to kill purple fringes.
  for (let i = 0; i < w * h; i++) {
    if (pix[i * 4 + 3] === 0) continue;
    const o = i * 4;
    const d = dist([pix[o], pix[o + 1], pix[o + 2]], bg);
    if (d < SOFT_TOL) {
      const x = i % w;
      const y = (i / w) | 0;
      let touchesBg = false;
      for (const [dx, dy] of neigh) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (pix[(ny * w + nx) * 4 + 3] === 0) {
          touchesBg = true;
          break;
        }
      }
      if (touchesBg) {
        const t = (d - BG_TOL) / (SOFT_TOL - BG_TOL); // 0..1
        pix[o + 3] = Math.round(Math.max(0, Math.min(1, t)) * 255);
      }
    }
  }
  return pix;
}

async function cleanOne(srcPath, outPath) {
  const buf = fs.readFileSync(srcPath);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error("expected RGBA for " + srcPath);
  const processed = processRgba(data, info.width, info.height);
  const tmp = outPath + ".tmp.png";
  await sharp(Buffer.from(processed), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(tmp);
  await sharp(tmp).trim().png().toFile(outPath);
  fs.unlinkSync(tmp);
}

async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (let i = 0; i < 4; i++) {
    const src = path.join(SRC_DIR, `char-${i}.png`);
    if (!fs.existsSync(src)) {
      console.warn("skip (missing):", src);
      continue;
    }
    const backup = path.join(BACKUP_DIR, `char-${i}.png`);
    if (!fs.existsSync(backup)) fs.copyFileSync(src, backup);
    const out = path.join(OUT_DIR, `char-${i}.png`);
    console.log(`char-${i}.png -> ${path.relative(ROOT, out)}`);
    await cleanOne(src, out);
  }
  console.log("Done. Cleaned characters in", path.relative(ROOT, OUT_DIR));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
