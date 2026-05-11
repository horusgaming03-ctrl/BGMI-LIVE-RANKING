/**
 * Builds client/public/wwcd/char-0..3.png from source assets.
 * - Nukes near-black (studio backgrounds)
 * - Flood-fills light grey / white / checkerboard from image edges (conservative)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(
  process.env.WWCD_ASSETS ||
    path.join(process.env.USERPROFILE || "", ".cursor/projects/c-Users-anujt-OneDrive-Desktop-my-node-app/assets"),
);
const OUT_DIR = path.join(ROOT, "client/public/wwcd");

const BLACK_MAX = 48;
/** Edge-seeded flood: treat as “background” when luminance high and colour is greyish */
const EDGE_LUM_MIN = 186;
const EDGE_SAT_MAX = 0.22;
const FLOOD_LUM_MIN = 168;
const FLOOD_SAT_MAX = 0.26;
const NEIGH_TOL = 42;

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function sat(r, g, b) {
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  if (mx <= 0.001) return 0;
  return (mx - mn) / mx;
}

function isBlack(r, g, b) {
  return r <= BLACK_MAX && g <= BLACK_MAX && b <= BLACK_MAX;
}

function isEdgeSeed(r, g, b) {
  if (isBlack(r, g, b)) return true;
  const L = lum(r, g, b);
  const S = sat(r, g, b);
  return L >= EDGE_LUM_MIN && S <= EDGE_SAT_MAX;
}

function isFloodContinue(r, g, b) {
  if (isBlack(r, g, b)) return true;
  const L = lum(r, g, b);
  const S = sat(r, g, b);
  return L >= FLOOD_LUM_MIN && S <= FLOOD_SAT_MAX;
}

function colorDist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function processRgba(data, w, h) {
  const pix = new Uint8Array(data);
  const transparent = new Uint8Array(w * h);

  // Pass 1: remove black backdrop
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const r = pix[o],
      g = pix[o + 1],
      b = pix[o + 2];
    if (isBlack(r, g, b)) transparent[i] = 1;
  }

  // Pass 2: flood from edges through light studio / checkerboard
  const visited = new Uint8Array(w * h);
  const q = [];

  const trySeed = (x, y) => {
    const i = y * w + x;
    if (transparent[i] || visited[i]) return;
    const o = i * 4;
    const r = pix[o],
      g = pix[o + 1],
      b = pix[o + 2];
    if (!isEdgeSeed(r, g, b)) return;
    visited[i] = 1;
    q.push(i);
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  const neigh = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (q.length) {
    const i = q.shift();
    const x = i % w;
    const y = (i / w) | 0;
    transparent[i] = 1;
    const o = i * 4;
    const pcol = [pix[o], pix[o + 1], pix[o + 2]];

    for (const [dx, dy] of neigh) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (transparent[ni] || visited[ni]) continue;
      const no = ni * 4;
      const nr = pix[no],
        ng = pix[no + 1],
        nb = pix[no + 2];
      if (isFloodContinue(nr, ng, nb) && colorDist(pcol, [nr, ng, nb]) <= NEIGH_TOL * 3) {
        visited[ni] = 1;
        q.push(ni);
      }
    }
  }

  for (let i = 0; i < w * h; i++) {
    if (transparent[i]) pix[i * 4 + 3] = 0;
  }
  return pix;
}

async function buildOne(srcPath, destPath) {
  const buf = fs.readFileSync(srcPath);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error("expected RGBA");
  const processed = processRgba(data, info.width, info.height);
  await sharp(Buffer.from(processed), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(destPath + ".tmp");

  await sharp(destPath + ".tmp").trim().png().toFile(destPath);
  fs.unlinkSync(destPath + ".tmp");
}

function pickAsset(dir, re) {
  const files = fs.readdirSync(dir);
  const f = files.find((n) => re.test(n));
  if (!f) throw new Error(`No asset matching ${re} in ${dir}`);
  return path.join(dir, f);
}

async function main() {
  if (!fs.existsSync(ASSETS)) {
    console.error("Assets folder not found:", ASSETS);
    console.error("Set WWCD_ASSETS to the folder with your Cursor-saved PNGs.");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jobs = [
    { out: "char-0.png", re: /image-ce5447f7-822c-4a5b-850b-a67495ba9ee7/ },
    { out: "char-1.png", re: /image-fd62d157-7a91-4b13-ae2c-14f9a5d97240/ },
    { out: "char-2.png", re: /military-man-aiming.*006ffab8/ },
    { out: "char-3.png", re: /a4b74dd170908ee0fb663d5aaf2bdb18-48bc02fd/ },
  ];

  for (const { out, re } of jobs) {
    const src = pickAsset(ASSETS, re);
    const dest = path.join(OUT_DIR, out);
    console.log(out, "<=", path.basename(src));
    await buildOne(src, dest);
  }
  console.log("Done →", OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
