import * as THREE from 'three';

/** Spatial blend follows crossing progress in either direction, including jumps. */
export function pastInfluence(position, bridge) {
  const dx = bridge.pb.x - bridge.pa.x, dz = bridge.pb.z - bridge.pa.z;
  const lengthSq = dx * dx + dz * dz;
  const t = THREE.MathUtils.clamp(((position.x - bridge.pa.x) * dx + (position.z - bridge.pa.z) * dz) / lengthSq, 0, 1);
  const x = bridge.pa.x + dx * t, z = bridge.pa.z + dz * t;
  const distance = Math.hypot(position.x - x, position.z - z);
  const corridor = 1 - THREE.MathUtils.smoothstep(distance, bridge.B.radius * 1.5, bridge.B.radius * 2.5);
  return THREE.MathUtils.smoothstep(t, 0, 0.92) * corridor;
}

export function createPastAtmosphere({ scene, sun, fill, rim, hemi, sky, sunGlare, post, bridge }) {
  const clearFog = scene.fog.color.clone(), darkFog = new THREE.Color('#303943');
  const clearSun = sun.color.clone(), darkSun = new THREE.Color('#a4b2c5');
  const clearHighlight = post.grade.uniforms.uHighlightTint.value.clone();
  const darkHighlight = new THREE.Color('#899aab');
  let amount = 0;
  return (dt, position) => {
    amount = THREE.MathUtils.lerp(amount, pastInfluence(position, bridge), 1 - Math.exp(-dt * 2.5));
    scene.fog.color.copy(clearFog).lerp(darkFog, amount);
    scene.fog.density = THREE.MathUtils.lerp(0.00075, 0.021, amount);
    scene.environmentIntensity = THREE.MathUtils.lerp(0.45, 0.16, amount);
    sun.color.copy(clearSun).lerp(darkSun, amount);
    sun.intensity = THREE.MathUtils.lerp(3, 0.45, amount);
    fill.intensity = THREE.MathUtils.lerp(1.1, 0.55, amount);
    rim.intensity = THREE.MathUtils.lerp(1.2, 0.08, amount);
    hemi.intensity = THREE.MathUtils.lerp(0.75, 0.48, amount);
    sky.material.uniforms.uGloom.value = amount;
    for (const sprite of sunGlare.children) sprite.material.opacity = 1 - amount;
    const u = post.grade.uniforms;
    u.uSat.value = THREE.MathUtils.lerp(1.12, 0.32, amount);
    u.uVignette.value = THREE.MathUtils.lerp(0.38, 0.68, amount);
    u.uHighlightTint.value.copy(clearHighlight).lerp(darkHighlight, amount);
    post.bloom.strength = THREE.MathUtils.lerp(0.55, 0.22, amount);
  };
}
