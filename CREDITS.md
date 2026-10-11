# Asset credits

All third-party assets were downloaded from free sources. CC-BY assets **require attribution** — keep this file (or an equivalent credits link on the site) when you deploy.

## Poly Haven — CC0 (public domain) · https://polyhaven.com
Models (decimated + WebP-compressed into `public/assets/opt/`; originals in `asset-sources/polyhaven-originals/`):
- `rock_moss_set_01`, `rock_moss_set_02`, `rock_07`, `rock_face_01`, `namaqualand_cliff_01`
- `fern_02`, `shrub_02`, `tree_stump_01`, `dead_tree_trunk`, `Lantern_01`

Textures: `forrest_ground_01`, `rock_face_03`, `wood_planks_grey`

HDRI (image-based lighting): `qwantani_dusk_2_puresky`

## Poly Pizza · https://poly.pizza
| File | Model | Author | License |
|---|---|---|---|
| `character/adventurer.glb` | [Adventurer](https://poly.pizza/m/5EGWBMpuXq) | Quaternius | CC0 |
| `pp/pine_a.glb` | [Pine](https://poly.pizza/m/79gmlLnweB) | Quaternius | CC0 |
| `pp/pine_b.glb` | [Pine](https://poly.pizza/m/rfnxJv0Rqa) | Quaternius | CC0 |
| `pp/pine_c.glb` | [Pine](https://poly.pizza/m/igSu0cPoBz) | Quaternius | CC0 |
| `pp/pine_d.glb` | [Pine tree](https://poly.pizza/m/fCT73jIf5jN) | Poly by Google | CC-BY 3.0 |
| `pp/lantern.glb` | [Lantern](https://poly.pizza/m/9YMVn5hMiv8) | Poly by Google | CC-BY 3.0 |
| `pp/telescope.glb` | [Telescope](https://poly.pizza/m/RjyTCQvA8b) | CreativeTrio | CC0 |
| `pp/signpost.glb` (editor library only) | [Wooden Sign](https://poly.pizza/m/ZmqoVxznLy) | iPoly3D | CC0 |
| `pp/cabin.glb` (editor library only) | [Log cabin](https://poly.pizza/m/f7uccD5iyz0) | Poly by Google | CC-BY 3.0 |

## three.js examples (MIT) · https://github.com/mrdoob/three.js
- `textures/waternormals.jpg`

## Procedural (written for this project)
Floating islands, rope bridges, mountains, sky, clouds, waterfalls, glass house, project screens, skills orb, contact portal, signpost, grass and flowers are generated in code.

The LEGO-style Batman minifigure is an original procedural model created for this project (`src/world/characters.js`), with procedural movement and idle animations. The Batman character and LEGO minifigure design are references to their respective owners' properties; these are custom fan-art models, not official licensed assets.

## Mastiff dog — Wildfire Games · CC BY-SA 3.0

The textured, rigged mastiff and idle/running animations are from [0 A.D. by Wildfire Games](https://www.wildfiregames.com/), licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Source revision: `61a3b9507d974084e6badb88a0826bd89a6d5b8b` in [0ad/0ad](https://github.com/0ad/0ad).

Converted the unarmored COLLADA model to glTF, embedded the original brown mastiff texture, and adjusted UV orientation. The source running cycle is also played more slowly for hunting. The adapted `public/assets/character/dog/mastiff.glb` remains CC BY-SA 3.0. Its `LICENSE.txt` retains the upstream art license. Scale and animation blending are in `src/world/dogModel.js`.

## Experience exhibits

Employment descriptions and dates come from Calixte S. Simeon's supplied résumé. Logos and product imagery identify the organizations and provide visual context; they do not imply endorsement or authorship of pictured hardware or current product designs. Brand assets remain the property of their respective owners and are not covered by this project's code license.

- Xbox Series X console: [Microsoft Xbox product page](https://www.xbox.com/en-US/consoles/xbox-series-x).
- ManitLabs logo and current platform illustration: [ManitLabs](https://manitlabs.com/). Logo extracted from the official page's inline SVG.
- sparks & honey logo: [official company website](https://sparksandhoney.com/).
- 4Geeks and Miami Dade College logos: [4Geeks official website](https://4geeks.com/en/home).
- Prowinch logo and hoist illustration: extracted with original transparency from the cover of the [official product manual](https://prowinch.us/1media/manuals/PWPT1000-500lb.pdf).
- CBS Interactive logo: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:CBS_Interactive_Logo.svg), attributed to CBS Interactive; public-domain text logo with trademark rights retained.

Exact source asset URLs are recorded in `public/assets/experience/sources.json`. Images are served locally. Miniature exhibit sculptures and conceptual workflow diagrams are original illustrations of the résumé responsibilities, not company product screenshots.

## Interest observatory

Geometry and animation adapted from the user's `TestPost/output/index.html` (Schema-on-Read Observatory) into the game's existing Three.js scene. All workflow and source nodes, document cells, and connection effects are preserved as native objects. The original renderer, camera, HUD, controls, floor, platform, stars, and background are omitted. The original source file remains unchanged.

## Interest island — industry exhibits

The exhibit models are downloaded from Poly Pizza and served locally. Original geometry and materials are retained; display scale and placement are adjusted in the scene.

| Local asset | Model / author | License |
|---|---|---|
| `interest/shield.glb` | [Shield by sirkitree](https://poly.pizza/m/5x3TxeymSgO) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `interest/graduation-cap.glb` | [Graduation cap by Poly by Google](https://poly.pizza/m/4v0sRFH6PN9) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |

Model attribution also appears in each exhibit's Explore panel. Pedestals and labels are original procedural scene elements. Industry descriptions express the owner's stated interests; application ideas are prospective.

Additional Interest exhibits:

- `coin-piles.glb`: [Coin Piles by Quaternius](https://poly.pizza/m/9OWkKczINo) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Display scale and placement adjusted.
- `controller.glb`: [Videogame Controller by Poly by Google](https://poly.pizza/m/6365MG_Pr_f) · [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Display scale and placement adjusted.
- `server-rack.glb`: [server rack by Jeremy Eyring](https://poly.pizza/m/6ijQclm8jxw) · [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Display scale and placement adjusted.
- `robot.glb`: [Robot by Poly by Google](https://poly.pizza/m/9A6cuitiB_4) · [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Display scale and placement adjusted.

## Dark Past bridge ghosts

[Ghost by Quaternius](https://poly.pizza/m/Iip30bDHmu), [CC0](https://creativecommons.org/publicdomain/zero/1.0/), is served locally as `character/ghost/ghost.glb`. The original animated model is retained. Runtime adaptations add dark spectral shading, red emissive eyes, scaling, fading, and idle/flying animation blends. Warning markers and swoop/dodge mechanics are original code. Custom nonblank messages in `pastMessages.js` remain supported; blank signs are hidden.
