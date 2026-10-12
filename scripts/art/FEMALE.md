# Female character: EMA

The game now uses EMA by THEUNSEENVULGA, replacing the earlier procedural model.
See public/assets/character/EMA-SOURCE.md for provenance and licensing.

- Original: scripts/art/ema/EMA-original.glb
- Game asset: public/assets/character/female-explorer.glb
- Rebuild motions and clothing tints: node scripts/art/ema/retarget.mjs
- Export runtime pose snapshots: node scripts/art/ema/check-poses.mjs
- Render a snapshot in Blender: blender -b --python scripts/art/ema/preview.py -- idle
  (also walk, run, pet, or meditate; output is /tmp/ema-<pose>.png).

EMA uses her own skeleton and animation mixer. src/player/characterAppearance.js
handles selection; src/player/petting.js supports both skeleton layouts.

The older prepare_female.mjs, create_female.py, and assemble_female.mjs files are
legacy experiments. Do not run those to rebuild EMA: they generate the replaced
procedural character.
