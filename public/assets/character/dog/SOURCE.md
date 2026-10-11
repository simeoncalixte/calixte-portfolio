# Mastiff dog

Copyright Wildfire Games — https://www.wildfiregames.com/
License: CC BY-SA 3.0 — https://creativecommons.org/licenses/by-sa/3.0/
See LICENSE.txt. The adapted asset remains under CC BY-SA 3.0.

Source: https://github.com/0ad/0ad/tree/61a3b9507d974084e6badb88a0826bd89a6d5b8b/binaries/data/mods/public/art

Original files relative to that art directory (conversion input names):
- meshes/skeletal/mastiff_no_spikes.dae (dog.dae)
- animation/quadraped/mastiff_idle_long.dae (idle.dae)
- animation/quadraped/mastiff_run.dae (walk.dae and run.dae)
- textures/skins/skeletal/brit/mastiff_b_01.png (dog.png)

Changes: converted to GLB, embedded texture, adjusted UV orientation, renamed clips. The same source running cycle is used at different playback speeds for hunting and chasing; the source has no separate walk animation. Runtime scale is normalized for a large dog. Conversion: node scripts/convert-dog.mjs SOURCE_DIR /path/to/linkedom/esm/index.js. Linkedom is available from npm.
