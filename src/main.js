import * as THREE from 'three';
import { installSunsetFog } from './core/fog.js';
import { manager, loadModel, loadTex, loadHDR, normalizeModel } from './core/assets.js';
import { createPost } from './core/post.js';
import { ISLANDS, SPAWN, SUN_DIR, buildBridgeData, island, surfaceHeight } from './world/layout.js';
import { createSky } from './world/sky.js';
import { createMountains } from './world/mountains.js';
import { createIsland, createIslandMaterials } from './world/island.js';
import { createBridge, createBridgeMaterials } from './world/bridge.js';
import { Walkable } from './world/walkable.js';
import { createWater, createClouds, createWaterfall, createFireflies } from './world/effects.js';
import { createForest, prepPine, createGrass, scatterProps, prepProp, prepVariants, createFlowers } from './world/vegetation.js';
import { createLandmarks } from './world/landmarks.js';
import { Player, FollowCamera } from './player/player.js';
import { createHUD } from './ui/hud.js';
import { applyLayout } from './core/layoutStore.js';
import { createPastAtmosphere } from './world/atmosphere.js';
import { createDog } from './world/dog.js';
import { createDogModel } from './world/dogModel.js';
import { INTEREST_VERTICALS } from './interests.js';

installSunsetFog(SUN_DIR);

// ------------------------------------------------------------------ renderer
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const MAX_DPR = Math.min(window.devicePixelRatio, 1.5);
let dpr = MAX_DPR;
renderer.setPixelRatio(dpr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#55658c', 0.00075);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 9000);
camera.layers.enable(1); // layer 1: small detail the water reflection skips

// ------------------------------------------------------------------ lighting
// Key light: warm low sun. Its *lighting* elevation is higher than the visual
// sun disc so island tops still catch light while the sky reads as sunset.
const lightDir = new THREE.Vector3(SUN_DIR.x, 0.42, SUN_DIR.z).normalize();
const sun = new THREE.DirectionalLight('#ffc49a', 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
// Cool sky fill from the opposite side keeps silhouettes readable (blue hour)
const fill = new THREE.DirectionalLight('#7f9be0', 1.1);
fill.position.set(-SUN_DIR.x, 0.6, -SUN_DIR.z).multiplyScalar(100);
scene.add(fill);
// Rim light skimming from the visual sun for golden edges
const rim = new THREE.DirectionalLight('#ff9c5c', 1.2);
rim.position.copy(SUN_DIR).multiplyScalar(100).setY(12);
scene.add(rim);
const hemi = new THREE.HemisphereLight('#8ea8e0', '#2c2a2a', 0.75);
scene.add(hemi);

// ------------------------------------------------------------------ static world
const sky = createSky(SUN_DIR);
scene.add(sky);

const tex = {
  groundDiff: loadTex('forrest_ground_01/forrest_ground_01_diff_1k.jpg', { repeat: 1 }),
  groundNor: loadTex('forrest_ground_01/forrest_ground_01_nor_gl_1k.jpg', { srgb: false }),
  groundRough: loadTex('forrest_ground_01/forrest_ground_01_rough_1k.jpg', { srgb: false }),
  rockDiff: loadTex('rock_face_03/rock_face_03_diff_1k.jpg'),
  rockNor: loadTex('rock_face_03/rock_face_03_nor_gl_1k.jpg', { srgb: false }),
  woodDiff: loadTex('wood_planks_grey/wood_planks_grey_diff_1k.jpg'),
  woodNor: loadTex('wood_planks_grey/wood_planks_grey_nor_gl_1k.jpg', { srgb: false }),
  water: loadTex('waternormals.jpg', { srgb: false }),
};

const bridges = buildBridgeData();
const walk = new Walkable(bridges);
const world = new THREE.Group();
world.name = 'world';
scene.add(world);

const islandMats = createIslandMaterials(tex);
const pastIslandMats = { ground: islandMats.ground.clone(), rock: islandMats.rock.clone() };
pastIslandMats.ground.color.set('#626972');
pastIslandMats.rock.color.set('#666b76');
for (const isl of ISLANDS) world.add(createIsland(isl, isl.gloomy ? pastIslandMats : islandMats));
const bridgeMats = createBridgeMaterials(tex);
const pastBridgeMats = Object.fromEntries(Object.entries(bridgeMats).map(([key, mat]) => [key, mat.clone()]));
pastBridgeMats.plank.color.set('#777c83');
pastBridgeMats.bulb.color.set('#a9bed0').multiplyScalar(1.8);
for (const br of bridges) world.add(createBridge(br, br.gloomy ? pastBridgeMats : bridgeMats));

const mtnRock = loadTex('rock_face_03/rock_face_03_diff_1k.jpg');
scene.add(createMountains(SUN_DIR, mtnRock));
const water = createWater(SUN_DIR, tex.water);
scene.add(water);
const clouds = createClouds(SUN_DIR);
scene.add(clouds);

// waterfalls pouring off the rims (reference: projects + skills islands)
const updaters = [sky.userData.update, water.userData.update, clouds.userData.update];
function addWaterfall(id, ang, width, height) {
  const isl = island(id);
  const r = isl.radius * 0.97;
  const x = isl.center[0] + Math.cos(ang) * r, z = isl.center[2] + Math.sin(ang) * r;
  const top = new THREE.Vector3(x, surfaceHeight(isl, x, z) - 0.6, z);
  const wf = createWaterfall({ top, dir: new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)), width, height });
  scene.add(wf);
  updaters.push(wf.userData.update);
}
addWaterfall('projects', Math.PI * 0.32, 3.2, 62);
addWaterfall('projects', Math.PI * 0.12, 2.0, 55);
addWaterfall('skills', Math.PI * 0.45, 2.4, 60);
addWaterfall('about', Math.PI * 0.9, 1.6, 50);

const fireflies = createFireflies(160, new THREE.Vector3(10, -12, -70), new THREE.Vector3(150, 22, 170));
scene.add(fireflies);
updaters.push(fireflies.userData.update);

// sun glare: big additive sprites far away, depth-tested so peaks occlude them
function glareTex(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const sunGlare = new THREE.Group();
for (const [size, stops, k] of [
  [420, [[0, 'rgba(255,236,200,1)'], [0.06, 'rgba(255,205,140,.85)'], [0.25, 'rgba(255,140,70,.18)'], [1, 'rgba(255,100,50,0)']], 0.45],
  [1400, [[0, 'rgba(255,170,100,.3)'], [1, 'rgba(255,120,60,0)']], 0.15],
]) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glareTex(stops), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, toneMapped: false }));
  sp.material.color.setScalar(k);
  sp.scale.set(size, size, 1);
  sunGlare.add(sp);
}
sunGlare.position.copy(SUN_DIR).multiplyScalar(3200);
scene.add(sunGlare);
updaters.push((t, camPos) => sunGlare.position.copy(SUN_DIR).multiplyScalar(3200).add(camPos));

// ------------------------------------------------------------------ player
const follow = new FollowCamera(camera, canvas, walk);
let player = null;
let landmarks = null;
const hud = createHUD({ camera, walk, bridges });

// ------------------------------------------------------------------ async assets
async function loadAll() {
  const [envHDR, adventurer, femaleAsset, dogAsset, ghostAsset, interestModels, ...rest] = await Promise.all([
    loadHDR('qwantani_dusk_2_puresky'),
    loadModel('adventurer'),
    loadModel('female'),
    loadModel('dog'),
    loadModel('ghost'),
    Promise.all(INTEREST_VERTICALS.map(async area=>[area.model,(await loadModel(area.model)).scene])),
    loadModel('pine_a'), loadModel('pine_b'), loadModel('pine_c'), loadModel('pine_d'),
    loadModel('rock_moss_set_01'), loadModel('rock_moss_set_02'), loadModel('rock_07'), loadModel('namaqualand_cliff_01'),
    loadModel('fern_02'), loadModel('shrub_02'), loadModel('tree_stump_01'), loadModel('dead_tree_trunk'), loadModel('rock_face_01'),
    loadModel('lantern'), loadModel('telescope'),
  ]);
  const [pa, pb, pc, pd, rm1, rm2, r7, cliff, fern, shrub, stump, trunk, rface, lantern, telescope] = rest;

  // image based lighting for reflections/ambient (background stays the painted sky)
  const pmrem = new THREE.PMREMGenerator(renderer);
  envHDR.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(envHDR).texture;
  scene.environmentIntensity = 0.45;
  envHDR.dispose();

  const pines = [prepPine(pa), prepPine(pb), prepPine(pc), prepPine(pd)];
  const lib = {
    trees: pines,
    ghost: ghostAsset,
    rocks: [...prepVariants(rm1, 1.6, '#b9b4ad'), ...prepVariants(rm2, 1.6, '#b9b4ad'), ...prepVariants(r7, 1.8, '#b0aaa4')],
    ferns: prepVariants(fern, 1.2, '#a7b88f'),
    shrubs: prepVariants(shrub, 1.4, '#a7b88f'),
    stump: prepProp(stump, 1.4),
    trunk: prepProp(trunk, 4.5),
    cliff: prepProp(cliff, 2.4, '#a9a39d'),
    rockFace: prepProp(rface, 2.4, '#a9a39d'),
    lantern: normalizeModel(lantern.scene, { height: 0.55 }),
    telescope: normalizeModel(telescope.scene, { height: 1.6 }),
    ...Object.fromEntries(interestModels),
  };

  landmarks = createLandmarks(lib, tex, walk);
  scene.add(landmarks.group);
  updaters.push(...landmarks.updaters);

  scene.add(createForest(pines, walk));
  const grass = createGrass(walk);
  scene.add(grass);
  updaters.push(grass.userData.update);
  scene.add(scatterProps(lib, walk));
  scene.add(createFlowers(walk));

  player = new Player(adventurer, walk, femaleAsset);
  const sp = SPAWN.clone();
  sp.y = surfaceHeight(island('main'), sp.x, sp.z);
  player.teleport(sp, Math.PI);
  scene.add(player.root);
  follow.yaw = player.heading + Math.PI;
  follow.pitch = 0.22;
  fitCamera();
  follow.dist = follow.targetDist;
  follow.snap(player.position);

  hud.init({ player, follow, landmarks, scene, renderer });
  await applyLayout(scene);
  const dog = createDog(walk, player, Math.random, createDogModel(dogAsset));
  scene.add(dog);
  landmarks.interactables.push(dog.userData.interactable);
  updaters.push(dog.userData.update);

  // pre-compile shaders to avoid hitches when looking around
  renderer.compile(scene, camera);
}

manager.onProgress = (_url, loaded, total) => hud.progress(loaded / total);

// ------------------------------------------------------------------ loop
const post = createPost(renderer, scene, camera);
const updateAtmosphere = createPastAtmosphere({ scene, sun, fill, rim, hemi, sky, sunGlare, post, bridge: bridges.find((b) => b.to === 'past') });
const clock = new THREE.Clock();
let elapsed = 0;

const stats = { fps: 0, calls: 0, tris: 0, _n: 0, _t: performance.now() };
renderer.info.autoReset = false;

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  renderer.info.reset();
  elapsed += dt;
  if (player) {
    const editing = window.__editorActive;
    player.enabled = !editing && hud.hasStarted();
    follow.enabled = !editing && hud.hasStarted();
    player.update(dt, follow.getMovementYaw(player.input));
    if (!editing) follow.update(dt, player.position, false, player.heading);
    updateAtmosphere(dt, player.position);
    // shadow frustum follows the player (texel-snapped to avoid shimmering)
    const tgt = player.position;
    const texel = (sc.right - sc.left) / sun.shadow.mapSize.x;
    const snapX = Math.round(tgt.x / texel) * texel, snapZ = Math.round(tgt.z / texel) * texel;
    sun.target.position.set(snapX, tgt.y, snapZ - 25);
    sun.position.copy(sun.target.position).addScaledVector(lightDir, 180);
    hud.update(dt, elapsed);
  }
  for (const u of updaters) u(elapsed, camera.position, player, dt);
  post.render(elapsed);
  stats._n++;
  const now = performance.now();
  if (now - stats._t > 1000) {
    stats.fps = (stats._n * 1000) / (now - stats._t);
    // adaptive resolution: trade pixels for a smooth frame rate
    if (!document.hidden && player) {
      const next = stats.fps < 40 ? Math.max(0.75, dpr - 0.15) : stats.fps > 58 ? Math.min(MAX_DPR, dpr + 0.1) : dpr;
      if (Math.abs(next - dpr) > 0.01) {
        dpr = next;
        renderer.setPixelRatio(dpr);
        post.setSize(window.innerWidth, window.innerHeight);
      }
    }
    stats.dpr = dpr;
    stats.calls = renderer.info.render.calls;
    stats.tris = renderer.info.render.triangles;
    stats._n = 0; stats._t = now;
  }
  requestAnimationFrame(frame);
}

function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  // portrait phones: wider lens, pull back and centre the hero
  const portrait = aspect < 0.9;
  camera.fov = portrait ? 68 : 50;
  follow.shoulder = portrait ? 0 : 0.9;
  follow.targetDist = portrait ? 6.4 : 4.8;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', () => {
  fitCamera();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
});

// initial composition before assets arrive
camera.position.set(0, 3, 15);
camera.lookAt(10, 0, -60);

loadAll().then(() => hud.ready()).catch((e) => { console.error(e); hud.error(e); });
requestAnimationFrame(frame);

// expose for the dev editor & debugging
window.__app = { scene, camera, renderer, walk, get player() { return player; }, follow, post, sun, stats };

if (import.meta.env.DEV) {
  import('./dev/editor.js').then((m) => m.installEditor(window.__app));
}
