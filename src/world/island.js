import * as THREE from 'three';
import { createNoise2D, smoothstep, mulberry32 } from '../core/noise.js';
import { radiusAt, surfaceHeight } from './layout.js';

const noise = createNoise2D(1234);

/**
 * Builds a floating island: a gently domed grassy top whose rim follows a noisy
 * outline, plus a jagged rocky underside that tapers into hanging spires.
 */
export function createIsland(isl, mats) {
  const group = new THREE.Group();
  group.name = `island:${isl.id}`;
  const [cx, cy, cz] = isl.center;
  const SEG = 128, RINGS = 26;

  // ---------- top surface ----------
  const topPos = [], topUv = [], topCol = [], topIdx = [];
  const cGrass = new THREE.Color('#47683a'), cGrassDry = new THREE.Color('#61683f'), cMoss = new THREE.Color('#2c4a2c'), cDirt = new THREE.Color('#4d463d');
  const c = new THREE.Color();
  topPos.push(cx, surfaceHeight(isl, cx, cz), cz); topUv.push(cx * 0.12, cz * 0.12); topCol.push(cGrass.r, cGrass.g, cGrass.b);
  for (let r = 1; r <= RINGS; r++) {
    const k = r / RINGS;
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * Math.PI * 2;
      const R = radiusAt(isl, a) * k;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      const y = surfaceHeight(isl, x, z);
      topPos.push(x, y, z); topUv.push(x * 0.12, z * 0.12);
      const v = noise(x * 0.08, z * 0.08) * 0.5 + 0.5;
      c.copy(cGrass).lerp(cGrassDry, v * 0.55).lerp(cMoss, smoothstep(0.55, 1, noise(x * 0.03 + 9, z * 0.03)) * 0.6);
      c.lerp(cDirt, smoothstep(0.85, 1.0, k) * 0.55);
      topCol.push(c.r, c.g, c.b);
    }
  }
  for (let s = 0; s < SEG; s++) topIdx.push(0, 1 + ((s + 1) % SEG), 1 + s);
  for (let r = 1; r < RINGS; r++) {
    const a0 = 1 + (r - 1) * SEG, a1 = 1 + r * SEG;
    for (let s = 0; s < SEG; s++) {
      const s1 = (s + 1) % SEG;
      topIdx.push(a0 + s, a0 + s1, a1 + s, a0 + s1, a1 + s1, a1 + s);
    }
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
  topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(topUv, 2));
  topGeo.setAttribute('color', new THREE.Float32BufferAttribute(topCol, 3));
  topGeo.setIndex(topIdx);
  topGeo.computeVertexNormals();
  const top = new THREE.Mesh(topGeo, mats.ground);
  top.receiveShadow = true;
  top.name = 'ground';
  group.add(top);

  // ---------- rocky underside ----------
  const LAYERS = 34;
  const rockPos = [], rockUv = [], rockCol = [], rockIdx = [];
  const depth = isl.depth;
  const seed = isl.seed * 3.7;
  const cRock = new THREE.Color('#8a7e72'), cRockDark = new THREE.Color('#3d3b42'), cRockCool = new THREE.Color('#38445a'), cTopSoil = new THREE.Color('#3d3324');
  for (let l = 0; l <= LAYERS; l++) {
    const t = l / LAYERS;
    for (let s = 0; s <= SEG; s++) {
      const a = (s / SEG) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const R0 = radiusAt(isl, a);
      // silhouette: slight bulge just below the rim, then taper to spires
      const taper = Math.pow(1 - t, 1.15) * (1 + 0.12 * Math.sin(t * Math.PI));
      const spire = 0.55 + 0.45 * (noise(ca * 2.2 + seed, sa * 2.2 - seed) * 0.5 + 0.5);
      const lump = 1 + 0.3 * noise(ca * 4 + seed, sa * 4 + t * 3.5) * t + 0.12 * noise(ca * 11 + seed, sa * 11 + t * 9) + 0.05 * noise(ca * 27 + seed, sa * 27 + t * 20);
      let R = R0 * (l === 0 ? 1 : 1.02 * taper * lump);
      if (t > 0.35) R *= 1 - (1 - spire) * smoothstep(0.35, 1, t) * 0.6;
      const x = cx + ca * R, z = cz + sa * R;
      const yTop = l === 0 ? surfaceHeight(isl, x, z) : cy - 1.4;
      const strata = 0.35 * Math.sin(t * 40 + noise(ca * 3, sa * 3) * 4);
      const yDepth = depth * Math.pow(t, 1.05) * (0.75 + 0.5 * spire) + strata * t;
      const y = l === 0 ? yTop : yTop - yDepth;
      rockPos.push(x, y, z);
      rockUv.push((s / SEG) * R0 * 0.35, y * 0.12);
      c.copy(cRock).lerp(cTopSoil, smoothstep(0.08, 0.0, t)).lerp(cRockDark, smoothstep(0.1, 0.8, t)).lerp(cRockCool, smoothstep(0.5, 1, t) * 0.6);
      const v = noise(ca * 6 + t * 5, sa * 6 + seed) * 0.5 + 0.5;
      c.multiplyScalar(0.75 + v * 0.45);
      rockCol.push(c.r, c.g, c.b);
    }
  }
  const W = SEG + 1;
  for (let l = 0; l < LAYERS; l++) {
    for (let s = 0; s < SEG; s++) {
      const a = l * W + s, b = a + 1, d = a + W, e = d + 1;
      rockIdx.push(a, b, d, b, e, d);
    }
  }
  // cap the tip
  const tipIdx = rockPos.length / 3;
  rockPos.push(cx, cy - 1.4 - depth * 1.2, cz); rockUv.push(0, 0); rockCol.push(cRockDark.r, cRockDark.g, cRockDark.b);
  for (let s = 0; s < SEG; s++) rockIdx.push(LAYERS * W + s, LAYERS * W + s + 1, tipIdx);

  const rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(rockPos, 3));
  rockGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rockUv, 2));
  rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(rockCol, 3));
  rockGeo.setIndex(rockIdx);
  rockGeo.computeVertexNormals();
  const rock = new THREE.Mesh(rockGeo, mats.rock);
  rock.castShadow = true;
  rock.receiveShadow = true;
  rock.name = 'rock';
  group.add(rock);

  // secondary hanging spires for a craggy silhouette
  const rand = mulberry32(isl.seed * 991);
  const spireCount = 3 + Math.floor(isl.radius / 4);
  for (let k = 0; k < spireCount; k++) {
    const a = rand() * Math.PI * 2, u = 0.25 + rand() * 0.45;
    const R0 = radiusAt(isl, a) * u;
    const len = depth * (0.35 + rand() * 0.45);
    const rad = isl.radius * (0.12 + rand() * 0.12);
    const geo = new THREE.ConeGeometry(rad, len, 10, 8, true);
    geo.rotateX(Math.PI); // tip down
    const p = geo.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
      const f = 1 + 0.35 * noise(x * 0.8 + k * 3, z * 0.8 + y * 0.3);
      p.setXYZ(v, x * f, y, z * f);
    }
    geo.computeVertexNormals();
    const cols = new Float32Array(p.count * 3);
    for (let v = 0; v < p.count; v++) {
      const t = 0.5 - p.getY(v) / len; // 0 top -> 1 tip
      c.copy(cRock).lerp(cRockDark, smoothstep(0.0, 0.8, t)).lerp(cRockCool, t * 0.5).multiplyScalar(0.8 + rand() * 0.3);
      cols[v * 3] = c.r; cols[v * 3 + 1] = c.g; cols[v * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    // planar-ish UVs so the rock texture shows
    const uv = geo.attributes.uv;
    for (let v = 0; v < uv.count; v++) uv.setXY(v, uv.getX(v) * rad * 0.8, p.getY(v) * 0.12);
    const m = new THREE.Mesh(geo, mats.rock);
    m.position.set(cx + Math.cos(a) * R0, cy - 1.4 - depth * (0.15 + u * 0.25) - len / 2 + len * 0.15, cz + Math.sin(a) * R0);
    m.castShadow = true;
    group.add(m);
  }

  return group;
}

/** Ground + rock materials shared by all islands. */
export function createIslandMaterials(tex) {
  const ground = new THREE.MeshStandardMaterial({
    map: tex.groundDiff, normalMap: tex.groundNor, roughnessMap: tex.groundRough,
    vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.5,
    normalScale: new THREE.Vector2(0.8, 0.8),
  });
  const rock = new THREE.MeshStandardMaterial({
    map: tex.rockDiff, normalMap: tex.rockNor, vertexColors: true, roughness: 0.95, metalness: 0,
    envMapIntensity: 0.5, normalScale: new THREE.Vector2(1.4, 1.4),
  });
  return { ground, rock };
}
