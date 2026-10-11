import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { mulberry32 } from '../core/noise.js';
import { WATER_LEVEL } from './mountains.js';

// ---------------------------------------------------------------- water
export function createWater(sunDir, normals) {
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
  const water = new Water(new THREE.PlaneGeometry(6000, 6000), {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals: normals,
    sunDirection: sunDir.clone(),
    sunColor: 0xffb070,
    waterColor: 0x061523,
    distortionScale: 2.2,
    fog: true,
    alpha: 1,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  water.material.uniforms.size.value = 6;
  water.userData.update = (t) => { water.material.uniforms.time.value = t * 0.35; };
  return water;
}

// ---------------------------------------------------------------- soft textures
function radialTexture(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function cloudTexture(seed = 3) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const rand = mulberry32(seed);
  for (let i = 0; i < 46; i++) {
    const r = size * (0.08 + rand() * 0.16);
    const x = size / 2 + (rand() - 0.5) * size * 0.55;
    const y = size / 2 + (rand() - 0.5) * size * 0.3;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.32)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- cloud sea
/**
 * Billboarded cloud puffs drifting between the islands. Each is tinted by how
 * much it faces the sun so they read as lit volumes at sunset.
 */
export function createClouds(sunDir) {
  const group = new THREE.Group();
  group.name = 'clouds';
  const rand = mulberry32(77);
  const texs = [cloudTexture(3), cloudTexture(8), cloudTexture(15)];
  const warm = new THREE.Color('#ffc09a'), cool = new THREE.Color('#98a2c8');
  const sunH = new THREE.Vector2(sunDir.x, sunDir.z).normalize();
  const items = [];
  const add = (x, y, z, scale, opacity) => {
    const v = new THREE.Vector2(x - 15, z + 80).normalize();
    const facing = Math.max(0, v.dot(sunH));
    const col = cool.clone().lerp(warm, Math.pow(facing, 3) * 0.75);
    const mat = new THREE.SpriteMaterial({ map: texs[Math.floor(rand() * 3)], color: col, transparent: true, opacity, depthWrite: false, fog: true });
    const sp = new THREE.Sprite(mat);
    sp.position.set(x, y, z);
    sp.scale.set(scale * (1.6 + rand() * 0.8), scale, 1);
    sp.material.rotation = (rand() - 0.5) * 0.2;
    sp.userData.base = sp.position.clone();
    sp.userData.speed = 0.3 + rand() * 0.6;
    group.add(sp);
    items.push(sp);
  };
  // low layer of cloud sea around the island bases
  for (let i = 0; i < 120; i++) {
    const a = rand() * Math.PI * 2, d = 20 + rand() * 170;
    add(15 + Math.cos(a) * d, -30 - rand() * 18, -80 + Math.sin(a) * d, 26 + rand() * 36, 0.45 + rand() * 0.35);
  }
  // wisps between islands
  for (let i = 0; i < 30; i++) {
    add(-70 + rand() * 180, -38 + rand() * 20, -180 + rand() * 170, 14 + rand() * 16, 0.18 + rand() * 0.2);
  }
  // distant banks at the foot of the mountains
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2, d = 300 + rand() * 300;
    add(15 + Math.cos(a) * d, -55 + rand() * 35, -80 + Math.sin(a) * d, 90 + rand() * 80, 0.14 + rand() * 0.16);
  }
  group.userData.update = (t) => {
    for (const s of items) {
      s.position.x = s.userData.base.x + Math.sin(t * 0.02 * s.userData.speed + s.userData.base.z) * 6;
    }
  };
  return group;
}

// ---------------------------------------------------------------- waterfalls
export function createWaterfall({ top, dir, width = 3, height = 70 }) {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 } };
  const geo = new THREE.PlaneGeometry(width, height, 8, 60);
  // bend the plane outward like water arcing off a lip
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i); // +h/2 .. -h/2
    const t = (height / 2 - y) / height; // 0 top -> 1 bottom
    pos.setZ(i, Math.sqrt(t) * 4.5 + t * 2);
    pos.setX(i, pos.getX(i) * (1 + t * 1.8));
  }
  geo.translate(0, -height / 2, 0);
  geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = vUv;
        float streak = n(vec2(uv.x*18.0, uv.y*3.0 + uTime*2.6)) * 0.6 + n(vec2(uv.x*40.0, uv.y*7.0 + uTime*4.0)) * 0.4;
        float edge = smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x);
        float fade = smoothstep(0.0, 0.45, uv.y);          // fade out at the bottom (into mist)
        float topFade = smoothstep(1.0, 0.97, uv.y);
        float s = smoothstep(0.35, 0.95, streak);
        float a = (0.06 + s * 0.7) * edge * fade * topFade;
        vec3 col = mix(vec3(0.42,0.58,0.72), vec3(0.95,0.97,1.0), s);
        gl_FragColor = vec4(col * 1.15, a * 0.8);
      }`,
  });
  const sheet = new THREE.Mesh(geo, mat);
  group.add(sheet);

  // mist at the lip and lower down
  const mistTex = radialTexture([[0, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
  const mists = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: '#cfe3ff', transparent: true, opacity: 0.22, depthWrite: false }));
    const t = 0.35 + i * 0.12;
    m.position.set((Math.random() - 0.5) * 3, -height * t, 4 + t * 5);
    const sc = 8 + i * 4;
    m.scale.set(sc, sc, 1);
    group.add(m);
    mists.push(m);
  }
  group.position.copy(top);
  group.rotation.y = Math.atan2(dir.x, dir.z);
  group.userData.update = (t) => {
    uniforms.uTime.value = t;
    mists.forEach((m, i) => { m.material.opacity = 0.18 + 0.06 * Math.sin(t * 0.8 + i); });
  };
  return group;
}

// ---------------------------------------------------------------- fireflies
export function createFireflies(count, center, spread) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  const rand = mulberry32(5);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center.x + (rand() - 0.5) * spread.x;
    pos[i * 3 + 1] = center.y + rand() * spread.y;
    pos[i * 3 + 2] = center.z + (rand() - 0.5) * spread.z;
    seed[i] = rand() * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixel: { value: Math.min(window.devicePixelRatio, 2) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float seed; uniform float uTime, uPixel; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime*0.6 + seed) * 0.8; p.y += sin(uTime*0.9 + seed*1.7) * 0.5; p.z += cos(uTime*0.5 + seed*0.7) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        vA = 0.5 + 0.5 * sin(uTime*2.5 + seed*3.0);
        gl_PointSize = uPixel * 14.0 * (8.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vec3(1.0,0.82,0.45)*2.5, a*a*vA); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return pts;
}

// ---------------------------------------------------------------- beacon beam
/** Thin cyan light beam rising from a landmark, with a pulsing ground ring. */
export function createBeacon(height = 9) {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#4fd8f0') } };
  const beamMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float core = smoothstep(0.5, 0.0, abs(vUv.x-0.5));
        float flow = 0.75 + 0.25*sin(vUv.y*30.0 - uTime*4.0);
        float a = core * (0.25 + 0.75*smoothstep(0.0,0.2,vUv.y)) * smoothstep(1.0, 0.6, vUv.y) * flow;
        gl_FragColor = vec4(uColor*3.0, a);
      }`,
  });
  const beamGeo = new THREE.CylinderGeometry(0.06, 0.06, height, 8, 1, true);
  beamGeo.translate(0, height / 2, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  group.add(beam);
  const glowGeo = new THREE.CylinderGeometry(0.35, 0.35, height, 12, 1, true);
  glowGeo.translate(0, height / 2, 0);
  const glow = new THREE.Mesh(glowGeo, beamMat.clone());
  glow.material.uniforms = { uTime: uniforms.uTime, uColor: { value: new THREE.Color('#2aa6c8').multiplyScalar(0.25) } };
  group.add(glow);

  const ringMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float r = length(vUv-0.5)*2.0;
        float p = fract(uTime*0.4);
        float ring = smoothstep(0.06,0.0,abs(r-p)) * (1.0-p);
        float core = smoothstep(0.35,0.0,r)*0.6;
        gl_FragColor = vec4(uColor*2.0, (ring+core)*0.8);
      }`,
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);
  group.userData.top = new THREE.Vector3(0, height, 0);
  group.userData.update = (t) => { uniforms.uTime.value = t; };
  return group;
}
