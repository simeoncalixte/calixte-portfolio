// Bake the project's CC0 Quaternius motions onto EMA's own Mixamo skeleton.
import {NodeIO} from '@gltf-transform/core';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as T from 'three';
const io=new NodeIO();
async function load(path){const d=await io.read(path);for(const m of d.getRoot().listMaterials())for(const k of ['BaseColor','Normal','Emissive','MetallicRoughness','Occlusion'])m[`set${k}Texture`](null);const b=await io.writeBinary(d);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const src=await load('public/assets/character/adventurer.glb'), dst=await load('scripts/art/ema/EMA-original.glb');
const doc=await io.read('scripts/art/ema/EMA-original.glb'), buffer=doc.getRoot().listBuffers()[0];
const map={Hips:'Hips',Spine:'Abdomen',Spine1:'Torso',Spine2:'Chest',Neck:'Neck',Head:'Head'};
for(const [side,s] of [['Left','L'],['Right','R']]){
 for(const [a,b] of [['Shoulder','Shoulder'],['Arm','UpperArm'],['ForeArm','LowerArm'],['Hand','Wrist'],['UpLeg','UpperLeg'],['Leg','LowerLeg'],['Foot','Foot']])map[side+a]=b+s;
 for(const digit of ['Index','Middle','Ring','Pinky','Thumb'])for(let n=1;n<=3;n++)map[`${side}Hand${digit}${n}`]=`${digit}${n}${s}`;
}
const worldQ=o=>o.getWorldQuaternion(new T.Quaternion());
const worldP=o=>o.getWorldPosition(new T.Vector3());
src.scene.updateMatrixWorld(true);dst.scene.updateMatrixWorld(true);
const sourceHip=src.scene.getObjectByName('Hips'),targetHip=dst.scene.getObjectByName('mixamorigHips');
const ratio=worldP(targetHip).distanceTo(worldP(dst.scene.getObjectByName('mixamorigLeftLeg')))/worldP(sourceHip).distanceTo(worldP(src.scene.getObjectByName('LowerLegL')));
const targetBase=targetHip.position.clone();
const targetRest=new Map();dst.scene.traverse(o=>{if(o.isBone)targetRest.set(o.name,{q:worldQ(o),p:o.position.clone(),local:o.quaternion.clone()});});
let skin;src.scene.traverse(o=>{if(o.isSkinnedMesh)skin=o;});skin.skeleton.pose();src.scene.updateMatrixWorld(true);
const correction=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI);
const sourceRest=new Map();src.scene.traverse(o=>{if(o.isBone)sourceRest.set(o.name,correction.clone().multiply(worldQ(o)));});
const bones=[];dst.scene.traverse(o=>{if(o.isBone && map[o.name.replace('mixamorig','')])bones.push(o);});
const mixer=new T.AnimationMixer(src.scene);
const idle=src.animations.find(a=>a.name.endsWith('|Idle'));const idleAction=mixer.clipAction(idle).play();mixer.setTime(0);src.scene.updateMatrixWorld(true);const sourceBase=worldP(sourceHip);idleAction.stop();
for(const name of ['Idle','Walk','Run','Wave','Interact']){
 const clip=src.animations.find(a=>a.name.endsWith('|'+name));const action=mixer.clipAction(clip).play();
 const count=Math.ceil(clip.duration*30),times=[],values=new Map(bones.map(b=>[b.name,[]])),positions=[];
 for(let frame=0;frame<=count;frame++){
  const time=clip.duration*frame/count;times.push(time);mixer.setTime(Math.min(time,clip.duration-1e-6));src.scene.updateMatrixWorld(true);
  targetHip.position.copy(targetBase);targetHip.position.y+=(worldP(sourceHip).y-sourceBase.y)*ratio;
  dst.scene.updateMatrixWorld(true);
  for(const b of bones){const s=src.scene.getObjectByName(map[b.name.replace('mixamorig','')]);
   const desired=correction.clone().multiply(worldQ(s)).multiply(sourceRest.get(s.name).clone().invert()).multiply(targetRest.get(b.name).q);
   b.quaternion.copy(worldQ(b.parent).invert().multiply(desired));b.updateWorldMatrix(false,true);
   const arr=values.get(b.name),q=b.quaternion.clone();if(arr.length && q.dot(new T.Quaternion().fromArray(arr,arr.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);arr.push(...q.toArray());
  }
  // Anchor the supporting boot to the ground after retargeting proportions.
  dst.scene.updateMatrixWorld(true);
  const boots=dst.scene.getObjectByName('boots002');
  boots.skeleton.update();
  let floor=Infinity;
  for(let v=0;v<boots.geometry.attributes.position.count;v++)floor=Math.min(floor,boots.getVertexPosition(v,new T.Vector3()).applyMatrix4(boots.matrixWorld).y);
  targetHip.position.y-=floor;
  positions.push(...targetHip.position.toArray());
 }
 action.stop();
 const anim=doc.createAnimation(name),input=doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
 const add=(name,path,type,data)=>{const out=doc.createAccessor().setType(type).setArray(new Float32Array(data)).setBuffer(buffer);const sampler=doc.createAnimationSampler().setInput(input).setOutput(out).setInterpolation('LINEAR');anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(doc.getRoot().listNodes().find(n=>n.getName().replace(':','')===name)).setTargetPath(path).setSampler(sampler));};
 for(const b of bones)add(b.name,'rotation','VEC4',values.get(b.name));add(targetHip.name,'translation','VEC3',positions);
}
// The source GLB uses a grayscale cavity atlas for clothing. Restore the
// author's preview palette without repainting her skin, eyes, or hair.
for(const node of doc.getRoot().listNodes()){
 const mesh=node.getMesh();if(!mesh)continue;
 for(const p of mesh.listPrimitives()){
  const mat=p.getMaterial();if(mat.getName()!=='ema clothes and stuff')continue;
  const n=node.getName();let color=[.075,.12,.16,1];
  if(n.startsWith('shirt'))color=[.7,.82,.86,1];
  else if(n.startsWith('boots'))color=[.12,.065,.035,1];
  else if(n.startsWith('belt'))color=[.3,.16,.07,1];
  const copy=mat.clone().setName('EMA '+n).setBaseColorFactor(color);p.setMaterial(copy);
 }
}
await io.write('public/assets/character/female-explorer.glb',doc);
console.log('Baked EMA motions; hip translation scale',ratio);
