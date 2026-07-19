# Golden Gate Bridge — 3D Interactive Flyover

A photorealistic-leaning, fully procedural 3D model of the Golden Gate Bridge built
with [three.js](https://threejs.org). No external 3D assets or textures — every
geometry and texture is generated in code, at true real-world scale (1,280 m main
span, 227 m towers, suspenders every 15 m).

Fly freely around the bridge, sweep the sun through a full day/night cycle
(golden-hour glow, stars, amber floodlit towers at night), and roll San
Francisco's marine-layer fog through the Gate.

## Run locally

The three.js runtime is vendored in [`vendor/`](vendor/), so there is nothing to
install — just serve the folder over HTTP:

```bash
python3 -m http.server 5173        # or: npx serve -l 5173
# open http://localhost:5173
```

Any static file server works. A plain `file://` open will **not** work — ES
modules require HTTP.

## Controls

| Input | Action |
|---|---|
| Click canvas | capture mouse (Esc to release) |
| Mouse | look around |
| `W A S D` / arrows | fly forward / left / back / right |
| `Space` / `E` | ascend |
| `Shift` / `Q` | descend |
| `Ctrl` / `F` | speed boost |
| Scroll wheel | adjust base speed |

The panel (top right) has a **time-of-day** slider, a **fog** slider (clear to
full marine layer with drifting fog banks), scene presets (*Noon, Golden hour,
Night, Foggy morning*), and traffic/shadow toggles.

## Deploy to Cloudflare

The site is 100 % static with no build step, which makes deployment trivial.

### Option A — Cloudflare dashboard (connected to GitHub)

1. In the [Cloudflare dashboard](https://dash.cloudflare.com), go to
   **Workers & Pages → Create → Pages → Connect to Git**.
2. Select this repository and use these settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
3. Click **Save and Deploy**. Your site goes live at
   `https://<project-name>.pages.dev`, and every push to `main` redeploys
   automatically.

### Option B — Wrangler CLI (one command, no git integration)

```bash
npx wrangler login                                        # first time only
npx wrangler pages deploy . --project-name golden-gate-bridge
```

Wrangler uploads the folder (it skips `node_modules/` automatically; the app
only needs `index.html`, `style.css`, `js/`, and `vendor/`) and prints the
`*.pages.dev` URL when done.

## How it's built

- **Bridge** ([js/bridge.js](js/bridge.js)) — parabolic main cables as tube
  geometry, instanced suspenders/truss/railings/lamps, stepped Art Deco tower
  portals, anchorages, approach viaducts. International Orange `#C0362C`.
- **Environment** ([js/environment.js](js/environment.js)) — three.js `Sky`
  atmosphere driven by sun position, `Water` ocean shader, noise-displaced
  terrain for the Marin Headlands and Presidio, procedural SF skyline with lit
  windows, `FogExp2` + sky-occluding fog dome + drifting sprite fog banks.
  A PMREM environment map is regenerated from the sky as the sun moves.
- **Textures** ([js/textures.js](js/textures.js)) — canvas-generated asphalt with
  lane markings, concrete, water normal map, window grids, glow sprites.
- **Traffic** ([js/traffic.js](js/traffic.js)) — instanced cars in 6 lanes.
- **Controls** ([js/controls.js](js/controls.js)) — pointer-lock mouse look with
  a drag fallback, velocity-damped WASD flight.

Performance: ~107 draw calls / ~280 k triangles via instancing — comfortably
60 fps on integrated GPUs.

### Updating three.js

`vendor/three/` holds copies of `three.module.js`, `three.core.js`, and the
`Sky`/`Water` addons from the npm package pinned in [package.json](package.json).
To upgrade:

```bash
npm install three@latest
cp node_modules/three/build/three.{module,core}.js vendor/three/
cp node_modules/three/examples/jsm/objects/{Sky,Water}.js vendor/three/addons/objects/
```

Debug handle: `window.GG` exposes `renderer`, `scene`, `camera`, `env`,
`controls`, and `step(dt)` for driving frames manually.
