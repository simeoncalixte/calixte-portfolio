import * as THREE from 'three';
import { loadModel, normalizeModel } from './assets.js';
import { publicUrl } from './publicUrl.js';

/**
 * Layout overrides authored with the dev editor. Stored in /public/layout.json:
 * {
 *   objects: { "<object name>": { p: [x,y,z], r: [x,y,z], s: [x,y,z] } },  // moved built-ins
 *   added:   [{ id, url, p, r, s, collider }]                               // imported models
 * }
 * Applied in production too, so edits made in dev ship with the build.
 */
export const ADDED_TAG = 'layoutAdded';

export async function fetchLayout() {
  try {
    const res = await fetch(publicUrl('layout.json'), { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export function applyTransform(o, t) {
  if (t.p) o.position.fromArray(t.p);
  if (t.r) o.rotation.set(t.r[0], t.r[1], t.r[2]);
  if (t.s) o.scale.fromArray(t.s);
}

export async function spawnAdded(scene, item) {
  const gltf = await loadModel(item.url);
  const obj = normalizeModel(gltf.scene.clone(true), { maxExtent: item.size || 2 });
  obj.name = item.id;
  obj.userData.editable = true;
  obj.userData[ADDED_TAG] = { url: item.url, size: item.size || 2, collider: item.collider ?? true };
  applyTransform(obj, item);
  scene.add(obj);
  if (item.collider !== false && window.__app?.walk) {
    const box = new THREE.Box3().setFromObject(obj);
    const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.4;
    window.__app.walk.addCollider(obj.position.x, obj.position.z, r, item.id);
  }
  return obj;
}

export async function applyLayout(scene) {
  const data = await fetchLayout();
  if (!data) return;
  for (const [name, t] of Object.entries(data.objects || {})) {
    const o = scene.getObjectByName(name);
    if (o) { applyTransform(o, t); o.userData.dirty = true; }
  }
  for (const item of data.added || []) {
    try { await spawnAdded(scene, item); } catch (e) { console.warn('layout: failed to load', item.url, e); }
  }
}

export function serializeLayout(scene) {
  const objects = {}, added = [];
  const r3 = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
  scene.traverse((o) => {
    if (!o.userData.editable || !o.name) return;
    const t = { p: r3(o.position), r: r3(o.rotation), s: r3(o.scale) };
    if (o.userData[ADDED_TAG]) added.push({ id: o.name, url: o.userData[ADDED_TAG].url, size: o.userData[ADDED_TAG].size, collider: o.userData[ADDED_TAG].collider, ...t });
    else if (o.userData.dirty) objects[o.name] = t;
  });
  return { objects, added };
}
