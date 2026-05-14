/** API + Socket.IO only — no React static files (use client/ separately for CSR). */
process.env.SERVE_SPA = "false";
require("../backend-bgm/index.js");
