# SCHEDULE OF THE MATCH

Standalone **BGMI / PUBG–style tournament schedule overlay** for OBS Browser Source.  
This package is **fully separate** from the main `client/` app — no existing project files were modified.

## Folder structure

```
schedule-of-the-match/
├── admin.html              # Browser admin panel
├── overlay.html            # OBS browser source (1920×1080, transparent)
├── README.md
├── config/
│   └── default-config.json # Default JSON schema + sample data
├── css/
│   ├── admin.css
│   ├── overlay.css
│   └── animations.css      # 8 GPU-friendly reveal modes
├── js/
│   ├── admin.js
│   ├── overlay.js
│   ├── config-store.js     # localStorage + BroadcastChannel sync
│   ├── map-catalog.js
│   └── animations.js
└── assets/
    ├── maps/               # SVG placeholders (replace with real map JPG/PNG)
    │   ├── erangel.svg
    │   ├── miramar.svg
    │   ├── rondo.svg
    │   ├── sanhok.svg
    │   ├── vikendi.svg
    │   ├── livik.svg
    │   └── nusa.svg
    └── badges/
        ├── wwcd-chicken.png   # official WWCD GFX
        └── wwcd-trophy.svg    # legacy
```

## URL structure (local server)

Serve this folder with any static HTTP server (required for ES modules + JSON fetch).

From repo root:

```bash
npx --yes serve schedule-of-the-match -p 8765
```

| Page | URL |
|------|-----|
| **Admin** | `http://localhost:8765/admin.html` |
| **OBS overlay** | `http://localhost:8765/overlay.html` |

### OBS Browser Source settings

| Setting | Value |
|---------|--------|
| URL | `http://localhost:8765/overlay.html` (or your host/port) |
| Width | `1920` |
| Height | `1080` |
| Custom CSS (optional) | `body { background: transparent !important; }` |

The overlay canvas is **transparent** by default. Upload a **custom background** in the admin panel; it renders **behind** the match cards only.

## Real-time updates

- Config is stored in `localStorage` key: `schedule-of-the-match-config`
- Admin saves → overlay updates via `storage` event + `BroadcastChannel`
- Export / import full JSON from admin

## JSON configuration

Edit `config/default-config.json` or use admin **Export JSON**. Main fields:

| Section | Fields |
|---------|--------|
| `header` | title, subtitle, fonts, colors, sizes, position `{x,y}` |
| `background` | imageUrl (data URL or http URL), opacity, fit |
| `theme` | card colors, border, accent, map label styling |
| `animation` | type, speed, enabled, replayKey |
| `matchCount` | 1–8 |
| `matches[]` | per-card match/time/map/logo/WWCD/rank |
| `winner` | matchIndex, teamLogoUrl, teamInitials, showChickenDinner |

### Map dropdown keys

`erangel` · `miramar` · `rondo` (bundled JPG screenshots)

Preset art loads from `assets/maps/`. Override per match with `mapImageUrl` or admin upload.

## Animations

| ID | Mode |
|----|------|
| `flip` | 3D flip reveal |
| `shutter` | Alternating top/bottom shutter |
| `slideUp` | Slide up |
| `slideDown` | Slide down |
| `fadeScale` | Fade + scale |
| `staggered` | Staggered reveal (default) |
| `glassWipe` | Glass wipe |
| `energySweep` | Energy sweep |

Speed: `0.25` – `3` (multiplier). Use **Replay animation** in admin to re-trigger.

## Chicken Dinner (WWCD)

1. Set **Winner match slot** (0 = first card, 1 = second, …).
2. Enable **Show WWCD on finished match** — uses official yellow chicken GFX (`assets/badges/wwcd-chicken.png`).
3. Edit **Group label** (e.g. `GROUP - A&B`) and match number on the card.
4. Optional: upload your own WWCD PNG under **Chicken Dinner / Winner**.
3. Upload team logo on that match card.
4. Optional team initials in footer (orange).

## Custom map screenshots

Replace SVG placeholders with your own files (same basename), e.g.:

- `assets/maps/erangel.jpg`
- Update `map-catalog.js` `asset` paths if you use JPG.

Or upload overrides in admin (stored as data URLs in JSON).

## Fonts (Google Fonts)

Bebas Neue, Anton, Teko, Oswald, Rajdhani, Orbitron, Exo 2 (+ Agency FB / Eurostile labels in admin; falls back to system sans if not loaded).

## Group labels

**Removed by design** — no GROUP A&B / B&C labels on cards.

## Section name

Product section title: **SCHEDULE OF THE MATCH** (`data-section` on overlay, admin heading).
