import * as THREE from 'three';

/**
 * Patches three's fog chunks globally so every material gets:
 *  - aerial perspective that turns warm/orange when looking towards the sun
 *  - height fog that thickens below the islands (cloud sea / lake haze)
 * Must be called before any material compiles.
 */
export function installSunsetFog(sunDir, warm = '#e79a6c') {
  const s = sunDir.clone().normalize();
  const w = new THREE.Color(warm);
  const v3 = (x, y, z) => `vec3(${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)})`;

  THREE.ShaderChunk.fog_pars_vertex = `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorldPos;
#endif`;
  THREE.ShaderChunk.fog_vertex = `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorldPos = (inverse(viewMatrix) * mvPosition).xyz;
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorldPos;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  vec3 fogDir = normalize(vFogWorldPos - cameraPosition);
  float sunAmt = pow(max(dot(fogDir, ${v3(s.x, s.y, s.z)}), 0.0), 10.0);
  #ifdef FOG_EXP2
    // Dense overcast fog suppresses the warm sunset tint.
    sunAmt *= 1.0 - smoothstep(0.00075, 0.012, fogDensity);
  #endif
  vec3 fogCol = mix(fogColor, ${v3(w.r, w.g, w.b)}, sunAmt * 0.85);
  #ifdef FOG_EXP2
    float hf = mix(1.9, 0.75, smoothstep(-70.0, 30.0, vFogWorldPos.y));
    float d = fogDensity * hf;
    float fogFactor = 1.0 - exp( - d * d * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );
#endif`;
}
