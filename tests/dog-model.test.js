import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { createDogModel } from '../src/world/dogModel.js';

test('dog asset has fur, a working skeleton, and stable idle/walk/run poses', async () => {
  const io = new NodeIO();
  const doc = await io.read('public/assets/character/dog/mastiff.glb');
  assert.ok(doc.getRoot().listTextures()[0].getImage().length > 50000);
  assert.deepEqual(doc.getRoot().listAnimations().map(a => a.getName()).sort(), ['idle','run','walk']);
  // Node has no image decoder; retain geometry/rig/clips for the animation check.
  for (const mat of doc.getRoot().listMaterials()) mat.setBaseColorTexture(null);
  const binary = await io.writeBinary(doc);
  const gltf = await new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength), '');
  const dog = createDogModel(gltf);
  let skin; dog.traverse(o => { if(o.isSkinnedMesh) skin=o; });
  assert.ok(skin.skeleton.bones.length > 20);
  const poses=[];
  for (const [speed,state] of [[0,'idle'],[2.72,'walk'],[6.08,'run'],[0,'idle']]) {
    let previousPaw;
    for(let i=0;i<180;i++) {
      dog.userData.animate(1/60,speed); dog.updateMatrixWorld(true); skin.computeBoundingBox();
      const bounds=new THREE.Box3().setFromObject(dog), size=bounds.getSize(new THREE.Vector3());
      assert.ok(size.x > .2 && size.x < 3 && size.y > .3 && size.y < 3 && size.z > .8 && size.z < 5, `stable ${state} bounds: ${size.toArray()}`);
      assert.ok(Math.abs(bounds.min.y)<.65, 'feet remain near ground');
      // Sample after the crossfade and across multiple loops. An exported
      // start-frame offset used to hold the entire gait still each cycle.
      if (speed > 0 && i >= 18 && i % 6 === 0) {
        const paw = dog.getObjectByName('FrontToe_L').getWorldPosition(new THREE.Vector3());
        if (previousPaw) assert.ok(paw.distanceTo(previousPaw) > .005, `${state} keeps stepping at frame ${i}`);
        previousPaw = paw;
      }
    }
    assert.equal(dog.userData.animationState(),state);
    poses.push(skin.skeleton.bones.map(b=>b.quaternion.toArray().join(',')).join(';'));
  }
  assert.notEqual(poses[0],poses[1]); assert.notEqual(poses[1],poses[2]);
  const tail=dog.getObjectByName('Tail1'),head=dog.getObjectByName('Head');
  assert.ok(tail&&head,'pet reaction bones exist');
  dog.userData.animate(1/60,0,0,true);const wag=tail.quaternion.clone();
  for(let i=0;i<12;i++)dog.userData.animate(1/60,0,i/60,true);
  assert.ok(wag.angleTo(tail.quaternion)>.1,'tail visibly wags during petting');
  dog.userData.animate(0,0,0,false);const rest=tail.quaternion.clone();
  for(let i=0;i<30;i++)dog.userData.animate(0,0,0,false);
  assert.deepEqual(tail.quaternion.toArray(),rest.toArray(),'reaction leaves no accumulated bone rotation');
});
