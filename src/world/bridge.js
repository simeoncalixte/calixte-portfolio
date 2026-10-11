import * as THREE from 'three';
import { bridgePoint } from './layout.js';
import { mulberry32 } from '../core/noise.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Rope-and-plank suspension bridge following a sagging curve between two
 * islands. Planks are instanced, ropes are tubes, and warm string lights glow
 * through bloom instead of real lights (cheap but convincing).
 */
export function createBridge(br, mats) {
  const group = new THREE.Group();
  group.name = `bridge:${br.from}-${br.to}`;
  const rand = mulberry32(Math.floor(br.length * 1000));
  const plankDepth = 0.32, gap = 0.07;
  const count = Math.floor(br.length / (plankDepth + gap));

  const side = new THREE.Vector3().crossVectors(UP, br.dir).normalize();
  const plankGeo = new THREE.BoxGeometry(br.width, 0.07, plankDepth);
  const planks = new THREE.InstancedMesh(plankGeo, mats.plank, count);
  planks.castShadow = true; planks.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), p2 = new THREE.Vector3();
  const tangent = new THREE.Vector3(), basis = new THREE.Matrix4(), normal = new THREE.Vector3();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    bridgePoint(br, t, p);
    bridgePoint(br, Math.min(1, t + 0.01), p2);
    tangent.subVectors(p2, p).normalize();
    normal.crossVectors(tangent, side).normalize().negate();
    if (normal.y < 0) normal.negate();
    basis.makeBasis(side, normal, tangent);
    q.setFromRotationMatrix(basis);
    const wob = new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.04, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.03));
    q.multiply(wob);
    s.set(0.92 + rand() * 0.12, 1, 1);
    p.y -= 0.05;
    m.compose(p, q, s);
    planks.setMatrixAt(i, m);
    color.setHSL(0.07 + rand() * 0.02, 0.35, 0.45 + rand() * 0.25);
    planks.setColorAt(i, color);
  }
  group.add(planks);

  // ropes: two handrails + two deck-edge ropes, all follow the same sag
  const ropeCurve = (offSide, offUp, extraSag) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      bridgePoint(br, t, p);
      p.addScaledVector(side, offSide);
      p.y += offUp + extraSag * 4 * t * (1 - t);
      pts.push(p.clone());
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  const hw = br.width / 2 + 0.05;
  const rails = [ropeCurve(hw, 1.05, 0.25), ropeCurve(-hw, 1.05, 0.25)];
  const edges = [ropeCurve(hw, 0.02, 0), ropeCurve(-hw, 0.02, 0)];
  for (const c of [...rails, ...edges]) {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(c, 80, 0.045, 6, false), mats.rope);
    tube.castShadow = true;
    group.add(tube);
  }

  // vertical hangers between rail and deck edge
  const hangerCount = Math.floor(br.length / 1.4);
  const hangerGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 4);
  hangerGeo.translate(0, 0.5, 0);
  const hangers = new THREE.InstancedMesh(hangerGeo, mats.rope, hangerCount * 2);
  let hi = 0;
  for (let i = 0; i < hangerCount; i++) {
    const t = (i + 0.5) / hangerCount;
    for (let k = 0; k < 2; k++) {
      const a = edges[k].getPoint(t), b = rails[k].getPoint(t);
      const len = a.distanceTo(b);
      m.compose(a, new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()), new THREE.Vector3(1, len, 1));
      hangers.setMatrixAt(hi++, m);
    }
  }
  group.add(hangers);

  // end posts
  const postGeo = new THREE.CylinderGeometry(0.13, 0.16, 1.7, 8);
  postGeo.translate(0, 0.65, 0);
  for (const t of [0, 1]) {
    for (const k of [1, -1]) {
      bridgePoint(br, t, p);
      p.addScaledVector(side, k * (hw + 0.05));
      const post = new THREE.Mesh(postGeo, mats.post);
      post.position.copy(p);
      post.position.y -= 0.5;
      post.castShadow = true;
      group.add(post);
    }
  }

  // string lights along each handrail
  if (br.lights) {
    const n = Math.floor(br.length / 2.2);
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), mats.bulb, n * 2);
    let bi = 0;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      for (let k = 0; k < 2; k++) {
        const a = rails[k].getPoint(t);
        a.y -= 0.08;
        m.makeTranslation(a.x, a.y, a.z);
        bulbs.setMatrixAt(bi++, m);
      }
    }
    group.add(bulbs);
  }

  group.userData.bridge = br;
  return group;
}

export function createBridgeMaterials(tex) {
  return {
    plank: new THREE.MeshStandardMaterial({ map: tex.woodDiff, normalMap: tex.woodNor, roughness: 0.9, color: '#c9a27a' }),
    rope: new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 1 }),
    post: new THREE.MeshStandardMaterial({ map: tex.woodDiff, color: '#6b4a32', roughness: 0.95 }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc078').multiplyScalar(5), toneMapped: false }),
  };
}
