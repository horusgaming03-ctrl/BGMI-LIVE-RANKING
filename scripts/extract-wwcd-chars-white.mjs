/**
 * Extracts character cut-outs from the WHITE-background reference (IMG_4061),
 * which holds 5 cleanly-separated PUBG characters on pure white.
 *
 * Pipeline per character:
 *   1. Auto-segment the strip into 5 columns by detecting white gaps.
 *   2. Edge-seeded flood fill removing near-pure-white (keeps light jackets/suits,
 *      whose highlights are slightly off-white, plus anything interior).
 *   3. Recover enclosed holes, keep the largest blob, erode the AA fringe rim.
 *   4. Anti-alias (blur), trim, upscale 3x, mild sharpen.
 *
 * Writes the SELECTED 4 to char-0..3.png and ALL 5 to assets/characters/_all
 * for reference. Backs up current defaults to .../_orig-white once.
 *
 * Run: npm run wwcd:chars:white
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SRC = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".cursor/projects/c-Users-VARMA-JI-BGMI-LIVE-RANKING/assets/c__Users_VARMA_JI_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_IMG_4061-ba21c7bb-27fc-4c11-a2b1-caeadd5777fe.png",
);
const OUT_DIR = path.join(ROOT, "client/public/wwcd-status/assets/characters");
const ALL_DIR = path.join(OUT_DIR, "_all");
const BACKUP_DIR = path.join(OUT_DIR, "_orig-white");

/** Which detected characters (0-based, left to right) become char-0..3. */
const SELECT = [0, 1, 3, 4];

/** Background = within this sum-abs distance of pure white. Edge-seeded flood, so
 *  interior near-white suit highlights stay; this mainly eats the light AA fringe. */
const WHITE_TOL = 42;
/** Column is "content" if it has more than this many non-white pixels. */
const CONTENT_MIN = 4;
const CONTENT_WHITE_T = 244; // a pixel counts as content if any channel < this
/** Minimum width of a white gap (px) that separates two characters. */
const MIN_GAP = 10;
const SPAN_PAD = 6;
const EDGE_ERODE = 3;

const NEIGH4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [-0, -1],
];

const whiteDist = (r, g, b) => 255 - r + (255 - g) + (255 - b);

function segmentColumns(data, w, h) {
  const content = new Uint8Array(w);
  for (let x = 0; x < w; x++) {
    let n = 0;
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4;
      if (data[o] < CONTENT_WHITE_T || data[o + 1] < CONTENT_WHITE_T || data[o + 2] < CONTENT_WHITE_T) n++;
    }
    content[x] = n > CONTENT_MIN ? 1 : 0;
  }
  const spans = [];
  let start = -1;
  let gap = 0;
  for (let x = 0; x < w; x++) {
    if (content[x]) {
      if (start === -1) start = x;
      gap = 0;
    } else if (start !== -1) {
      gap++;
      if (gap >= MIN_GAP) {
        spans.push([start, x - gap + 1]);
        start = -1;
        gap = 0;
      }
    }
  }
  if (start !== -1) spans.push([start, w - 1]);
  return spans;
}

function cleanupMask(pix, w, h) {
  const n = w * h;
  // hole fill
  const outside = new Uint8Array(n);
  const stack = [];
  const push = (i) => {
    if (!outside[i] && pix[i * 4 + 3] === 0) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i / w) | 0;
    for (const [dx, dy] of NEIGH4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      push(ny * w + nx);
    }
  }
  for (let i = 0; i < n; i++) if (pix[i * 4 + 3] === 0 && !outside[i]) pix[i * 4 + 3] = 255;

  // largest opaque component
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
  if (best !== -1) for (let i = 0; i < n; i++) if (pix[i * 4 + 3] !== 0 && label[i] !== best) pix[i * 4 + 3] = 0;

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
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || pix[(ny * w + nx) * 4 + 3] === 0) {
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

function floodWhite(pix, w, h) {
  const n = w * h;
  const visited = new Uint8Array(n);
  const queue = [];
  const isBg = (i) => {
    const o = i * 4;
    if (pix[o + 3] === 0) return true;
    return whiteDist(pix[o], pix[o + 1], pix[o + 2]) <= WHITE_TOL;
  };
  const seed = (x, y) => {
    const i = y * w + x;
    if (!visited[i] && isBg(i)) {
      visited[i] = 1;
      queue.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }
  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i / w) | 0;
    pix[i * 4 + 3] = 0;
    for (const [dx, dy] of NEIGH4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (!visited[ni] && isBg(ni)) {
        visited[ni] = 1;
        queue.push(ni);
      }
    }
  }
}

async function processSpan(srcBuf, left, right, h, outPath) {
  const cw = right - left;
  const { data, info } = await sharp(srcBuf)
    .extract({ left, top: 0, width: cw, height: h })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pix = new Uint8Array(data);
  floodWhite(pix, info.width, info.height);
  cleanupMask(pix, info.width, info.height);

  const tmp = outPath + ".tmp.png";
  await sharp(Buffer.from(pix), { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(tmp);
  await sharp(tmp)
    .trim({ threshold: 10 })
    .blur(0.8)
    .resize({ width: info.width * 3, fit: "inside", kernel: "lanczos3", withoutEnlargement: false })
    .sharpen({ sigma: 0.6 })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  fs.unlinkSync(tmp);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Source not found:", SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(ALL_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const srcBuf = fs.readFileSync(SRC);
  const meta = await sharp(srcBuf).metadata();
  const { data, info } = await sharp(srcBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const spans = segmentColumns(data, info.width, info.height).map(([a, b]) => [
    Math.max(0, a - SPAN_PAD),
    Math.min(info.width, b + SPAN_PAD),
  ]);
  console.log(`detected ${spans.length} characters:`, spans.map((s) => s.join("-")).join(", "));

  // back up current defaults once
  for (let slot = 0; slot < 4; slot++) {
    const cur = path.join(OUT_DIR, `char-${slot}.png`);
    const bak = path.join(BACKUP_DIR, `char-${slot}.png`);
    if (fs.existsSync(cur) && !fs.existsSync(bak)) fs.copyFileSync(cur, bak);
  }

  for (let i = 0; i < spans.length; i++) {
    await processSpan(srcBuf, spans[i][0], spans[i][1], meta.height, path.join(ALL_DIR, `char-${i}.png`));
  }
  SELECT.forEach((srcIdx, slot) => {
    fs.copyFileSync(path.join(ALL_DIR, `char-${srcIdx}.png`), path.join(OUT_DIR, `char-${slot}.png`));
    console.log(`detected #${srcIdx + 1} -> char-${slot}.png`);
  });
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
