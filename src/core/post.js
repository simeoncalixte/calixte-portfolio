import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.38 },
    uSat: { value: 1.12 },
    uContrast: { value: 1.06 },
    uShadowTint: { value: new THREE.Color('#33557e') },
    uHighlightTint: { value: new THREE.Color('#ffb377') },
    uSplit: { value: 0.07 },
    uGrain: { value: 0.025 },
    uFade: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uSat, uContrast, uSplit, uGrain, uFade;
    uniform vec3 uShadowTint, uHighlightTint; varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299,0.587,0.114));
      // split toning: cool shadows, warm highlights (cinematic teal/orange)
      c = mix(c, c * uShadowTint * 2.0, uSplit * (1.0 - smoothstep(0.0, 0.5, l)));
      c = mix(c, c * uHighlightTint * 1.4, uSplit * smoothstep(0.45, 1.0, l));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uContrast + 0.5;
      // vignette
      vec2 d = vUv - 0.5; d.x *= 1.25;
      float lv = dot(c, vec3(0.299,0.587,0.114));
      c *= 1.0 - uVignette * smoothstep(0.3, 0.9, length(d)) * (1.0 - smoothstep(0.6, 0.95, lv));
      c += (rand(vUv * 1000.0 + uTime) - 0.5) * uGrain;
      c = mix(c, vec3(0.02,0.03,0.06), uFade);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  // Guard against NaN/Inf hot pixels (half-float overflow on tiny speculars),
  // which UnrealBloom would otherwise smear into black squares.
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        // comparisons with NaN are always false, so this also catches NaN on drivers that fold isnan()
        bool ok = c.r < 1e4 && c.g < 1e4 && c.b < 1e4 && c.r >= 0.0 && c.g >= 0.0 && c.b >= 0.0;
        if (!ok) c.rgb = vec3(0.0);
        gl_FragColor = vec4(min(c.rgb, vec3(48.0)), 1.0); }`,
  }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.65, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  return {
    composer, bloom, grade,
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); },
    render(t) { grade.uniforms.uTime.value = t % 100; composer.render(); },
  };
}
