# Explorer character

Blender refinement of the existing Quaternius adventurer already used by this project.
The original character, face, skeleton, animation clips, and attribution are retained.

Changes: teal jacket, pale trim, charcoal trouser panels, leather pack details,
The Blender source also includes experimental small bevels. Runtime uses the
original geometry because Blender re-export changed skin deformation.

- `adventurer-original.glb`: unmodified source for repeatable edits.
- `explorer-player.blend`: editable Blender scene with preview lighting.
- `improve_player.py`: rebuilds the edited Blender asset and studio preview.
- `assemble_player.mjs`: transfers the revised materials while preserving original geometry,
  skin weights, and animation data required by gameplay.
- `player-preview.png`: rendered preview.

Rebuild from the repository root:

    blender -b --python scripts/art/improve_player.py
    node scripts/art/assemble_player.mjs

The output is `public/assets/character/adventurer.glb`.
