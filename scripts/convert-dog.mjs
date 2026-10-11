// Usage: node scripts/convert-dog.mjs SOURCE_DIR /path/to/linkedom/esm/index.js
// SOURCE_DIR: dog.dae, idle.dae, walk.dae, run.dae, dog.png.
// Source/license details are in public/assets/character/dog/LICENSE.txt.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';

const [source, domModule] = process.argv.slice(2);
if (!source || !domModule) throw new Error('Provide source directory and linkedom module path');
globalThis.DOMParser = (await import(pathToFileURL(path.resolve(domModule)))).DOMParser;
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); }); }
};
const read = async (name) => new ColladaLoader().parse(await fs.readFile(path.join(source, `${name}.dae`), 'utf8'), '').scene;
const scene = await read('dog');
scene.name = 'MastiffRig';
const animations = [];
for (const name of ['idle', 'walk', 'run']) {
  const animated = await read(name);
  const byUUID = new Map(); animated.traverse((o) => byUUID.set(o.uuid, o));
  const tracks = animated.animations[0].tracks.map((sourceTrack) => {
    const track = sourceTrack.clone(), dot = track.name.lastIndexOf('.');
    const node = byUUID.get(track.name.slice(0, dot));
    if (!node || !scene.getObjectByName(node.name)) throw new Error(`Missing animated bone: ${track.name}`);
    track.name = node.name + track.name.slice(dot);
    return track;
  });
  const start = Math.min(...tracks.map((track) => track.times[0]));
  for (const track of tracks) track.shift(-start);
  animations.push(new THREE.AnimationClip(name, -1, tracks));
}
scene.traverse((o) => {
  if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0 });
});
scene.updateMatrixWorld(true);
const binary = await new GLTFExporter().parseAsync(scene, { binary: true, animations });
const io = new NodeIO();
const document = await io.readBinary(new Uint8Array(binary));
const texture = document.createTexture('Wildfire Games mastiff fur')
  .setImage(await fs.readFile(path.join(source, 'dog.png'))).setMimeType('image/png');
for (const mat of document.getRoot().listMaterials()) {
  mat.setBaseColorTexture(texture).setRoughnessFactor(0.95).setMetallicFactor(0);
  // COLLADA/Three texture coordinates need glTF's top-left convention.
}
for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
  const uv = primitive.getAttribute('TEXCOORD_0');
  if (uv) { const values = uv.getArray(); for (let i = 1; i < values.length; i += 2) values[i] = 1 - values[i]; }
}
document.getRoot().setExtras({
  author: 'Wildfire Games', license: 'CC-BY-SA-3.0',
  source: 'https://github.com/0ad/0ad/tree/61a3b9507d974084e6badb88a0826bd89a6d5b8b/binaries/data/mods/public/art',
  changes: 'Converted COLLADA to GLB, combined idle/walk/run clips, embedded original dog fur texture, flipped UV V for glTF.',
});
await io.write('public/assets/character/dog/mastiff.glb', document);
console.log('Exported textured, skinned dog with idle/walk/run animations.');
