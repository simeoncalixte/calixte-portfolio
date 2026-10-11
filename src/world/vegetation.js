import * as THREE from 'three';
import { mulberry32, createNoise2D } from '../core/noise.js';
import { ISLANDS, radiusAt, surfaceHeight, SPAWN } from './layout.js';
import { extractParts, normalizeModel } from '../core/assets.js';
import { INTEREST_VERTICALS } from '../interests.js';

const noise = createNoise2D(31);

/** Areas kept clear of trees around the landmark set-pieces (world x,z,r). */
export const CLEARINGS = {
  main: [{ dx: SPAWN.x, dz: SPAWN.z, r: 5 }, { dx: -4.3, dz: -18.6, r: 2.4 }],
  projects: [{ dx: 0, dz: 0, r: 10.5 }],
  about: [{ dx: 0, dz: 0, r: 9 }],
  skills: [{ dx: 0, dz: 0, r: 9.5 }],
  interest: [{ dx: 0, dz: 0, r: 23 }, ...INTEREST_VERTICALS.map(area=>{
    const radius=radiusAt(ISLANDS.find(isl=>isl.id==='interest'),area.angle)-4.8;
    return {dx:Math.cos(area.angle)*radius,dz:Math.sin(area.angle)*radius,r:4.5};
  })],
  contact: [{ dx: 0, dz: 0, r: 5 }],
  grove: [{ dx: 0, dz: 0, r: 4 }],
  past: [{ dx: 0, dz: 0, r: 6 }, { dx: -6, dz: 0, r: 6 }],
  lookout: [{ dx: 0, dz: 0, r: 5 }, { dx: 3, dz: -4, r: 3 }],
};

function inClearing(isl, x, z, pad = 0) {
  for (const c of CLEARINGS[isl.id] || []) {
    const cx = isl.center[0] + c.dx, cz = isl.center[2] + c.dz;
    if (Math.hypot(x - cx, z - cz) < c.r + pad) return true;
  }
  return false;
}

/** Random points on an island's top inside [uMin,uMax] of the radius. */
function* scatter(isl, rand, count, uMin, uMax, walk, opts = {}) {
  let tries = 0, made = 0;
  while (made < count && tries < count * 40) {
    tries++;
    const a = rand() * Math.PI * 2;
    const u = Math.sqrt(uMin * uMin + rand() * (uMax * uMax - uMin * uMin));
    const R = radiusAt(isl, a) * u;
    const x = isl.center[0] + Math.cos(a) * R, z = isl.center[2] + Math.sin(a) * R;
    if (inClearing(isl, x, z, opts.clearPad ?? 0)) continue;
    if (walk.nearBridge(x, z, opts.bridgePad ?? 1.5)) continue;
    if (opts.filter && !opts.filter(x, z, a, u)) continue;
    made++;
    yield { x, z, y: surfaceHeight(isl, x, z), a, u };
  }
}

// ----------------------------------------------------------------- trees
export function createForest(pineModels, walk) {
  const group = new THREE.Group();
  group.name = 'forest';
  const rand = mulberry32(2024);
  const placements = pineModels.map(() => []);

  for (const isl of ISLANDS) {
    if (isl.gloomy) continue;
    const count = Math.round(isl.radius * (isl.id === 'main' ? 1.9 : 1.4));
    const toMain = Math.atan2(-isl.center[2], -isl.center[0]);
    const filter = isl.id === 'main'
      // keep the view from the spawn point open towards the other islands
      ? (x, z) => !(z < 2 && x > -14 && x < 17) && !(z > -8 && z < 4 && x > -7 && x < 6)
      // other islands: trees around the back/sides so the set-pieces face the viewer
      : (x, z, a) => Math.cos(a - toMain) < -0.15;
    for (const p of scatter(isl, rand, count, 0.35, 0.9, walk, { filter, bridgePad: 2.5, clearPad: 1.5 })) {
      const type = Math.floor(rand() * pineModels.length);
      const h = isl.id === 'main' ? 11 + rand() * 9 : 5.5 + rand() * 7;
      placements[type].push({ ...p, h, rot: rand() * Math.PI * 2, lean: (rand() - 0.5) * 0.06 });
      walk.addCollider(p.x, p.z, 0.45 * (h / 12), 'tree');
    }
  }
  // a few big hero trees framing the left of the start view
  for (const [x, z, h] of [[-9, -16.5, 21], [-15, -7, 19], [-18, 2, 17], [15, -9, 18], [18, 1, 16], [12, 12, 17], [-10, 13, 18]]) {
    const isl = ISLANDS[0];
    placements[0].push({ x, z, y: surfaceHeight(isl, x, z), h, rot: rand() * 6, lean: 0 });
    walk.addCollider(x, z, 0.7, 'tree');
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  pineModels.forEach((model, i) => {
    const list = placements[i];
    if (!list.length) return;
    const parts = extractParts(model.scene);
    const baseH = model.height;
    for (const part of parts) {
      const inst = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      list.forEach((pl, k) => {
        const sc = pl.h / baseH;
        e.set(pl.lean, pl.rot, pl.lean * 0.5);
        q.setFromEuler(e);
        s.setScalar(sc);
        p.set(pl.x, pl.y - 0.15, pl.z);
        m.compose(p, q, s).multiply(part.matrix);
        inst.setMatrixAt(k, m);
      });
      inst.computeBoundingSphere();
      group.add(inst);
    }
  });
  return group;
}

/** Tints tree materials for the dusk palette and fixes alpha-card leaves. */
export function prepPine(gltf) {
  const wrap = normalizeModel(gltf.scene, { height: 1 });
  wrap.traverse((o) => {
    if (!o.isMesh) return;
    const mat = o.material.clone();
    mat.envMapIntensity = 0.4;
    if (mat.map && /leaf|leaves|needle|pine/i.test(mat.name + (mat.map.name || ''))) {
      mat.alphaTest = 0.45;
      mat.transparent = false;
      mat.side = THREE.DoubleSide;
      mat.color.multiply(new THREE.Color('#9fb38a'));
    } else if (/bark|trunk/i.test(mat.name)) {
      mat.color.multiply(new THREE.Color('#9a8a7a'));
    } else {
      mat.color.multiply(new THREE.Color('#8fa080'));
      if (mat.map) { mat.alphaTest = 0.4; mat.side = THREE.DoubleSide; }
    }
    mat.roughness = 0.9;
    o.material = mat;
  });
  return { scene: wrap, height: 1 };
}

// ----------------------------------------------------------------- grass
export function createGrass(walk, groundTexColor) {
  const blade = new THREE.BufferGeometry();
  const segs = 4, W = 0.04, H = 1;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = W * (1 - t) * (1 - t * 0.2);
    const bend = t * t * 0.25;
    pos.push(-w, t * H, bend, w, t * H, bend);
    uv.push(0, t, 1, t);
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  blade.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  blade.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  blade.setIndex(idx);

  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.3 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vH;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vH = uv.y;
        vec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        float wind = sin(uTime*1.6 + wp.x*0.35 + wp.z*0.2) * 0.5 + sin(uTime*2.7 + wp.x*0.9) * 0.2;
        float k = uv.y * uv.y;
        transformed.x += wind * k * 0.35;
        transformed.z += wind * k * 0.15;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH;')
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb *= mix(vec3(0.18,0.24,0.10), vec3(1.0), smoothstep(0.0,1.0,vH));
        `);
  };

  const rand = mulberry32(99);
  const items = [];
  for (const isl of ISLANDS) {
    if (isl.gloomy) continue;
    const count = Math.round(isl.radius * isl.radius * (isl.id === 'main' ? 42 : 22));
    for (const p of scatter(isl, rand, count, 0, 0.93, walk, { bridgePad: -0.2, clearPad: -3 })) {
      const patch = noise(p.x * 0.09, p.z * 0.09);
      if (patch < -0.35 && rand() < 0.8) continue; // bare patches
      items.push(p);
    }
  }
  const inst = new THREE.InstancedMesh(blade, mat, items.length);
  inst.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
  const c = new THREE.Color(), cA = new THREE.Color('#5d8238'), cB = new THREE.Color('#8f8f48'), cC = new THREE.Color('#355f34');
  items.forEach((p, i) => {
    e.set((rand() - 0.5) * 0.4, rand() * Math.PI * 2, (rand() - 0.5) * 0.4);
    q.setFromEuler(e);
    const h = 0.16 + rand() * 0.26 + Math.max(0, noise(p.x * 0.2, p.z * 0.2)) * 0.32;
    s.set(0.6 + rand() * 0.5, h, 1);
    v.set(p.x, p.y - 0.03, p.z);
    m.compose(v, q, s);
    inst.setMatrixAt(i, m);
    const n = noise(p.x * 0.05 + 3, p.z * 0.05) * 0.5 + 0.5;
    c.copy(cA).lerp(cB, n * 0.6).lerp(cC, rand() * 0.4);
    inst.setColorAt(i, c);
  });
  inst.frustumCulled = false;
  inst.layers.set(1); // not rendered into the water reflection
  inst.userData.update = (t) => { uniforms.uTime.value = t; };
  return inst;
}

// ----------------------------------------------------------------- props
/**
 * Collects placements per model variant and emits one InstancedMesh per
 * sub-mesh, so hundreds of rocks/ferns cost a handful of draw calls.
 */
class Instancer {
  constructor() { this.byVariant = new Map(); }
  add(variant, matrix) {
    if (!this.byVariant.has(variant)) this.byVariant.set(variant, []);
    this.byVariant.get(variant).push(matrix.clone());
  }
  build(group, castShadow) {
    const m = new THREE.Matrix4();
    for (const [variant, mats] of this.byVariant) {
      for (const part of extractParts(variant)) {
        const inst = new THREE.InstancedMesh(part.geometry, part.material, mats.length);
        mats.forEach((M, i) => inst.setMatrixAt(i, m.multiplyMatrices(M, part.matrix)));
        inst.castShadow = castShadow;
        inst.receiveShadow = true;
        inst.computeBoundingSphere();
        group.add(inst);
      }
    }
  }
}

/** Scatter Poly Haven rocks / ferns / shrubs around the islands (instanced). */
export function scatterProps(lib, walk) {
  const group = new THREE.Group();
  group.name = 'props';
  const rand = mulberry32(555);
  const rocks = new Instancer(), plants = new Instancer();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const place = (inst, variant, x, y, z, scale, sink = 0.1, tilt = 0) => {
    E.set((rand() - 0.5) * tilt, rand() * Math.PI * 2, (rand() - 0.5) * tilt);
    Q.setFromEuler(E);
    S.setScalar(scale);
    P.set(x, y - sink * scale, z);
    inst.add(variant, M.compose(P, Q, S));
  };

  for (const isl of ISLANDS) {
    // rim rocks keep the edge from looking too clean
    for (const p of scatter(isl, rand, Math.round(isl.radius * 1.1), 0.82, 0.99, walk, { bridgePad: 1.2 })) {
      place(rocks, pick(lib.rocks), p.x, p.y, p.z, 0.7 + rand() * 1.5, 0.15, 0.5);
    }
    // ferns & shrubs under the trees
    for (const p of scatter(isl, rand, isl.gloomy ? 0 : Math.round(isl.radius * 2.2), 0.3, 0.92, walk, { bridgePad: 0.8, clearPad: 0.5 })) {
      const shrub = rand() < 0.35;
      place(plants, pick(shrub ? lib.shrubs : lib.ferns), p.x, p.y, p.z, shrub ? 0.9 + rand() * 0.8 : 0.7 + rand() * 0.7, 0.02);
    }
    for (const p of scatter(isl, rand, Math.max(1, Math.round(isl.radius * 0.12)), 0.4, 0.85, walk, { bridgePad: 2, clearPad: 1 })) {
      place(rocks, rand() < 0.5 ? lib.stump : lib.trunk, p.x, p.y, p.z, 1, 0.05);
      walk.addCollider(p.x, p.z, 0.6, 'stump');
    }
  }

  // rocky ledge framing the start point (reference: bottom of frame)
  const main = ISLANDS[0];
  for (const [x, z, sc, kind] of [[-9.5, -17.8, 2.2, 0], [7.5, -19.4, 1.8, 1], [14, -14.5, 2.0, 0], [-12.5, -15.2, 2.6, 1], [-14.5, -10, 2.0, 0], [-6, -3, 1.3, 1], [5, -2, 1.1, 0], [-7.4, -19.2, 1.4, 1], [11, -17.5, 1.5, 1]]) {
    const y = surfaceHeight(main, x, z);
    place(rocks, kind ? lib.rockFace : lib.cliff, x, y, z, sc, 0.25, 0.3);
    walk.addCollider(x, z, 0.75 * sc, 'rock');
  }
  rocks.build(group, true);
  const before = group.children.length;
  plants.build(group, false);
  // layer 1 = main camera only (skipped by the water's reflection camera)
  group.children.slice(before).forEach((o) => o.layers.set(1));
  return group;
}

const tintCache = new Map();
function tinted(mat, tint) {
  const key = mat.uuid + tint;
  if (!tintCache.has(key)) {
    const m = mat.clone();
    m.color.multiply(new THREE.Color(tint));
    m.envMapIntensity = 0.5;
    if (m.map && m.transparent) { m.alphaTest = 0.5; m.transparent = false; }
    if (m.alphaTest > 0) m.side = THREE.DoubleSide;
    tintCache.set(key, m);
  }
  return tintCache.get(key);
}

/**
 * Prepare a Poly Haven model. Asset "sets" (several rocks / fern variants in
 * one file) are split into individual, separately-normalised variants.
 */
export function prepVariants(gltf, size, tint = '#ffffff', split = true) {
  gltf.scene.updateMatrixWorld(true);
  const meshes = [];
  gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const groups = split ? meshes.map((m) => [m]) : [meshes];
  return groups.map((list) => {
    const root = new THREE.Group();
    for (const src of list) {
      const m = new THREE.Mesh(src.geometry, tinted(src.material, tint));
      m.applyMatrix4(src.matrixWorld);
      root.add(m);
    }
    return normalizeModel(root, { maxExtent: size });
  });
}

/** Single (unsplit) prop, e.g. for editor placement. */
export function prepProp(gltf, size, tint = '#ffffff') {
  return prepVariants(gltf, size, tint, false)[0];
}

// ----------------------------------------------------------------- flowers
/** Small instanced wildflowers (crossed alpha cards) — pinks, whites, yellows. */
export function createFlowers(walk) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2f4a22';
  g.fillRect(31, 30, 2, 34); // stem
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath();
    g.ellipse(32 + Math.cos(a) * 9, 22 + Math.sin(a) * 9, 7, 4.5, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#ffd34d';
  g.beginPath(); g.arc(32, 22, 4.5, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const quad = new THREE.PlaneGeometry(0.32, 0.32);
  quad.translate(0, 0.16, 0);
  const q2 = quad.clone().rotateY(Math.PI / 2);
  const geo = new THREE.BufferGeometry();
  const merge = (a, b) => {
    const pos = [...a.attributes.position.array, ...b.attributes.position.array];
    const uv = [...a.attributes.uv.array, ...b.attributes.uv.array];
    const nrm = new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0));
    const off = a.attributes.position.count;
    const idx = [...a.index.array, ...Array.from(b.index.array, (i) => i + off)];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setIndex(idx);
  };
  merge(quad, q2);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.08 });

  const rand = mulberry32(4242);
  const items = [];
  const palette = ['#ff8fb8', '#ffb3cf', '#f5f0ff', '#ffd27a', '#c9a6ff', '#ff6f9a'].map((h) => new THREE.Color(h));
  for (const isl of ISLANDS) {
    if (isl.gloomy) continue;
    const count = Math.round(isl.radius * isl.radius * (isl.id === 'main' ? 1.6 : 0.7));
    for (const p of scatter(isl, rand, count, 0.2, 0.95, walk, { bridgePad: 0, clearPad: -1 })) {
      if (noise(p.x * 0.12 + 7, p.z * 0.12) < 0.05) continue; // grow in clumps
      items.push(p);
    }
  }
  const inst = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
  items.forEach((p, i) => {
    e.set(0, rand() * Math.PI, 0);
    qq.setFromEuler(e);
    s.setScalar(0.6 + rand() * 0.8);
    v.set(p.x, p.y - 0.02, p.z);
    inst.setMatrixAt(i, m.compose(v, qq, s));
    inst.setColorAt(i, palette[Math.floor(rand() * palette.length)]);
  });
  inst.layers.set(1);
  inst.frustumCulled = false;
  return inst;
}
