import * as THREE from 'three';
import { surfaceHeight, island, PAST_YEARS } from './layout.js';
import { createBeacon } from './effects.js';
import { createPastGhosts } from './ghosts.js';
import { createPastPrison } from './prison.js';
import { createExperienceGallery, EXHIBIT_LAYOUT } from './experienceGallery.js';
import { createSkillsExhibits, SKILL_AREAS } from './skillsIsland.js';
import { createInterestObservatory } from './interestIsland.js';
import { createAIShrine } from './aiShrine.js';
import { createMeditationGarden } from './meditationGarden.js';
import { createInterestVerticals } from './interestVerticals.js';
import { createSkillJourney } from './skillJourneyIslands.js';
import { createInterestStone } from './interestStone.js';

// ----------------------------------------------------------------- canvas helpers
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const glowMat = (hex, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });

function faceTowards(group, from, to) {
  group.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
}

// ----------------------------------------------------------------- 03 SKILLS: orb + arches
function createOrb() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#5f5c5a', roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.35, metalness: 0.8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.6, 48), stone);
  base.position.y = 0.2; g.add(base);
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.5, 48), stone);
  base2.position.y = 0.7; g.add(base2);
  const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.04, 6, 96), glowMat('#4fd8f0', 4));
  ringGlow.rotation.x = Math.PI / 2; ringGlow.position.y = 0.52; g.add(ringGlow);

  // two tall curved monoliths
  for (const s of [-1, 1]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.28, 10, 48, Math.PI * 0.9), metal);
    arc.position.set(0, 2.9, 0);
    arc.rotation.set(0, s * 0.5 + Math.PI / 2, Math.PI * 0.55);
    arc.castShadow = true;
    g.add(arc);
  }
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.4, 0.6), stone);
  pillar.position.set(-2.2, 3.2, -1.2); pillar.rotation.z = 0.08; pillar.castShadow = true; g.add(pillar);
  const pillar2 = pillar.clone(); pillar2.position.set(2.0, 2.6, -1.4); pillar2.scale.y = 0.8; pillar2.rotation.z = -0.1; g.add(pillar2);

  // the orb: fresnel shell + bright core
  const orbMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
        float bands = 0.5 + 0.5*sin(vP.y*14.0 + uTime*2.0) * sin(atan(vP.z, vP.x)*6.0 - uTime);
        vec3 deep = vec3(0.02,0.08,0.18), cyan = vec3(0.3,0.85,1.0);
        vec3 col = mix(deep, cyan*2.5, f) + cyan * bands * 0.25 * (1.0-f);
        float core = pow(max(dot(vN, vV), 0.0), 6.0);
        col += vec3(0.8,0.95,1.0) * core * 1.6;
        gl_FragColor = vec4(col, 0.92);
      }`,
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1.15, 64, 32), orbMat);
  orb.position.y = 3.1;
  g.add(orb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTex(128, 128, (c, w) => { const r = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(120,230,255,.9)'); r.addColorStop(0.4, 'rgba(60,180,240,.25)'); r.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = r; c.fillRect(0, 0, w, w); }),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  halo.scale.set(7, 7, 1);
  halo.position.copy(orb.position);
  g.add(halo);
  // orbit rings
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.6 + i * 0.35, 0.025, 6, 96), glowMat('#7ae6ff', 2.5));
    r.position.copy(orb.position);
    r.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    g.add(r);
    rings.push(r);
  }
  const light = new THREE.PointLight('#4fd8f0', 40, 16, 2);
  light.position.copy(orb.position);
  g.add(light);
  g.traverse((o) => { if (o.isMesh && o.material !== orbMat) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.update = (t) => {
    orbMat.uniforms.uTime.value = t;
    orb.position.y = 3.1 + Math.sin(t * 1.2) * 0.12;
    halo.position.y = orb.position.y;
    rings.forEach((r, i) => { r.position.y = orb.position.y; r.rotation.x += 0.004 * (i + 1); r.rotation.y += 0.006 * (2 - i); });
    light.intensity = 36 + Math.sin(t * 2.0) * 6;
  };
  return { group: g, beaconLocal: new THREE.Vector3(0, 5.5, 0) };
}

// ----------------------------------------------------------------- 04 CONTACT: portal
function createPortal() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#4d4a48', roughness: 0.85 });
  const steps = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 3), stone);
  steps.position.y = 0.1; g.add(steps);
  const step2 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 2.2), stone);
  step2.position.set(0, 0.45, -0.2); g.add(step2);
  const pW = 2.2, pH = 3.4;
  for (const s of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, pH + 0.6, 0.7), stone);
    col.position.set(s * (pW / 2 + 0.27), 0.65 + (pH + 0.6) / 2, -0.2);
    g.add(col);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(pW + 1.5, 0.6, 0.8), stone);
  lintel.position.set(0, 0.65 + pH + 0.6, -0.2); g.add(lintel);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(pW + 0.1, pH + 0.1, 0.05), glowMat('#3fb0ff', 3));
  trim.position.set(0, 0.65 + pH / 2 + 0.05, -0.18); g.add(trim);

  const portalMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * vec2(1.0, 1.55);
        float r = length(p), a = atan(p.y, p.x);
        float swirl = sin(a*5.0 + r*18.0 - uTime*3.0)*0.5+0.5;
        float rings = sin(r*40.0 - uTime*5.0)*0.5+0.5;
        vec3 col = mix(vec3(0.05,0.2,0.6), vec3(0.4,0.8,1.0), swirl*0.7 + rings*0.2);
        col += vec3(0.9,0.97,1.0) * smoothstep(0.35, 0.0, r) * 1.6;
        float edge = smoothstep(0.5, 0.42, max(abs(p.x)*1.0, abs(p.y)*0.645));
        gl_FragColor = vec4(col*2.2, edge);
      }`,
  });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(pW, pH), portalMat);
  portal.position.set(0, 0.65 + pH / 2 + 0.05, -0.15);
  g.add(portal);
  const light = new THREE.PointLight('#3fa8ff', 35, 14, 2);
  light.position.set(0, 2.4, 1.2);
  g.add(light);
  g.traverse((o) => { if (o.isMesh && o !== portal && o !== trim) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.update = (t) => { portalMat.uniforms.uTime.value = t; light.intensity = 32 + Math.sin(t * 3) * 5; };
  return { group: g, beaconLocal: new THREE.Vector3(0, 5.6, 0) };
}

// ----------------------------------------------------------------- main island: signpost + lantern
function createSignpost(mats) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: mats.woodDiff, color: '#7a5636', roughness: 0.9 });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.28), wood);
  post.position.y = 1.8; post.castShadow = true; g.add(post);
  const lines = [['A BRIGHTER', 'TOMORROW'], ['IS BUILT'], ['ONE LINE', 'AT A TIME']];
  lines.forEach((txt, i) => {
    const tex = canvasTex(512, 160, (c, w, h) => {
      c.fillStyle = '#5a3c26'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 40; k++) { c.strokeStyle = `rgba(30,15,5,${0.15 + Math.random() * 0.2})`; c.beginPath(); const y = Math.random() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 3); c.stroke(); }
      c.fillStyle = '#e9d8bf'; c.font = '600 46px Montserrat, sans-serif'; c.textBaseline = 'middle';
      if (txt.length === 1) c.fillText(txt[0], 40, h / 2);
      else { c.fillText(txt[0], 40, h * 0.32); c.fillText(txt[1], 40, h * 0.72); }
      c.strokeStyle = '#e9d8bf'; c.lineWidth = 8; c.beginPath(); c.moveTo(w - 90, h / 2 - 22); c.lineTo(w - 58, h / 2); c.lineTo(w - 90, h / 2 + 22); c.moveTo(w - 120, h / 2); c.lineTo(w - 60, h / 2); c.stroke();
    });
    const board = new THREE.Group();
    const shape = new THREE.Shape();
    const L = 2.3, Hh = 0.72;
    shape.moveTo(0, -Hh / 2); shape.lineTo(L - 0.35, -Hh / 2); shape.lineTo(L, 0); shape.lineTo(L - 0.35, Hh / 2); shape.lineTo(0, Hh / 2); shape.lineTo(0, -Hh / 2);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    // planar UVs on the front face
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k) / L, (pos.getY(k) + Hh / 2) / Hh);
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const m = new THREE.Mesh(geo, [face, wood]);
    m.castShadow = true;
    board.add(m);
    board.position.set(0.1, 3.15 - i * 0.95, 0.14);
    board.rotation.set(0, -0.15 + i * 0.12, (i - 1) * -0.04);
    g.add(board);
  });
  return g;
}

function createLanternPost(lanternModel) {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: '#1d1b19', roughness: 0.5, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.2, 8), iron);
  pole.position.y = 0.6; g.add(pole);
  const lantern = lanternModel.clone();
  lantern.position.y = 1.18;
  lantern.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      if (/crayfish|diffuse|07/i.test(o.material.name) || o.material.color.r > 0.5) {
        o.material.emissive = new THREE.Color('#ffae55');
        o.material.emissiveIntensity = 3;
      }
    }
  });
  g.add(lantern);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), glowMat('#ffc070', 8));
  flame.position.y = 1.5; g.add(flame);
  const light = new THREE.PointLight('#ff9d4a', 5, 10, 2);
  light.position.y = 1.55;
  g.add(light);
  g.userData.update = (t) => { light.intensity = 4.6 + Math.sin(t * 13) * 0.35 + Math.sin(t * 7.3) * 0.35; };
  return g;
}

// ----------------------------------------------------------------- assemble
export function createLandmarks(lib, tex, walk) {
  const out = { group: new THREE.Group(), beacons: [], updaters: [], interactables: [] };
  out.group.name = 'landmarks';
  const journey=createSkillJourney(walk);
  out.group.add(journey.group);out.interactables.push(...journey.interactables);out.beacons.push(...journey.beacons);out.updaters.push(journey.update);
  const mainC = new THREE.Vector3(0, 0, 0);

  const place = (id, built, { faceTo, colliders = [] } = {}) => {
    const isl = island(id);
    const c = new THREE.Vector3(isl.center[0], surfaceHeight(isl, isl.center[0], isl.center[2]) - 0.05, isl.center[2]);
    built.group.position.copy(c);
    if (faceTo) faceTowards(built.group, c, faceTo);
    built.group.name = `landmark:${id}`;
    built.group.userData.editable = true;
    out.group.add(built.group);
    if (built.group.userData.update) out.updaters.push(built.group.userData.update);
    // beacon
    const beacon = createBeacon(9);
    built.group.updateMatrixWorld(true);
    const top = built.beaconLocal.clone().applyMatrix4(built.group.matrixWorld);
    beacon.position.set(top.x, top.y, top.z);
    out.group.add(beacon);
    out.updaters.push(beacon.userData.update);
    out.beacons.push({ id, label: isl.label, anchor: top.clone().add(new THREE.Vector3(0, 9, 0)), base: top.clone() });
    // colliders (local -> world)
    for (const cl of colliders) {
      const p = new THREE.Vector3(cl.x, 0, cl.z).applyMatrix4(built.group.matrixWorld);
      walk.addCollider(p.x, p.z, cl.r, id);
    }
    out.interactables.push({ id, position: c.clone(), radius: built.interactRadius || isl.radius * 0.85 });
  };

  const garden=createMeditationGarden(lib.trees);
  place('about',garden,{faceTo:new THREE.Vector3(0,0,0)});
  const meditation=garden.register(walk);
  const about=out.interactables.find(it=>it.id==='about');
  about.position=meditation.reading;about.radius=2.2;about.label='About me';
  out.interactables.push({id:'meditate',label:'Meditate',position:meditation.seat,radius:1.6,
    activate(player){
      if(player?.meditate(meditation.seat,meditation.heading))return 'Take a quiet moment. Move to stand up.';
    }});

  const gallery = createExperienceGallery();
  place('projects', gallery, {
    faceTo: new THREE.Vector3(0, 0, 0),
    colliders: EXHIBIT_LAYOUT.map(({x,z}) => ({x,z,r:2.1})),
  });
  out.interactables = out.interactables.filter(it => it.id !== 'projects');
  for (const exhibit of gallery.stations) {
    const position = new THREE.Vector3(0, 0, 1.7).applyMatrix4(exhibit.station.matrixWorld);
    out.interactables.push({ id: exhibit.id, label: `Explore ${exhibit.company}`, position, radius: 3.5 });
  }

  const orb = createOrb();
  orb.group.scale.setScalar(0.65);
  const skills = createSkillsExhibits();
  skills.group.add(orb.group);
  const updateSkills = skills.group.userData.update;
  skills.group.userData.update = t => { updateSkills(t); orb.group.userData.update(t); };
  skills.beaconLocal = new THREE.Vector3(0, 6, 0);
  place('skills', skills, { faceTo: new THREE.Vector3(0, 0, 0), colliders: [
    { x: 0, z: 0, r: 2.2 }, ...SKILL_AREAS.map(({x,z}) => ({x,z,r:2})),
  ] });
  out.interactables = out.interactables.filter(it => it.id !== 'skills');
  for (const {area,station} of skills.stations) {
    out.interactables.push({id:`skills-${area.id}`, label:`Explore ${area.title} skills`,
      position:new THREE.Vector3(0,0,1.5).applyMatrix4(station.matrixWorld), radius:3.8});
  }

  place('interest', createInterestObservatory(), { faceTo: new THREE.Vector3(...island('about').center) });
  out.group.add(createInterestStone(walk));
  out.interactables = out.interactables.filter(it => it.id !== 'interest');
  const verticals=createInterestVerticals(lib);
  out.group.add(verticals.group);
  verticals.group.updateMatrixWorld(true);
  for (const {area,station} of verticals.stations) {
    walk.addCollider(station.position.x,station.position.z,2,`interest-${area.id}`);
    out.interactables.push({id:`interest-${area.id}`,label:`Explore ${area.title}`,
      position:new THREE.Vector3(0,0,2.7).applyMatrix4(station.matrixWorld),radius:3.5});
  }

  const portal = createPortal();
  place('contact', portal, { faceTo: new THREE.Vector3(0, 0, 0), colliders: [{ x: -1.6, z: -0.2, r: 0.5 }, { x: 1.6, z: -0.2, r: 0.5 }, { x: 0, z: -0.6, r: 0.9 }] });

  // main island set dressing
  const main = island('main');
  const sign = createSignpost(tex);
  const sx = -4.3, sz = -18.6;
  sign.position.set(sx, surfaceHeight(main, sx, sz) - 0.1, sz);
  sign.rotation.y = 0.6;
  sign.scale.setScalar(0.62);
  sign.name = 'signpost';
  sign.userData.editable = true;
  out.group.add(sign);
  walk.addCollider(sx, sz, 0.5, 'sign');

  const lp = createLanternPost(lib.lantern);
  const lx = -2.75, lz = -19.4;
  lp.position.set(lx, surfaceHeight(main, lx, lz) - 0.05, lz);
  lp.name = 'lantern';
  lp.userData.editable = true;
  out.group.add(lp);
  out.updaters.push(lp.userData.update);
  walk.addCollider(lx, lz, 0.35, 'lantern');

  if (lib.telescope) {
    const ts = lib.telescope.clone();
    const tx = 8.5, tz = -14;
    ts.position.set(tx, surfaceHeight(main, tx, tz), tz);
    ts.rotation.y = 2.4;
    ts.name = 'telescope';
    ts.userData.editable = true;
    out.group.add(ts);
    walk.addCollider(tx, tz, 0.6, 'telescope');
  }
  // A hidden shrine on an already-unlabeled island: no beacon, HUD label or sign.
  const shrine=createAIShrine(walk);
  out.group.add(shrine);out.updaters.push(shrine.userData.update);
  // Scenic islands retain open routes around their set pieces.
  // Quiet markers describe the symbolism without inventing personal history.
  const pastSignTexture = (entrance) => canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#1d232b'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#788795'; c.lineWidth = 4; c.strokeRect(25, 25, w - 50, h - 50);
    c.textAlign = 'center'; c.fillStyle = '#d3dbe1';
    c.font = '500 76px sans-serif'; c.fillText('DARK PAST', w / 2, 170);
    c.font = '32px sans-serif'; c.fillText('SUMMER 2011', w / 2, 275);
    c.fillText(`${PAST_YEARS.toFixed(2)} years · ${PAST_YEARS.toFixed(2)}× the crossing`, w / 2, 355);
    if (entrance) {
      c.font = '26px sans-serif'; c.fillStyle = '#aebbc7';
      c.fillText('Do you really want to know? It is so far back there', w / 2, 432);
    }
  });
  const markerMat = new THREE.MeshStandardMaterial({ color: '#363e47', roughness: 1 });
  const pastBridge = walk.bridges.find((b) => b.to === 'past');
  const ghosts = createPastGhosts(pastBridge, undefined, lib.ghost);
  out.group.add(ghosts);
  out.updaters.push(ghosts.userData.update);
  const prison = createPastPrison(walk);
  out.group.add(prison);
  out.updaters.push(prison.userData.update);
  out.interactables.push(prison.userData.interactable);
  for (const [id, x, z] of [
    ['grove', pastBridge.pa.x + 2, pastBridge.pa.z + 3.2],
    ['past', island('past').center[0], island('past').center[2]],
  ]) {
    const marker = new THREE.Group();
    const texture = pastSignTexture(id === 'grove');
    const inscriptionMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 0.25 });
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3, 4.4), markerMat);
    stone.position.y = 1.5; stone.castShadow = true; stone.receiveShadow = true;
    marker.add(stone);
    const inscription = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), inscriptionMat);
    inscription.position.set(0.31, 1.8, 0); inscription.rotation.y = Math.PI / 2;
    marker.add(inscription);
    marker.position.set(x, surfaceHeight(island(id), x, z), z);
    marker.name = `marker:past:${id}`; marker.userData.editable = true;
    out.group.add(marker);
    for (const dz of [-1.6, -0.8, 0, 0.8, 1.6]) walk.addCollider(x, z + dz, 0.5, marker.name);
  }

  for (const [id, offsets] of [
    ['grove', [[-3, 1], [3, -1]]],
    ['lookout', [[-3, 2]]],
  ]) {
    const isl = island(id);
    for (const [index, [dx, dz]] of offsets.entries()) {
      const post = createLanternPost(lib.lantern);
      const x = isl.center[0] + dx, z = isl.center[2] + dz;
      post.position.set(x, surfaceHeight(isl, x, z) - 0.05, z);
      post.name = `lantern:${id}:${index}`;
      post.userData.editable = true;
      out.group.add(post);
      out.updaters.push(post.userData.update);
      walk.addCollider(x, z, 0.35, post.name);
    }
  }
  if (lib.telescope) {
    const isl = island('lookout');
    const telescope = lib.telescope.clone();
    const x = isl.center[0] + 3, z = isl.center[2] - 4;
    telescope.position.set(x, surfaceHeight(isl, x, z), z);
    telescope.rotation.y = 2.4;
    telescope.name = 'telescope:lookout';
    telescope.userData.editable = true;
    out.group.add(telescope);
    walk.addCollider(x, z, 0.6, telescope.name);
  }
  return out;
}
