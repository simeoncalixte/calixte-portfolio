import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Textured Wildfire Games dog; the outer root remains controlled by navigation. */
export function createDogModel(gltf) {
  const root = new THREE.Group(); root.name = 'character:dog';
  const rig = clone(gltf.scene), pivot = new THREE.Group();
  pivot.add(rig); root.add(pivot);
  const mixer = new THREE.AnimationMixer(rig);
  const actions = Object.fromEntries(['idle', 'walk', 'run'].map((name) => {
    const clip = gltf.animations.find((a) => a.name === name);
    if (!clip) throw new Error(`Dog model is missing its ${name} animation`);
    // COLLADA exports can begin at a nonzero frame. Leaving that offset in
    // place freezes the first pose at the start of every loop.
    const timedClip = clip.clone();
    const start = Math.min(...timedClip.tracks.map((track) => track.times[0]));
    for (const track of timedClip.tracks) track.shift(-start);
    timedClip.resetDuration();
    return [name, mixer.clipAction(timedClip)];
  }));
  actions.idle.play(); mixer.update(0); rig.updateMatrixWorld(true);
  rig.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    o.frustumCulled = false; // animated paws extend beyond the rest-pose bounds
    if (o.isSkinnedMesh) o.computeBoundingBox();
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of materials) { mat.roughness = 0.95; mat.envMapIntensity = 0.65; }
  });
  const bounds = new THREE.Box3().setFromObject(rig);
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const scale = Math.min(1.65 / size.z, 0.62 / size.x);
  pivot.scale.setScalar(scale);
  pivot.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  let state = 'idle';
  root.userData.animate = (dt, speed) => {
    const next = speed < 0.12 ? 'idle' : speed > 3.2 ? 'run' : 'walk';
    if (next !== state) {
      actions[next].reset().setEffectiveWeight(1).fadeIn(0.22).play();
      actions[state].fadeOut(0.22); state = next;
    }
    // This asset's walk and run contain the same stride. Both must advance
    // with distance travelled; slowing the walk or changing its rate at the
    // run threshold makes the planted paws skate across the ground.
    actions.walk.timeScale = speed / 2.72;
    actions.run.timeScale = speed / 2.72;
    mixer.update(dt);
  };
  root.userData.animationState = () => state;
  return root;
}
