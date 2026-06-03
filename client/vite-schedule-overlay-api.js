import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const CONFIG_FILE = path.join(REPO_ROOT, "data", "schedule-overlay-config.json");
const UPLOAD_DIR = path.join(REPO_ROOT, "uploads", "schedule-overlay");

function ensureDirs() {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureDirs();
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "") || ".jpg";
      const low = ext.toLowerCase();
      const videoExt = [".mp4", ".webm", ".mov", ".m4v", ".ogg"];
      const imageExt = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];
      const isVid = (file.mimetype || "").startsWith("video/") || videoExt.includes(low);
      const safe = isVid
        ? videoExt.includes(low)
          ? low
          : ".mp4"
        : imageExt.includes(low)
          ? low
          : ".jpg";
      cb(null, `schedule-bg-${Date.now()}${safe}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

/** Dev-only schedule overlay API (works even if Node API was started before routes existed). */
export function scheduleOverlayApiPlugin() {
  return {
    name: "schedule-overlay-api",
    configureServer(server) {
      ensureDirs();

      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || "").split("?")[0];

        if (pathname === "/api/schedule-of-the-match/config") {
          if (req.method === "GET") {
            res.setHeader("Content-Type", "application/json");
            if (!fs.existsSync(CONFIG_FILE)) {
              res.end(JSON.stringify({ empty: true }));
              return;
            }
            res.end(fs.readFileSync(CONFIG_FILE, "utf8"));
            return;
          }
          if (req.method === "POST") {
            const chunks = [];
            req.on("data", (c) => chunks.push(c));
            req.on("end", () => {
              try {
                const body = Buffer.concat(chunks).toString("utf8");
                JSON.parse(body);
                fs.writeFileSync(CONFIG_FILE, body, "utf8");
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, savedAt: Date.now() }));
              } catch (e) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ message: e.message || "Invalid JSON" }));
              }
            });
            return;
          }
        }

        if (pathname === "/api/schedule-of-the-match/upload-background" && req.method === "POST") {
          upload.single("background")(req, res, (err) => {
            if (err) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ message: err.message || "Upload failed" }));
              return;
            }
            if (!req.file) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ message: 'No file — field name must be "background".' }));
              return;
            }
            res.setHeader("Content-Type", "application/json");
            const isVideo = (req.file.mimetype || "").startsWith("video/");
            res.end(
              JSON.stringify({
                url: `/uploads/schedule-overlay/${req.file.filename}`,
                ok: true,
                mediaType: isVideo ? "video" : "image",
              }),
            );
          });
          return;
        }

        next();
      });
    },
  };
}
