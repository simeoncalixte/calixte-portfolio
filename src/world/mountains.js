import * as THREE from 'three';
import { createNoise2D, fbm, ridged, smoothstep } from '../core/noise.js';

export const WATER_LEVEL = -62;
export const VALLEY_CENTER = new THREE.Vector2(15, -80);

/**
 * Distant alpine range + valley floor around the lake. Built as a polar mesh
 * (dense close in, sparse far away). Peaks use domain-warped ridged noise; the
 * material does per-pixel triplanar rock + slope/height snow so ridgelines stay
 * crisp at any distance. The range opens towards the sun so the sunset reflects
 * on the lake as in the reference.
 */
export function createMountains(sunDir, rockTex) {
  const n = createNoise2D(42);
  const n2 = createNoise2D(99);
  const n3 = createNoise2D(7);
  const sunAng = Math.atan2(sunDir.z, sunDir.x);
  const C = VALLEY_CENTER;

  const A = 760, R = 210; // angular / radial segments
  const rMin = 120, rMax = 2600;
  const positions = new Float32Array((A + 1) * (R + 1) * 3);
  const heights = new Float32Array((A + 1) * (R + 1));

  const heightAt = (x, z) => {
    const dx = x - C.x, dz = z - C.y;
    const d = Math.hypot(dx, dz);
    const ang = Math.atan2(dz, dx);
    const da = Math.abs(Math.atan2(Math.sin(ang - sunAng), Math.cos(ang - sunAng)));
    const open = smoothstep(0.22, 1.1, da); // 0 = towards the sun (lake opening)
    const behind = smoothstep(0.1, -0.85, dz / Math.max(d, 1)); // big peaks behind the islands
    // domain warp for natural, branching ridges
    const wx = x + 140 * fbm(n2, x * 0.0012, z * 0.0012, 3);
    const wz = z + 140 * fbm(n2, x * 0.0012 + 31, z * 0.0012 - 17, 3);
    let r = ridged(n, wx * 0.0011, wz * 0.0011, 7);
    r = Math.pow(r, 1.35);
    const massif = fbm(n3, x * 0.0007, z * 0.0007, 3) * 0.5 + 0.5;
    const ring = smoothstep(520, 1150, d);
    let h = ring * r * 380 * (0.45 + 0.75 * massif) * (0.06 + 0.94 * open) * (0.7 + 0.6 * behind);
    // gentle rolling ranges where the valley opens towards the sun
    h += (1 - open) * ring * (fbm(n3, x * 0.0016, z * 0.0016, 4) * 0.5 + 0.5) * 70;
    // foothills, shore and lake islets
    const hills = fbm(n2, x * 0.006, z * 0.006, 5);
    h += WATER_LEVEL - 8 + smoothstep(200, 520, d) * (34 + hills * 30) + smoothstep(140, 260, d) * hills * 10;
    const islet = Math.max(0, fbm(n, x * 0.018 + 5, z * 0.018, 4) - 0.38) * 70 * smoothstep(150, 230, d) * (0.3 + 0.7 * open);
    h += islet;
    // far away everything rises to fill the horizon
    h += smoothstep(1400, 2400, d) * 180 * (0.5 + massif) * (0.02 + 0.98 * open);
    return h;
  };

  let k = 0;
  for (let j = 0; j <= R; j++) {
    const t = j / R;
    const rad = rMin + (rMax - rMin) * Math.pow(t, 2.1);
    for (let i = 0; i <= A; i++) {
      const a = (i / A) * Math.PI * 2;
      const x = C.x + Math.cos(a) * rad, z = C.y + Math.sin(a) * rad;
      const h = heightAt(x, z);
      positions[k * 3] = x; positions[k * 3 + 1] = h; positions[k * 3 + 2] = z;
      heights[k++] = h;
    }
  }
  const idx = [];
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < A; i++) {
      const a = j * (A + 1) + i, b = a + 1, c = a + (A + 1), d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  // vertex colour carries the low-frequency biome (forest/shore/rock)
  const nor = geo.attributes.normal;
  const colors = new Float32Array(positions.length);
  const rock = new THREE.Color('#3d3d44'), rockWarm = new THREE.Color('#544641'), rockCool = new THREE.Color('#2c3342');
  const forest = new THREE.Color('#0f1f17'), forest2 = new THREE.Color('#172a1d'), sand = new THREE.Color('#3a3a33');
  const c = new THREE.Color();
  for (let i = 0; i < heights.length; i++) {
    const x = positions[i * 3], z = positions[i * 3 + 2], h = heights[i];
    const slope = 1 - nor.getY(i);
    const v = n(x * 0.02, z * 0.02) * 0.5 + 0.5;
    c.copy(rock).lerp(rockWarm, v * 0.5).lerp(rockCool, smoothstep(0.3, 0.7, n3(x * 0.004, z * 0.004) * 0.5 + 0.5) * 0.6);
    const forestAmt = (1 - smoothstep(30, 150, h - WATER_LEVEL)) * (1 - smoothstep(0.3, 0.55, slope));
    c.lerp(v > 0.5 ? forest : forest2, forestAmt);
    if (h < WATER_LEVEL + 2.5) c.lerp(sand, 0.7);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.55 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tRock = { value: rockTex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNor;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz; vWNor = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tRock; varying vec3 vWPos; varying vec3 vWNor;
        float mh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float mn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(mh(i),mh(i+vec2(1,0)),f.x), mix(mh(i+vec2(0,1)),mh(i+vec2(1,1)),f.x), f.y); }
        vec3 triplanar(sampler2D t, vec3 p, vec3 n, float s){
          vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x+w.y+w.z);
          return texture2D(t, p.zy*s).rgb*w.x + texture2D(t, p.xz*s).rgb*w.y + texture2D(t, p.xy*s).rgb*w.z;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 n = normalize(vWNor);
          vec3 det = triplanar(tRock, vWPos, n, 1.0/36.0) * 0.6 + triplanar(tRock, vWPos, n, 1.0/170.0) * 0.6;
          float lum = dot(det, vec3(0.333));
          diffuseColor.rgb *= mix(0.65, 1.55, lum);
          // snow: height + slope + breakup noise, crisp edge
          float brk = mn(vWPos.xz*0.02)*0.6 + mn(vWPos.xz*0.09)*0.4;
          float line = 40.0 + brk*70.0 - n.y*30.0;
          float snow = smoothstep(line, line+18.0, vWPos.y) * smoothstep(0.42, 0.7, n.y + brk*0.25 - lum*0.25);
          // gullies keep snow even on steeper faces
          snow = max(snow, smoothstep(line+60.0, line+120.0, vWPos.y) * smoothstep(0.25, 0.45, n.y + brk*0.2) * 0.85);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86,0.9,0.98) * mix(0.8, 1.05, lum), clamp(snow,0.0,1.0));
        }`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'mountains';
  mesh.frustumCulled = false;
  return mesh;
}
