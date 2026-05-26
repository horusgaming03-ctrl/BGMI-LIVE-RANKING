# Esports overlay engine — architecture & roadmap

This repository implements a **broadcast-style overlay stack for OBS** using a **React SPA**, **Socket.IO + REST** for live tournament data, and **separate browser-source URLs** per surface. The following maps your product spec to what exists today and what would be added for a full “Theme_Folder per package” static workflow.

## What works today (OBS + live data)

| Capability | Implementation |
|------------|----------------|
| **Separate OBS URLs** | React routes under `/overlay/...` (see `client/src/App.jsx` and `overlay-engine/EngineCatalog.jsx`). |
| **Shared live data** | `socket` events (`teamsUpdated`, `matchUpdated`, `settingsUpdated`, etc.) + `GET /teams`, `GET /settings` from `backend-bgm`. |
| **Multiple visual packages** | Broadcast engine: **theme × design × alive style × animation pack** (`BroadcastEngineOverlay.jsx`, `themes/`, `designs/`). Legacy themed board: `ThemedOverlay.jsx` + query params. |
| **Modular surfaces** | WWCD, elimination, side banner, zone prediction, announcements, finish badges, Rondo variants, **OBS PNG triple slot** (`ObsSharedTripleSlotOverlay.jsx`), **`/overlay/bgmi-layered-ranking`** (+ split **`/overlay/bgmi-layered-rows`** & **`/overlay/bgmi-layer-plate/:slug`** in `ObsBgmiLayeredRankingOverlay.jsx`), etc. |
| **GPU-friendly motion** | CSS transforms/opacity; animation packs in `overlay-engine/animations/`. |
| **Low-latency refresh** | Socket push; optional HTTP pull on connect. |

## OBS PNG triple slot (shared backdrop + live rows)

- **URLs:** `/overlay/obs-slot/eliminations`, `/overlay/obs-slot/top-four`, `/overlay/obs-slot/live-ranking` (same PNG asset; different row filters).
- **Data:** Same team list as the admin live dashboard.
- **Layout:** Column mode and FP source persisted in settings; URL query overrides: `?columns=gold4|live5`, `?fp=pts|kills`, `?top=&left=&w=&h=&cap=`, `?theme=dark|gold`, `?debug=1`.
- **Note:** PNG pixels are **not** auto-analyzed for labels; pick the column layout that matches your art.

Team logos in the overlay use **`object-fit: cover`** in fixed slots sized for **1080p-class** readability; oversized transparent canvases still look weak until the artwork is cropped in the PNG.

## BGMI layered ranking (three PNG plates + live data rows)

There are exactly **three** decoration slots: **live ranking overlay**, **eliminator**, **top‑4 alive strip**.

- **Combined (one browser source):** `/overlay/bgmi-layered-ranking` — all **visible** plates plus the table.
- **Split:**
  - **`/overlay/bgmi-layered-rows`** — table + team logos + `#` rank only (no plate PNGs).
  - **`/overlay/bgmi-layer-plate/<slug>`** — one plate only. Common slugs: `ranking`, `eliminator`, `top4` (aliases e.g. `strip` → top‑4 slot — see `BGMI_LAYER_PLATE_URL_ALIASES`).
- **Admin:** **OBS · 3 PNG layers** — uploads + layout; **Save layout** persists.
- **Cache:** OBS may cache bitmaps — refresh each browser source after re-upload.

## Gap vs “static Theme_Green folders” (`index.html` / `layout.json`)

The prompt asks for **self-contained folders** per theme (`index.html`, `style.css`, `script.js`, `layout.json`, `assets`). This repo centralizes overlays in **one build** with **many routes** instead of copying static trees.

**Bridging options (future):**

1. **Export bundles** — A build script emits `dist/themes/<id>/` with static HTML shells that embed the same API URL and websocket client (thin loader + your `layout.json`).
2. **layout.json-driven visibility** — Extend `EngineThemeContext` / row renderers to read a **declarative module map** (show/hide FIN vs TOTAL vs placement) merged with existing theme tokens.
3. **PNG auto-placement** — Would need either **convention-based asset paths** (`/uploads/theme-assets/<themeId>/ranking.png`) or **layout.json regions** (rects in normalized 0–1 space) + one compositor component.

## Data shape (illustrative)

Live team objects already carry fields such as: `team`, `points`, `finishes`, `alivePlayers`, `status`, `logo`, `eliminationRank`, Rondo recall fields where applicable. Normalization can be extended for **eliminator name**, **placement points**, **MVP**, etc., in `backend-bgm` and mirrored on the client.

## Performance

- Prefer **CSS** animation over layout-thrashing JS.
- Overlays use **memoized** lists where practical; avoid socket handlers that replace huge trees every tick.

## Related docs

- Root **`README.md`** — dev servers, ports, OBS URLs.

For a **full PMGC-class static theme pack**, treat this codebase as the **runtime + data hub** and add export/generation for static theme folders on top of the same websocket contract.
