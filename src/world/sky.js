import * as THREE from 'three';

/**
 * Painted sunset sky dome: zenith-to-horizon gradient, sun disc with layered glow,
 * procedural FBM cloud bands lit from the sun side, and twinkling stars at the top.
 */
export function createSky(sunDir) {
  const uniforms = {
    uSunDir: { value: sunDir.clone() },
    uTime: { value: 0 },
    uGloom: { value: 0 },
    uZenith: { value: new THREE.Color('#0e1a33') },
    uMid: { value: new THREE.Color('#3b4a75') },
    uHorizon: { value: new THREE.Color('#f39a5a') },
    uHorizonFar: { value: new THREE.Color('#9b6f88') },
    uSunColor: { value: new THREE.Color('#ffd7a0') },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w; // keep at far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uZenith, uMid, uHorizon, uHorizonFar, uSunColor;
      uniform float uTime, uGloom;
      varying vec3 vDir;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 6; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
        return s;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
        float sunSide = pow(max(dot(normalize(vec3(d.x,0.0,d.z)), normalize(vec3(uSunDir.x,0.0,uSunDir.z))), 0.0), 2.0);

        // base gradient
        vec3 horizon = mix(uHorizonFar, uHorizon, sunSide);
        vec3 col = mix(horizon, uMid, smoothstep(0.0, 0.22, h));
        col = mix(col, uZenith, smoothstep(0.18, 0.75, h));
        // below horizon: haze
        col = mix(col, mix(vec3(0.24,0.25,0.36), horizon*0.9, 0.5), smoothstep(0.0, -0.15, h));

        // sun glow layers
        col += uSunColor * pow(sunDot, 6.0) * 0.3;
        col += vec3(1.0,0.55,0.25) * pow(sunDot, 48.0) * 0.55;

        // clouds (two layers projected on a dome)
        if (h > -0.02) {
          vec2 uv = d.xz / (h + 0.12);
          float t = uTime * 0.004;
          float c1 = fbm(uv * 0.9 + vec2(t, t*0.3));
          float c2 = fbm(uv * 2.4 - vec2(t*1.5, 0.0) + 4.0);
          float band = smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.35, 0.7, h));
          float cov = smoothstep(0.5, 0.78, c1 * 0.75 + c2 * 0.35) * band;
          cov *= 1.0 - 0.75 * pow(sunDot, 40.0); // clear window around the sun
          // light the clouds: warm rim towards the sun, purple/blue elsewhere
          vec3 lit = mix(vec3(0.28,0.24,0.38), vec3(1.0,0.62,0.38), pow(sunDot, 3.0) * 0.9 + sunSide*0.25);
          lit += vec3(1.0,0.75,0.5) * pow(sunDot, 12.0) * 1.2;
          col = mix(col, lit, cov * 0.85);
          // thin high wisps
          float w = smoothstep(0.55, 0.85, fbm(uv * vec2(0.4, 2.0) + vec2(-t*2.0, 3.0)));
          col += vec3(0.9,0.5,0.45) * w * 0.12 * smoothstep(0.05, 0.3, h) * (0.3 + sunSide);
        }

        // sun disc + hot core drawn over the clouds
        col += vec3(1.0,0.8,0.55) * pow(sunDot, 700.0) * 2.5;
        float disc = smoothstep(0.99955, 0.99975, sunDot);
        col = mix(col, vec3(1.0,0.95,0.84) * 5.0, disc);

        // stars
        float starMask = smoothstep(0.25, 0.75, h);
        vec3 sp = d * 420.0;
        vec3 cell = floor(sp);
        float r = hash3(cell);
        if (r > 0.9975) {
          vec3 f = fract(sp) - 0.5;
          float s = smoothstep(0.18, 0.0, length(f));
          float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 6.0) + r * 100.0);
          col += vec3(0.85, 0.92, 1.0) * s * tw * starMask * 1.6;
        }

        // Overcast sky replaces the sunset and sun disc along the past crossing.
        float storm = fbm(d.xz / (max(h, 0.0) + 0.3) * 1.8 + uTime * 0.008);
        vec3 overcast = mix(vec3(0.045,0.055,0.073), vec3(0.19,0.22,0.26), 1.0 - smoothstep(0.0, 0.8, h));
        overcast *= 0.7 + storm * 0.5;
        col = mix(col, overcast, uGloom);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 64, 32), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  mesh.userData.update = (t, camPos) => { uniforms.uTime.value = t; mesh.position.copy(camPos); };
  return mesh;
}
