import * as THREE from 'three';
import { createNoise2D, fbm, smoothstep } from '../core/noise.js';

const noise = createNoise2D(7);

/**
 * World layout. Units are metres. The camera initially looks down -Z with the
 * sun low on the right horizon, matching the reference composition.
 */
/** Fractional calendar years since the chosen start of summer, June 21, 2011. */
export function yearsSinceSummer2011(date = new Date()) {
  const year = date.getUTCFullYear();
  const anniversary = Date.UTC(year, 5, 21);
  const startYear = date.getTime() < anniversary ? year - 1 : year;
  const start = Date.UTC(startYear, 5, 21), end = Date.UTC(startYear + 1, 5, 21);
  return Math.max(0, startYear - 2011 + (date.getTime() - start) / (end - start));
}
export const PAST_YEARS = yearsSinceSummer2011();

export const ISLANDS = [
  { id: 'main', center: [0, 0, 0], radius: 22, depth: 34, seed: 1, label: null },
  { id: 'projects', center: [2, -13, -70], radius: 17, depth: 30, seed: 2, label: { num: '02', title: 'EXPERIENCE', sub: 'Explore my work · 2019–2025' } },
  { id: 'about', center: [-13, -3, -132], radius: 16, depth: 30, seed: 3, label: { num: '01', title: 'ABOUT', sub: 'Get to know me' } },
  { id: 'skills', center: [64, -5, -138], radius: 14, depth: 28, seed: 4, label: { num: '03', title: 'SKILLS', sub: 'Tools & Technologies' } },
  { id: 'contact', center: [27.5, -8, -55], radius: 9, depth: 22, seed: 5, label: { num: '04', title: 'CONTACT', sub: "Let's connect" } },
  { id: 'grove', center: [-49, -5, -43], radius: 15, depth: 29, seed: 6, label: null },
  { id: 'past', center: [-650, -12, -43], radius: 19, depth: 46, seed: 8, label: null, gloomy: true },
  { id: 'interest', center: [-78, -4, -128], radius: 25, depth: 33, seed: 9, label: { num: '05', title: 'INTEREST', sub: 'Schema-on-Read Observatory' } },
  { id: 'lookout', center: [112, -2, -112], radius: 12, depth: 32, seed: 7, label: null },
];

export const BRIDGES = [
  { from: 'main', to: 'projects', width: 3.6, lights: true },
  { from: 'projects', to: 'about', width: 3.4, lights: true },
  { from: 'about', to: 'skills', width: 3.2, lights: true },
  { from: 'projects', to: 'contact', width: 3.4, lights: true },
  { from: 'contact', to: 'skills', width: 3.2, lights: true },
  { from: 'main', to: 'grove', width: 3.4, lights: true },
  { from: 'grove', to: 'projects', width: 3.4, lights: true },
  { from: 'about', to: 'interest', width: 3.6, lights: true },
  { from: 'skills', to: 'lookout', width: 3.2, lights: true },
  { from: 'grove', to: 'past', width: 3.6, lights: true, gloomy: true },
];

export const SPAWN = new THREE.Vector3(-0.8, 0, -15.8);
export const SUN_DIR = new THREE.Vector3(0.43, 0.11, -0.9).normalize();

const byId = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));
export const island = (id) => byId[id];

/** Rim radius of an island at polar angle `a`. */
export function radiusAt(isl, a) {
  const s = isl.seed * 17.3;
  const n = 0.13 * noise(Math.cos(a) * 1.1 + s, Math.sin(a) * 1.1 - s) + 0.06 * noise(Math.cos(a) * 3 + s, Math.sin(a) * 3 + s);
  return isl.radius * (1 + n);
}

/** Visual + walkable top surface height (world Y) at world x,z (no bounds check). */
export function surfaceHeight(isl, x, z) {
  const [cx, cy, cz] = isl.center;
  const dx = x - cx, dz = z - cz;
  const d = Math.hypot(dx, dz);
  const r = radiusAt(isl, Math.atan2(dz, dx));
  const u = d / r;
  const dome = 0.9 * (1 - u * u);
  const bumps = 0.55 * fbm(noise, x * 0.06 + isl.seed * 9, z * 0.06, 3) * smoothstep(1.0, 0.6, u);
  const rimDrop = -1.4 * smoothstep(0.86, 1.0, u);
  return cy + dome + bumps + rimDrop;
}

// ---- bridges -------------------------------------------------------------
function bridgeData(b) {
    const A = byId[b.from], B = byId[b.to];
    const ca = new THREE.Vector3(...A.center), cb = new THREE.Vector3(...B.center);
    const dir = new THREE.Vector3(cb.x - ca.x, 0, cb.z - ca.z).normalize();
    const angA = Math.atan2(dir.z, dir.x), angB = Math.atan2(-dir.z, -dir.x);
    const ra = radiusAt(A, angA) - 2.2, rb = radiusAt(B, angB) - 2.2;
    const pa = new THREE.Vector3(ca.x + dir.x * ra, 0, ca.z + dir.z * ra);
    const pb = new THREE.Vector3(cb.x - dir.x * rb, 0, cb.z - dir.z * rb);
    pa.y = surfaceHeight(A, pa.x, pa.z);
    pb.y = surfaceHeight(B, pb.x, pb.z);
    const length = pa.distanceTo(pb);
    const sag = Math.min(3.2, length * 0.045);
    return { ...b, A, B, pa, pb, dir, length, sag, halfWidth: b.width / 2 };
}

// Solve the island position so the endpoint-to-endpoint span is exactly x times
// the Home–Projects span, even though the rim height changes with position.
export const PAST_REFERENCE_LENGTH = bridgeData(BRIDGES[0]).length;
export const PAST_BRIDGE_LENGTH = PAST_REFERENCE_LENGTH * Math.max(1, PAST_YEARS);
const pastConnection = BRIDGES.find((b) => b.to === 'past');
let nearPastX = island('grove').center[0] - 40;
let farPastX = nearPastX - PAST_BRIDGE_LENGTH * 2;
for (let i = 0; i < 60; i++) {
  island('past').center[0] = (nearPastX + farPastX) / 2;
  if (bridgeData(pastConnection).length < PAST_BRIDGE_LENGTH) nearPastX = island('past').center[0];
  else farPastX = island('past').center[0];
}

export function buildBridgeData() {
  return BRIDGES.map(bridgeData);
}

/** Deck height on a bridge at parameter t in [0,1]. */
export function bridgeHeight(br, t) {
  const y = br.pa.y + (br.pb.y - br.pa.y) * t;
  return y - br.sag * 4 * t * (1 - t) + 0.12;
}

export function bridgePoint(br, t, out = new THREE.Vector3()) {
  out.lerpVectors(br.pa, br.pb, t);
  out.y = bridgeHeight(br, t);
  return out;
}
