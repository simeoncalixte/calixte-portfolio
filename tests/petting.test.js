import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { Player } from '../src/player/player.js';
import { createDogModel } from '../src/world/dogModel.js';
async function load(path){
 const io=new NodeIO(), doc=await io.read(path);
 for(const mat of doc.getRoot().listMaterials())for(const key of ['BaseColor','Normal','Emissive','MetallicRoughness','Occlusion'])mat[`set${key}Texture`](null);
 const binary=await io.writeBinary(doc);
 return new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),'');
}
test('player kneels, touches the animated dog, then restores normal movement',async()=>{
 const player=new Player(await load('public/assets/character/male-explorer.glb'),{
 blocked:()=>false,move:(p,x,z)=>new THREE.Vector3(p.x+x,0,p.z+z),
 });
 const dog=createDogModel(await load('public/assets/character/dog/mastiff.glb'));
 player.position.set(0,0,2.3);
 assert.equal(player.petDog(dog),true);
 let error=Infinity;
 for(let i=0;i<130;i++){
  dog.userData.animate(1/60,0,i/60,true);
  player.update(1/60,0);
  if(player.petting?.time>1)error=player.petting.pose.contactError;
 }
 assert.ok(error<.08,`hand contacts head (gap ${error})`);
 assert.ok(player.model.position.y<-.4,'player lowers into kneeling pose');
 for(let i=0;i<160;i++){dog.userData.animate(1/60,0,i/60,true);player.update(1/60,0);}
 assert.equal(player.petting,null);
 assert.equal(player.model.position.y,0);
});

test('meditation seats the player, pauses with menus, and exits on movement',async()=>{
 const player=new Player(await load('public/assets/character/male-explorer.glb'),{
  blocked:()=>false,move:(p,x,z)=>new THREE.Vector3(p.x+x,.34,p.z+z),
 });
 const seat=new THREE.Vector3(0,.34,0);
 player.position.set(0,.34,4);assert.equal(player.meditate(seat,0),false);
 player.position.set(0,.34,.8);assert.equal(player.meditate(seat,0),true);
 for(let i=0;i<150;i++)player.update(1/60,0);
 assert.ok(player.position.distanceTo(seat)<.04);
 assert.ok(player.model.position.y<-.6,'seated pose lowers the body');
 player.root.updateMatrixWorld(true);
 player.model.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
 assert.equal(player.petDog(new THREE.Group()),false);
 const time=player.meditation.time;player.enabled=false;player.update(1,0);
 assert.equal(player.meditation.time,time);
 player.enabled=true;player.input.f=1;player.update(1/60,0);
 assert.equal(player.meditation,null);assert.equal(player.model.position.y,0);
});

test('Casual Man preserves gameplay motions, detailed skinned geometry and no backpack',async()=>{
 const revised=await load('public/assets/character/male-explorer.glb');
 assert.deepEqual(revised.animations.map(a=>a.name),['Idle','Walk','Run','Wave','Interact']);
 assert.ok(revised.scene.getObjectByName('mixamorigHead'));
 revised.scene.traverse(o=>assert.ok(!/backpack|strap/i.test(o.name),'no backpack or straps')); 
 const player=new Player(revised,{blocked:()=>false,move:(p,x,z)=>new THREE.Vector3(p.x+x,0,p.z+z)});
 for(const name of ['idle','walk','run','interact']){
  player.fadeTo(player.actions[name],.1);
  for(let i=0;i<60;i++)player.mixer.update(1/60);
  player.root.updateMatrixWorld(true);
  player.root.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingBox();});
  const size=new THREE.Box3().setFromObject(player.root).getSize(new THREE.Vector3());
  assert.ok(size.y>1 && size.y<2.5 && size.x<2 && size.z<2,`${name} has stable geometry: ${size.toArray()}`);
 }
});

test('runner keeps both fists closed throughout the stride and releases them for idle',async()=>{
 const asset=await load('public/assets/character/male-explorer.glb');
 const mixer=new THREE.AnimationMixer(asset.scene);
 const run=mixer.clipAction(asset.animations.find(a=>a.name==='Run')).play();
 for(let frame=0;frame<12;frame++){
  mixer.update(run.getClip().duration/12);asset.scene.updateMatrixWorld(true);
  for(const side of ['Left','Right'])for(const digit of ['Index','Middle','Ring','Pinky']){
   const bones=[1,2,3].map(n=>asset.scene.getObjectByName(`mixamorig${side}Hand${digit}${n}`));
   const points=bones.map(b=>b.getWorldPosition(new THREE.Vector3()));
   const tip=bones[2].localToWorld(new THREE.Vector3(0,bones[2].position.length()*.75,0));
   const length=points[0].distanceTo(points[1])+points[1].distanceTo(points[2])+points[2].distanceTo(tip);
   assert.ok(tip.distanceTo(points[0])<length*.65,`${side} ${digit} curls back toward the palm`);
  }
 }
 const finger=asset.scene.getObjectByName('mixamorigLeftHandMiddle2');
 const closed=finger.quaternion.clone();run.stop();
 mixer.clipAction(asset.animations.find(a=>a.name==='Idle')).play();mixer.update(.25);
 assert.ok(closed.angleTo(finger.quaternion)>.5,'idle releases the running grip');
});

test('EMA selection uses her own rig and preserves all abilities',async()=>{
 const female=await load('public/assets/character/female-explorer.glb');
 const player=new Player(await load('public/assets/character/male-explorer.glb'),{
  blocked:()=>false,move:(p,x,z)=>new THREE.Vector3(p.x+x,0,p.z+z),
 },female);
 let femaleVertices=0;
 female.scene.traverse(o=>{if(o.isSkinnedMesh){
  femaleVertices+=o.geometry.attributes.position.count;
  const weights=o.geometry.attributes.skinWeight;
  for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5,'refined skin weights stay normalized');
 }});
 assert.ok(femaleVertices>0 && femaleVertices<50000,'refined surface stays within the vertex budget');
 let triangles=0;female.scene.traverse(o=>{if(o.isSkinnedMesh)triangles+=o.geometry.index.count/3;});
 assert.ok(triangles<85000,'female stays within the triangle budget');
 const male=player.model,mixer=player.mixer,actions=player.actions;
 assert.equal(player.setGender('female'),true);
 assert.equal(player.gender,'female');assert.notEqual(player.model,male);
 assert.ok(player.model.getObjectByName('mixamorigHead'));
 assert.equal(player.root.children.includes(male),false);
 assert.notEqual(player.mixer,mixer);assert.notEqual(player.actions,actions);
 assert.equal(player.meditate(new THREE.Vector3(),0),true);
 for(let i=0;i<70;i++)player.update(1/60,0);
 player.input.f=1;player.update(1/60,0);player.input.f=0;
 const dog=createDogModel(await load('public/assets/character/dog/mastiff.glb'));
 player.position.set(0,0,1.15);assert.equal(player.petDog(dog),true);
 for(let i=0;i<80;i++){dog.userData.animate(1/60,0,0,true);player.update(1/60,0);}
 assert.ok(player.petting.pose.contactError<.08);
 player.teleport(new THREE.Vector3(),0);
 for(const name of ['idle','walk','run','interact']){
  player.fadeTo(player.actions[name],.1);
  for(let i=0;i<60;i++)player.mixer.update(1/60);
  player.root.updateMatrixWorld(true);player.root.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingBox();});
  const size=new THREE.Box3().setFromObject(player.root).getSize(new THREE.Vector3());
  assert.ok(size.y>1 && size.y<2.5 && size.x<2 && size.z<2,`${name}: ${size.toArray()}`);
 }
 assert.equal(player.setGender('male'),true);assert.equal(player.model,male);assert.equal(player.mixer,mixer);
 assert.equal(player.setGender('invalid'),false);assert.equal(player.gender,'male');
});

test('EMA retargeting keeps idle arms down and supporting boots on the floor',async()=>{
 const player=new Player(await load('public/assets/character/male-explorer.glb'),{
  blocked:()=>false,move:(p,x,z)=>new THREE.Vector3(p.x+x,0,p.z+z),
 },await load('public/assets/character/female-explorer.glb'));
 player.setGender('female');
 for(const name of ['idle','walk','run']){
  player.mixer.stopAllAction();
  const action=player.actions[name];action.reset().play();
  for(let frame=0;frame<12;frame++){
   player.mixer.update(action.getClip().duration/12);
   player.root.updateMatrixWorld(true);
   const boots=player.model.getObjectByName('boots002');boots.skeleton.update();
   let min=Infinity;
   for(let i=0;i<boots.geometry.attributes.position.count;i++)min=Math.min(min,boots.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(boots.matrixWorld).y);
   assert.ok(Math.abs(min)<.025,`${name} supporting boot stays grounded (${min})`);
   if(name==='idle')for(const side of ['Left','Right']){
    const hand=player.model.getObjectByName(`mixamorig${side}Hand`).getWorldPosition(new THREE.Vector3());
    const shoulder=player.model.getObjectByName(`mixamorig${side}Arm`).getWorldPosition(new THREE.Vector3());
    assert.ok(hand.y<shoulder.y-.25,'idle arms hang below the shoulders');
   }
  }
 }
});
