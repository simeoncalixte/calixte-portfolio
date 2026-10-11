# Floating Islands — 3D Portfolio

An explorable three.js portfolio: walk a hooded adventurer across sunset floating islands connected by rope bridges. Each island is a section — **About** (glass house), **Projects** (screen plaza), **Skills** (glowing orb), **Contact** (portal).

Two scenic islands extend the walking routes: **Grove**, a lantern-lit wooded island west of Home with bridges to Home and Projects, and **Lookout**, a telescope viewpoint east of Skills. Both include terrain, vegetation, collision, and minimap coverage.

**Dark Past** lies west of Grove, across a long, cool-lit bridge. Its span is the Home–Projects bridge length multiplied by fractional calendar years since June 21, 2011 (about 15.30× on October 10, 2026). The multiplier is calculated when the world loads; it grows on subsequent visits. The sparse island has weathered stone markers and dead wood. Crossing toward it gradually brings overcast skies, dense cool fog, dimmer lighting, and muted colors; returning restores the sunset. June 21 is the chosen summer start, and the bridge has a minimum 1× span for dates before the first anniversary.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/ (editor stripped)
npm run preview  # serve dist/
```

## Controls
| Input | Action |
|---|---|
| `W / S` | move forward / backward relative to the player’s facing direction |
| `A / D` | turn left / right, including while standing still |
| `← →` / `↑ ↓` | rotate / tilt camera; holds the chosen angle while following the player |
| `C` | resume automatic camera follow from behind |
| `Shift` | run |
| `Space` | jump |
| mouse drag / click to lock | look around · wheel to zoom |
| `E` | open the section when near a beacon |
| `1`–`4` or top nav | fast-travel |
| `H` | help · `Esc` close panels |
| touch | left-side joystick, drag right side to look, JUMP / E buttons |

## Editor (development only)
Press **`` ` ``** or **F2** while `npm run dev` is running.

- Click any landmark / signpost / lantern / imported model to select it; **G / R / S** move / rotate / scale, **F** focus, **Del** delete imported, **Ctrl+D** duplicate.
- **Asset library** — place any model in `MODEL_LIBRARY` (`src/core/assets.js`).
- **Import** — pick or drag-drop a local `.glb`, or paste a direct `.glb` URL (e.g. a `static.poly.pizza/<id>.glb` link). Files are saved into `public/assets/imported/`.
- **Save** writes `public/layout.json`, which is applied on startup in dev *and* production, so placements ship with the build. The editor code itself is never bundled (`import.meta.env.DEV` dynamic import + dev-server-only endpoints in `vite.config.js`).

## Where things live
| Path | What |
|---|---|
| `src/world/layout.js` | island positions/sizes, bridge list, spawn, sun direction |
| `src/world/walkable.js` | walkable area (island tops + bridge decks) — you can't fall off |
| `src/player/player.js` | character, animation blending, procedural jump, follow camera |
| `src/world/landmarks.js` | the four set-pieces + project list |
| `src/ui/content.js` | panel copy (About/Projects/Skills/Contact) — **edit your details here** |
| `src/core/fog.js`, `src/core/post.js` | lighting tricks: sun-aware height fog, bloom, ACES, colour grade |

## Lighting tricks used
- Painted sky-dome shader (gradient, sun disc, lit FBM clouds, stars) + HDRI only for reflections/ambient.
- Key light raised above the visual sun so islands catch light while the sky reads as sunset; cool blue fill + warm rim lights.
- Patched fog chunks: fog turns orange towards the sun and thickens with depth (aerial perspective + cloud sea).
- Emissive "fake lights" (bridge bulbs, windows, screens, beams) driven through bloom instead of real lights.
- Texel-snapped 4K shadow map that follows the player; NaN-safe HDR pipeline; adaptive resolution for steady FPS.

Asset licenses and attributions: see [CREDITS.md](CREDITS.md).

### Ghost signs on the Dark Past crossing

Six floating ghosts hold blank signs beside the bridge. To add your text, edit the strings in `src/world/pastMessages.js`, ordered from Grove toward Dark Past, then save and reload. Use `\n` for line breaks; short messages under 160 characters read best. Add or remove entries to change the number of ghosts. Their placement follows the bridge as its length grows, and their signs can be read from both sides.

Ghosts fade in within 18 metres only while the character faces toward Dark Past. You can stop to read; turning back or passing a ghost fades it out. Camera rotation does not trigger them. The island contains an iron prison with a barred roof, sliding gate, stone foundation, and collision; vegetation stays clear of it.

### Dog and Batman

A textured, skinned mastiff dog from Wildfire Games (CC BY-SA 3.0), with blended idle animation and speed-matched locomotion, spawns at a random clear location on a randomly selected island other than Dark Past each time the world loads. It hunts toward the player using terrain and bridge paths at **2.72 m/s** (80% of the player's walking speed). Within one Home–Projects bridge length (about **38.2 m**), it chases at up to **6.08 m/s** (80% of the player's running speed). It can follow across islands, including Dark Past after spawning elsewhere. It avoids static obstacles and stops 2.4 metres from the player; no damage or combat is added. Camera movement does not affect its behavior.

A custom LEGO-style Batman minifigure waits inside the Dark Past prison. Approach the gate and press **E**, or tap the touch **E** button, to unlock it. The lock disappears, the gate slides open, and the player can walk onto the cell floor. Batman waves when freed. The gate stays open for the current visit and resets when the page reloads.

Batman is defined in `src/world/characters.js`; the dog model integration is in `src/world/dogModel.js`; dog behavior and navigation are in `src/world/dog.js`; the cell and unlock interaction are in `src/world/prison.js`. Run the gameplay checks with `node --test tests/gameplay.test.js`.

Dog visual preview: `/tests/dog-preview.html` on the Vite dev server. Asset conversion: `node scripts/convert-dog.mjs <source-directory> <linkedom-module-path>`; see `public/assets/character/dog/SOURCE.md` for the original source paths.

## Personal experience gallery

The **Experience** navigation item leads to six interactive exhibits on the former projects island. Approach a display and press **E** to explore that role, or use the image cards in the gallery panel. Animated miniatures represent console/frontend work, connected services, data signals, teaching, inventory integration, and cloud migration. Every chapter includes dates, employer/contract relationships, selected responsibilities, and source-linked company imagery.

Edit résumé-backed facts in `src/experience.js`; edit the exhibits in `src/world/experienceGallery.js` and the detail panels in `src/ui/content.js`. Image provenance is in `public/assets/experience/sources.json` and `CREDITS.md`. Current brand imagery is illustrative context, not a claim that Calixte built the pictured product. The contact panel opens an email draft using Calixte's résumé email and links to his GitHub and LinkedIn.

Run all gameplay, asset, and experience checks with `node --test tests/*.test.js`.

## Skills island

Four illuminated, double-sided displays show Calixte's résumé skills directly in the 3D world: Interfaces, Services, Data, and Delivery. Each has an animated symbol and a moving connection to the central orb. Approach a workbench and press **E** to open its skills and related experience chapters. Edit the technology lists in `src/experience.js` and display geometry in `src/world/skillsIsland.js`.

## Interest island

**Interest** is connected to About by a bridge. The complete Schema-on-Read Observatory is native 3D geometry on the island: 40 nodes, 192 document cells, connections, moving packets, vector processing, review/retry animations, and database layers. Walk through it with the existing game controls, or select **Interest** (key **5**) to travel there. There is no portal, iframe, separate camera, source HUD, background, star field, floor, or table platform.

The source `/Users/simeon/Projects/TestPost/output/index.html` is unchanged. Its geometry and animation are ported to `src/world/observatoryScene.js`; island scale and placement are in `src/world/interestIsland.js`. The island is wider with a clear central area for the full installation. The game’s terrain, sky, lighting, and camera remain in use.

## GitHub Pages

The portfolio deploys automatically from `main` using `.github/workflows/pages.yml`.
The workflow runs the tests, builds with Vite using the Pages project path, and publishes `dist`.

- Repository: https://github.com/simeoncalixte/calixte-portfolio
- Site: https://simeoncalixte.github.io/calixte-portfolio/

To check the project-path build locally:

```sh
VITE_BASE_PATH=/calixte-portfolio/ npm run build
npm run preview
```

Public models, textures, and images are included in the repository. See `CREDITS.md` and asset source manifests for attribution and licenses. The development editor's save/upload endpoints are only available through the local Vite server; GitHub Pages hosts the static portfolio.
