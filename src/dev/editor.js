// DEV ONLY — loaded via dynamic import behind import.meta.env.DEV, never shipped.
import * as THREE from 'three';
import GUI from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { MODEL_LIBRARY } from '../core/assets.js';
import { spawnAdded, serializeLayout, ADDED_TAG } from '../core/layoutStore.js';

/**
 * In-world editor. Toggle with ` (backquote) or F2.
 *  - click to select any editable object (landmarks, signpost, imported models)
 *  - G / R / S: move / rotate / scale gizmo · F: focus · Del: delete imported · Ctrl+D: duplicate
 *  - place models from the asset library, import local .glb/.gltf (file picker or drag & drop),
 *    or paste a direct .glb URL (e.g. a poly.pizza static link)
 *  - Save writes public/layout.json (applied at startup in dev and production)
 */
export function installEditor(app) {
  const { scene, camera, renderer } = app;
  const dom = renderer.domElement;
  let active = false, selected = null, counter = 0;

  const orbit = new OrbitControls(camera, dom);
  orbit.enabled = false;
  orbit.enableDamping = true;

  const gizmo = new TransformControls(camera, dom);
  gizmo.setSize(0.9);
  gizmo.addEventListener('dragging-changed', (e) => { orbit.enabled = active && !e.value; });
  gizmo.addEventListener('objectChange', () => {
    if (!selected) return;
    selected.userData.dirty = true;
    if (state.snapToGround) snapToGround(selected);
    refreshInfo();
  });
  const gizmoHelper = gizmo.getHelper ? gizmo.getHelper() : gizmo;
  gizmoHelper.visible = false;
  scene.add(gizmoHelper);

  const box = new THREE.BoxHelper(new THREE.Object3D(), 0x4fd8f0);
  box.visible = false;
  scene.add(box);

  const state = {
    asset: Object.keys(MODEL_LIBRARY)[0],
    size: 2,
    snapToGround: true,
    collider: true,
    url: '',
    mode: 'translate',
    info: '—',
  };

  // ------------------------------------------------------------- GUI
  const gui = new GUI({ title: 'World Editor (dev)' });
  gui.domElement.style.zIndex = 60;
  gui.hide();
  const lib = gui.addFolder('Asset library');
  lib.add(state, 'asset', Object.keys(MODEL_LIBRARY)).name('model');
  lib.add(state, 'size', 0.2, 30, 0.1).name('size (m)');
  lib.add(state, 'collider').name('blocks player');
  lib.add({ place: () => place(MODEL_LIBRARY[state.asset]) }, 'place').name('➕ Place in front of camera');
  const imp = gui.addFolder('Import');
  imp.add({ pick: () => fileInput.click() }, 'pick').name('📁 Import .glb / .gltf file…');
  imp.add(state, 'url').name('direct .glb URL');
  imp.add({ go: () => importUrl(state.url) }, 'go').name('⬇ Download & place URL');
  const sel = gui.addFolder('Selection');
  sel.add(state, 'mode', ['translate', 'rotate', 'scale']).onChange((m) => gizmo.setMode(m)).listen();
  sel.add(state, 'snapToGround').name('snap to ground');
  sel.add(state, 'info').name('selected').listen().disable();
  sel.add({ d: () => duplicate() }, 'd').name('Duplicate (Ctrl+D)');
  sel.add({ x: () => remove() }, 'x').name('Delete (Del)');
  const io = gui.addFolder('Layout');
  io.add({ s: () => save() }, 's').name('💾 Save to public/layout.json');
  io.add({ e: () => exportJson() }, 'e').name('Export JSON');
  io.add({ q: () => toggle(false) }, 'q').name('Exit editor (`)');

  const fileInput = Object.assign(document.createElement('input'), { type: 'file', accept: '.glb,.gltf', multiple: true });
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', () => { for (const f of fileInput.files) uploadFile(f); fileInput.value = ''; });

  const badge = document.createElement('div');
  badge.textContent = 'EDIT MODE — click objects · G/R/S gizmo · F focus · ` exit';
  Object.assign(badge.style, { position: 'fixed', left: '50%', top: '70px', transform: 'translateX(-50%)', zIndex: 60, padding: '8px 14px', borderRadius: '6px', background: 'rgba(79,216,240,.15)', border: '1px solid #4fd8f0', color: '#fff', font: '600 12px Montserrat, sans-serif', letterSpacing: '.08em', display: 'none' });
  document.body.appendChild(badge);

  // ------------------------------------------------------------- helpers
  function toggle(on = !active) {
    active = on;
    window.__editorActive = on;
    gui.show(on);
    badge.style.display = on ? 'block' : 'none';
    orbit.enabled = on;
    if (on) {
      document.exitPointerLock?.();
      const p = app.player?.position || new THREE.Vector3();
      orbit.target.copy(p).add(new THREE.Vector3(0, 1, 0));
      if (app.player) app.player.input.f = app.player.input.r = 0;
    } else {
      select(null);
      app.follow.snap(app.player.position);
    }
  }

  function select(o) {
    selected = o;
    if (o) { gizmo.attach(o); gizmoHelper.visible = true; box.setFromObject(o); box.visible = true; }
    else { gizmo.detach(); gizmoHelper.visible = false; box.visible = false; }
    refreshInfo();
  }
  function refreshInfo() {
    if (!selected) { state.info = '—'; return; }
    const p = selected.position;
    state.info = `${selected.name} (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`;
    box.setFromObject(selected);
  }

  function snapToGround(o) {
    const floors = app.walk.floors(o.position.x, o.position.z, []);
    if (floors.length) o.position.y = floors.reduce((a, f) => (Math.abs(f.y - o.position.y) < Math.abs(a - o.position.y) ? f.y : a), floors[0].y);
  }

  function spawnPoint() {
    const ray = new THREE.Raycaster();
    ray.camera = camera;
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = ray.intersectObjects(scene.getObjectByName('world')?.children || [], true);
    if (hits.length) return hits[0].point;
    return camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(8));
  }

  async function place(url, extra = {}) {
    const p = spawnPoint();
    const obj = await spawnAdded(scene, {
      id: `added_${Date.now().toString(36)}_${counter++}`, url, size: state.size, collider: state.collider,
      p: [p.x, p.y, p.z], r: [0, 0, 0], s: [1, 1, 1], ...extra,
    });
    if (state.snapToGround) snapToGround(obj);
    select(obj);
    return obj;
  }

  async function uploadFile(file) {
    const res = await fetch(`/__editor/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file });
    const j = await res.json();
    if (!res.ok) return alert(j.error);
    if (/\.gltf$/i.test(file.name)) alert('Imported .gltf — make sure its .bin/textures are also copied to public/assets/imported/. Prefer .glb.');
    await place(j.url);
  }

  async function importUrl(url) {
    if (!url) return;
    const res = await fetch('/__editor/fetch', { method: 'POST', body: JSON.stringify({ url }) });
    const j = await res.json();
    if (!res.ok) return alert(j.error);
    await place(j.url);
  }

  async function duplicate() {
    if (!selected?.userData[ADDED_TAG]) return;
    const src = selected;
    const t = src.userData[ADDED_TAG];
    const o = await place(t.url, { size: t.size, r: [src.rotation.x, src.rotation.y, src.rotation.z], s: src.scale.toArray() });
    o.position.copy(src.position).add(new THREE.Vector3(1.5, 0, 0));
    if (state.snapToGround) snapToGround(o);
  }

  function remove() {
    if (!selected?.userData[ADDED_TAG]) return alert('Only imported models can be deleted (built-ins can be moved).');
    const o = selected;
    select(null);
    o.removeFromParent();
  }

  async function save() {
    const data = serializeLayout(scene);
    const res = await fetch('/__editor/layout', { method: 'POST', body: JSON.stringify(data) });
    badge.textContent = res.ok ? `Saved ${data.added.length} added / ${Object.keys(data.objects).length} moved` : 'Save failed';
    setTimeout(() => { badge.textContent = 'EDIT MODE — click objects · G/R/S gizmo · F focus · ` exit'; }, 2000);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(serializeLayout(scene), null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'layout.json' });
    a.click();
  }

  // ------------------------------------------------------------- picking
  const ray = new THREE.Raycaster();
  ray.camera = camera;
  let downAt = null;
  dom.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  dom.addEventListener('pointerup', (e) => {
    if (!active || !downAt || gizmo.dragging) return;
    if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
    const r = dom.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hits = ray.intersectObjects(scene.children.filter((c) => c !== gizmoHelper && c !== box), true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.editable) o = o.parent;
      if (o) return select(o);
    }
    select(null);
  });

  // drag & drop import
  dom.addEventListener('dragover', (e) => { if (active) e.preventDefault(); });
  dom.addEventListener('drop', (e) => {
    if (!active) return;
    e.preventDefault();
    for (const f of e.dataTransfer.files) if (/\.(glb|gltf)$/i.test(f.name)) uploadFile(f);
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote' || e.key === '`' || e.code === 'F2') { e.preventDefault(); toggle(); return; }
    if (!active || e.target.closest?.('input, textarea, .lil-gui')) return;
    if (e.code === 'KeyG') { state.mode = 'translate'; gizmo.setMode('translate'); }
    if (e.code === 'KeyR') { state.mode = 'rotate'; gizmo.setMode('rotate'); }
    if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey) { state.mode = 'scale'; gizmo.setMode('scale'); }
    if (e.code === 'KeyF' && selected) { orbit.target.copy(selected.position); }
    if ((e.code === 'Delete' || e.code === 'Backspace') && selected) remove();
    if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); duplicate(); }
    if (e.code === 'Escape') select(null);
  });

  // per-frame orbit damping while active
  (function tick() { if (active) orbit.update(); requestAnimationFrame(tick); })();
  console.info('%c[editor] press ` (backquote) or F2 to toggle the world editor', 'color:#4fd8f0');
}
