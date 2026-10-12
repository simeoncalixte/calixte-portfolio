# Casual Man — male character

Source: https://grab3d.com/models/characters/man/
Publisher: Grab3D
Downloaded: 2026-10-12
Price: free
License: CC0 1.0; original license preserved at scripts/art/casual-man/LICENSE.txt.
Origin: AI-assisted. The publisher discloses a Meshy-generated base mesh and textures,
with cleanup and checks in Blender.

male-explorer.glb replaces Diesel. Original clothing, hair, face and textures retained;
no backpack. Reduced the rigged mesh from 244,257 to 78,145 triangles, normalized bone
names, and retargeted the project's CC0 Quaternius idle, walk, run, wave and interaction
motions. Reference arm/wrist alignment and supporting-foot grounding match this rig.

Rebuild from the downloaded original:
node scripts/art/casual-man/prepare.mjs
node scripts/art/casual-man/retarget.mjs

Pose previews:
node scripts/art/casual-man/check-poses.mjs
blender -b --python scripts/art/casual-man/preview.py -- idle
Other poses: walk, run, pet, meditate.

Diesel source files remain as archived experiments; their rebuild scripts would
restore the rejected character and should not be used for the current male model.
