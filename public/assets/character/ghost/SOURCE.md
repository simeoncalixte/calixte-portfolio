# Bridge Wraith

Original game mesh created for this portfolio in Blender 5.2.2, using the user-provided faceless hanging ghost photograph as a visual reference.

Reference: https://images.halloween.com/products/71717/1-1/5ft-large-hanging-faceless-ghost-prop.jpg
The photograph is not bundled or used as a texture.

- Editable scene: `scripts/art/bridge-wraith.blend`
- Reproducible generator: `scripts/art/create_ghost.py`
- Runtime model: `ghost.glb`
- Studio render: `preview.png`
- Design: layered ivory drapes, deep black faceless hood, skeletal hands,
  hanging iron chain, and warm lantern. No eyes or mouth.
- Skeleton animations: `Ghost|Flying_Idle`, `Ghost|Fast_Flying`.

Run Blender in background mode with `--python scripts/art/create_ghost.py`
from this repository to regenerate the model, Blender scene, and preview.
The runtime keeps its existing 3.6-unit height, fog-independent visibility,
40-meter forward / 20-meter-high spawn, warning marker, dodgeable swoop,
and per-instance animation/fading.

This replaces the earlier Quaternius ghost; it does not incorporate that mesh.
