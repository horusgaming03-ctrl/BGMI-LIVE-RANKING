import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const SCHEDULE_CONFIG_FILE = path.join(REPO_ROOT, "data", "schedule-overlay-config.json");
const SCHEDULE_UPLOAD_DIR = path.join(REPO_ROOT, "uploads", "schedule-overlay");
const WWCD_STATUS_CONFIG_FILE = path.join(REPO_ROOT, "data", "wwcd-status-config.json");
const WWCD_STATUS_UPLOAD_DIR = path.join(REPO_ROOT, "uploads", "wwcd-status");
const OVERALL_STANDING_CONFIG_FILE = path.join(REPO_ROOT, "data", "overall-standing-config.json");
const OVERALL_STANDING_UPLOAD_DIR = path.join(REPO_ROOT, "uploads", "overall-standing");
const TOP_FRAGGERS_CONFIG_FILE = path.join(REPO_ROOT, "data", "top-fraggers-config.json");
const TOP_FRAGGERS_UPLOAD_DIR = path.join(REPO_ROOT, "uploads", "top-fraggers");

const VIDEO_EXT = [".mp4", ".webm", ".mov", ".m4v", ".ogg"];
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];

function ensureOverlayDirs(configFile, uploadDir) {
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
}

function makeOverlayUpload(uploadDir, filenamePrefix) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "") || ".jpg";
        const low = ext.toLowerCase();
        const isVid = (file.mimetype || "").startsWith("video/") || VIDEO_EXT.includes(low);
        const safe = isVid
          ? VIDEO_EXT.includes(low)
            ? low
            : ".mp4"
          : IMAGE_EXT.includes(low)
            ? low
            : ".jpg";
        cb(null, `${filenamePrefix}-${Date.now()}${safe}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
  });
}

const scheduleUpload = makeOverlayUpload(SCHEDULE_UPLOAD_DIR, "schedule-bg");
const wwcdStatusUpload = makeOverlayUpload(WWCD_STATUS_UPLOAD_DIR, "wwcd-status");
const overallStandingUpload = makeOverlayUpload(OVERALL_STANDING_UPLOAD_DIR, "overall-standing");
const overallStandingAssetUpload = makeOverlayUpload(OVERALL_STANDING_UPLOAD_DIR, "overall-standing-asset");
const topFraggersUpload = makeOverlayUpload(TOP_FRAGGERS_UPLOAD_DIR, "top-fraggers");

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function handleConfigGet(res, configFile) {
  res.setHeader("Content-Type", "application/json");
  if (!fs.existsSync(configFile)) {
    res.end(JSON.stringify({ empty: true }));
    return;
  }
  res.end(fs.readFileSync(configFile, "utf8"));
}

async function handleConfigPost(req, res, configFile) {
  try {
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object") throw new Error("Invalid JSON");
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify(body, null, 2), "utf8");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, savedAt: Date.now() }));
  } catch (e) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: e.message || "Invalid JSON" }));
  }
}

function handleBackgroundUpload(res, upload, uploadsSubdir, err, file) {
  if (err) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: err.message || "Upload failed" }));
    return;
  }
  if (!file) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: 'No file — field name must be "background".' }));
    return;
  }
  res.setHeader("Content-Type", "application/json");
  const isVideo = (file.mimetype || "").startsWith("video/");
  res.end(
    JSON.stringify({
      url: `/uploads/${uploadsSubdir}/${file.filename}`,
      ok: true,
      mediaType: isVideo ? "video" : "image",
    }),
  );
}

/** Dev-only overlay APIs (schedule + WWCD STATUS) — works without backend route reload. */
export function scheduleOverlayApiPlugin() {
  return {
    name: "schedule-overlay-api",
    configureServer(server) {
      ensureOverlayDirs(SCHEDULE_CONFIG_FILE, SCHEDULE_UPLOAD_DIR);
      ensureOverlayDirs(WWCD_STATUS_CONFIG_FILE, WWCD_STATUS_UPLOAD_DIR);
      ensureOverlayDirs(OVERALL_STANDING_CONFIG_FILE, OVERALL_STANDING_UPLOAD_DIR);
      ensureOverlayDirs(TOP_FRAGGERS_CONFIG_FILE, TOP_FRAGGERS_UPLOAD_DIR);

      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || "").split("?")[0];

        if (pathname === "/api/schedule-of-the-match/config") {
          if (req.method === "GET") {
            handleConfigGet(res, SCHEDULE_CONFIG_FILE);
            return;
          }
          if (req.method === "POST") {
            void handleConfigPost(req, res, SCHEDULE_CONFIG_FILE);
            return;
          }
        }

        if (pathname === "/api/schedule-of-the-match/upload-background" && req.method === "POST") {
          scheduleUpload.single("background")(req, res, (err) => {
            handleBackgroundUpload(res, scheduleUpload, "schedule-overlay", err, req.file);
          });
          return;
        }

        if (pathname === "/api/wwcd-status/config") {
          if (req.method === "GET") {
            handleConfigGet(res, WWCD_STATUS_CONFIG_FILE);
            return;
          }
          if (req.method === "POST") {
            void handleConfigPost(req, res, WWCD_STATUS_CONFIG_FILE);
            return;
          }
        }

        if (pathname === "/api/wwcd-status/upload-background" && req.method === "POST") {
          wwcdStatusUpload.single("background")(req, res, (err) => {
            handleBackgroundUpload(res, wwcdStatusUpload, "wwcd-status", err, req.file);
          });
          return;
        }

        if (pathname === "/api/overall-standing/config") {
          if (req.method === "GET") {
            handleConfigGet(res, OVERALL_STANDING_CONFIG_FILE);
            return;
          }
          if (req.method === "POST") {
            void handleConfigPost(req, res, OVERALL_STANDING_CONFIG_FILE);
            return;
          }
        }

        if (pathname === "/api/overall-standing/upload-background" && req.method === "POST") {
          overallStandingUpload.single("background")(req, res, (err) => {
            handleBackgroundUpload(res, overallStandingUpload, "overall-standing", err, req.file);
          });
          return;
        }

        if (pathname === "/api/overall-standing/upload-asset" && req.method === "POST") {
          overallStandingAssetUpload.single("asset")(req, res, (err) => {
            if (err) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ message: err.message || "Upload failed" }));
              return;
            }
            if (!req.file) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ message: 'No file — field name must be "asset".' }));
              return;
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ url: `/uploads/overall-standing/${req.file.filename}`, ok: true }));
          });
          return;
        }

        if (pathname === "/api/top-fraggers/config") {
          if (req.method === "GET") {
            handleConfigGet(res, TOP_FRAGGERS_CONFIG_FILE);
            return;
          }
          if (req.method === "POST") {
            void handleConfigPost(req, res, TOP_FRAGGERS_CONFIG_FILE);
            return;
          }
        }

        if (pathname === "/api/top-fraggers/upload-background" && req.method === "POST") {
          topFraggersUpload.single("background")(req, res, (err) => {
            handleBackgroundUpload(res, topFraggersUpload, "top-fraggers", err, req.file);
          });
          return;
        }

        next();
      });
    },
  };
}
