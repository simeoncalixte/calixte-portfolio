import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const CHARACTER_GENDERS=['male','female'];

/** Each character keeps its own authored skeleton, skin, materials and motions. */
export function createCharacterRig(asset) {
  const model=clone(asset.scene);
  model.updateMatrixWorld(true);
  const head=model.getObjectByName('Head') || model.getObjectByName('mixamorigHead');
  if(!head)throw new Error('Character is missing its head bone');
  model.scale.setScalar(1.45/head.getWorldPosition(new THREE.Vector3()).y);
  model.traverse(o=>{
    if(!o.isMesh)return;
    o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;
    const copy=m=>{const c=m.clone();c.envMapIntensity=.8;return c;};
    o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
  });
  const mixer=new THREE.AnimationMixer(model);
  const clip=name=>{
    const c=asset.animations.find(a=>a.name===name || a.name.endsWith('|'+name));
    if(!c)throw new Error(`Character is missing ${name} animation`);
    return c;
  };
  const actions={idle:mixer.clipAction(clip('Idle')),walk:mixer.clipAction(clip('Walk')),
    run:mixer.clipAction(clip('Run')),jump:mixer.clipAction(clip('Run').clone()),
    wave:mixer.clipAction(clip('Wave')),interact:mixer.clipAction(clip('Interact'))};
  actions.jump.timeScale=0;
  actions.wave.setLoop(THREE.LoopOnce,1);actions.interact.setLoop(THREE.LoopOnce,1);
  return {model,mixer,actions};
}
