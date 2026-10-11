import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { publicUrl } from './publicUrl.js';

export const manager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(manager);
const texLoader = new THREE.TextureLoader(manager);
const rgbeLoader = new RGBELoader(manager);

const A = publicUrl('assets');

export const MODEL_LIBRARY = {
  // Poly Haven (CC0) — photoscanned, decimated with glTF-Transform into /assets/opt
  rock_moss_set_01: `${A}/opt/rock_moss_set_01.glb`,
  rock_moss_set_02: `${A}/opt/rock_moss_set_02.glb`,
  rock_07: `${A}/opt/rock_07.glb`,
  rock_face_01: `${A}/opt/rock_face_01.glb`,
  namaqualand_cliff_01: `${A}/opt/namaqualand_cliff_01.glb`,
  fern_02: `${A}/opt/fern_02.glb`,
  shrub_02: `${A}/opt/shrub_02.glb`,
  tree_stump_01: `${A}/opt/tree_stump_01.glb`,
  dead_tree_trunk: `${A}/opt/dead_tree_trunk.glb`,
  lantern_brass: `${A}/opt/Lantern_01.glb`,
  // poly.pizza (Quaternius CC0 / others CC-BY, see CREDITS.md)
  pine_a: `${A}/pp/pine_a.glb`,
  pine_b: `${A}/pp/pine_b.glb`,
  pine_c: `${A}/pp/pine_c.glb`,
  pine_d: `${A}/pp/pine_d.glb`,
  lantern: `${A}/pp/lantern.glb`,
  signpost: `${A}/pp/signpost.glb`,
  telescope: `${A}/pp/telescope.glb`,
  cabin: `${A}/pp/cabin.glb`,
  adventurer: `${A}/character/adventurer.glb`,
  dog: `${A}/character/dog/mastiff.glb`,
  ghost: `${A}/character/ghost/ghost.glb`,
  insuranceShield: `${A}/interest/shield.glb`,
  educationCap: `${A}/interest/graduation-cap.glb`,
  financeCoins: `${A}/interest/coin-piles.glb`,
  gamingController: `${A}/interest/controller.glb`,
  saasServer: `${A}/interest/server-rack.glb`,
  aiRobot: `${A}/interest/robot.glb`,
};

const cache = new Map();
export function loadModel(key) {
  const url = MODEL_LIBRARY[key] || (key.startsWith('/assets/') ? publicUrl(key) : key);
  if (!cache.has(url)) cache.set(url, gltfLoader.loadAsync(url));
  return cache.get(url);
}

export function loadGLTFFromBuffer(buffer) {
  return new Promise((res, rej) => gltfLoader.parse(buffer, '', res, rej));
}

export function loadTex(path, { srgb = true, repeat = 1 } = {}) {
  const t = texLoader.load(`${A}/textures/${path}`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function loadHDR(name) {
  return rgbeLoader.loadAsync(`${A}/hdri/${name}.hdr`);
}

/**
 * Normalises a model: scales it so its height (or largest extent) matches
 * `size`, and moves the pivot to the bottom centre. Returns a wrapper group.
 */
export function normalizeModel(object, { height, maxExtent, shadows = true } = {}) {
  const wrap = new THREE.Group();
  wrap.add(object);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  let s = 1;
  if (height) s = height / size.y;
  else if (maxExtent) s = maxExtent / Math.max(size.x, size.y, size.z);
  object.scale.multiplyScalar(s);
  object.updateMatrixWorld(true);
  box.setFromObject(object);
  const c = box.getCenter(new THREE.Vector3());
  object.position.x -= c.x;
  object.position.z -= c.z;
  object.position.y -= box.min.y;
  object.traverse((o) => {
    if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = true; }
  });
  return wrap;
}

/**
 * Flattens an (already normalised) model into [{geometry, material, matrix}]
 * so it can be drawn with InstancedMesh.
 */
export function extractParts(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const matrix = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.length === 1) parts.push({ geometry: o.geometry, material: mats[0], matrix });
    else {
      for (const g of o.geometry.groups) {
        const geo = o.geometry.clone();
        geo.clearGroups();
        geo.setDrawRange(g.start, g.count);
        parts.push({ geometry: geo, material: mats[g.materialIndex], matrix });
      }
    }
  });
  return parts;
}
