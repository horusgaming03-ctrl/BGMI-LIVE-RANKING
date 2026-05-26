# Overlay admin & OBS overlays

## First-time install

From the repo root:

```bash
npm install
cd client && npm install && cd ..
```

## Development (`/overlay/themes` on port **5173**)

`ERR_CONNECTION_REFUSED` means **nothing is listening on 5173** — usually **Vite is not running** or **`client`** dependencies were never installed.

Start **API + Vite together** from the **repository root**:

```bash
npm run dev
```

Keep that terminal open. Then open:

- **Theme preview:** http://127.0.0.1:5173/overlay/themes  
- **Admin:** http://127.0.0.1:5173/admin  

Prefer **`127.0.0.1`** instead of **`localhost`** on Windows if IPv6 causes odd connection issues.

If `npm run dev` prints **`Missing Vite`**, run `cd client && npm install`, then **`npm run dev`** again.

### Frontend only (API must still run separately for data)

```bash
npm run dev:vite
```

You still need the Node API (**`npm run dev:api`**) on **3001** for `/api`, uploads, and Socket.IO.

## Single-port (no dev server — built UI)

```bash
npm run start:app
```

Opens the app from **Node** only, e.g. http://127.0.0.1:3001/overlay/themes (port from your `PORT` env, default **3001**).

## Useful scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | API on **3001** + Vite on **5173** |
| `npm run dev:api` | API only (**SERVE_SPA=false**) |
| `npm run dev:vite` | Vite only (in `./client`) |
| `npm run start:app` | Build client + serve **everything** from **3001** |
| `npm start` | API + serves **built** client if **`client/dist`** exists |

## Overlay engine (OBS)

See **`docs/OVERLAY_ENGINE.md`** for themes, separate `/overlay/...` URLs, the shared PNG triple-slot, live socket data, and how that compares to a future “static theme folder” (`index.html` + `layout.json`) workflow.
