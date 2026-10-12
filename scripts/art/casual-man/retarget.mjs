// Bake the project's CC0 Quaternius motions onto Casual Man's own Mixamo skeleton.
import {NodeIO} from '@gltf-transform/core';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as T from 'three';
const io=new NodeIO();
async function load(path){const d=await io.read(path);for(const m of d.getRoot().listMaterials())for(const k of ['BaseColor','Normal','Emissive','MetallicRoughness','Occlusion'])m[`set${k}Texture`](null);const b=await io.writeBinary(d);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const src=await load('scripts/art/adventurer-original.glb'), dst=await load('scripts/art/casual-man/prepared.glb');
const doc=await io.read('scripts/art/casual-man/prepared.glb'), buffer=doc.getRoot().listBuffers()[0];
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
const hipScale=targetHip.parent.getWorldScale(new T.Vector3()).y;
const body=dst.scene.getObjectByName('char1');
let minRest=Infinity;
const restYs=[];body.skeleton.update();
for(let i=0;i<body.geometry.attributes.position.count;i++){const y=body.getVertexPosition(i,new T.Vector3()).applyMatrix4(body.matrixWorld).y;restYs.push(y);minRest=Math.min(minRest,y);}
const footVertices=restYs.flatMap((y,i)=>y<minRest+.16?[i]:[]);
const targetRest=new Map();dst.scene.traverse(o=>{if(o.isBone)targetRest.set(o.name,{q:worldQ(o),p:o.position.clone(),local:o.quaternion.clone()});});
let skin;src.scene.traverse(o=>{if(o.isSkinnedMesh)skin=o;});skin.skeleton.pose();src.scene.updateMatrixWorld(true);
const correction=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI);
const sourceRest=new Map();src.scene.traverse(o=>{if(o.isBone)sourceRest.set(o.name,correction.clone().multiply(worldQ(o)));});
for(const side of ['Left','Right']){
 const arm=dst.scene.getObjectByName('mixamorig'+side+'Arm'),fore=dst.scene.getObjectByName('mixamorig'+side+'ForeArm');
 const direction=worldP(fore).sub(worldP(arm)).normalize();
 const canonical=new T.Vector3(side==='Left'?1:-1,0,0);
 targetRest.get(arm.name).q.premultiply(new T.Quaternion().setFromUnitVectors(direction,canonical));
 const lower=dst.scene.getObjectByName('mixamorig'+side+'ForeArm'),hand=dst.scene.getObjectByName('mixamorig'+side+'Hand');
 const lowerDirection=worldP(hand).sub(worldP(lower)).normalize();
 targetRest.get(lower.name).q.premultiply(new T.Quaternion().setFromUnitVectors(lowerDirection,canonical));
 const middle=dst.scene.getObjectByName('mixamorig'+side+'HandMiddle1');
 const handDirection=worldP(middle).sub(worldP(hand)).normalize();
 const handAlignment=new T.Quaternion().setFromUnitVectors(handDirection,canonical);
 for(const [name,rest] of targetRest)if(name.startsWith('mixamorig'+side+'Hand'))rest.q.premultiply(handAlignment);

}
const bones=[];dst.scene.traverse(o=>{if(o.isBone && map[o.name.replace('mixamorig','')])bones.push(o);});
const mixer=new T.AnimationMixer(src.scene);
const idle=src.animations.find(a=>a.name.endsWith('|Idle'));const idleAction=mixer.clipAction(idle).play();mixer.setTime(0);src.scene.updateMatrixWorld(true);const sourceBase=worldP(sourceHip);idleAction.stop();
for(const name of ['Idle','Walk','Run','Wave','Interact']){
 const clip=src.animations.find(a=>a.name.endsWith('|'+name));const action=mixer.clipAction(clip).play();
 const count=Math.ceil(clip.duration*30),times=[],values=new Map(bones.map(b=>[b.name,[]])),positions=[];
 for(let frame=0;frame<=count;frame++){
  const time=clip.duration*frame/count;times.push(time);mixer.setTime(Math.min(time,clip.duration-1e-6));src.scene.updateMatrixWorld(true);
  targetHip.position.copy(targetBase);targetHip.position.y+=(worldP(sourceHip).y-sourceBase.y)*ratio/hipScale;
  dst.scene.updateMatrixWorld(true);
  const handTwists=new Map();
  for(const b of bones){const s=src.scene.getObjectByName(map[b.name.replace('mixamorig','')]);
   const desired=correction.clone().multiply(worldQ(s)).multiply(sourceRest.get(s.name).clone().invert()).multiply(targetRest.get(b.name).q);
   // The source palms face forward. Roll each locomotion hand toward its
   // thigh, carrying the fingers with it rather than counter-rotating them.
   const handSide=b.name.match(/^mixamorig(Left|Right)Hand/);
   if(handSide && ['Idle','Walk','Run'].includes(name)){
    const side=handSide[1];
    if(b.name===`mixamorig${side}Hand`){
     const axis=new T.Vector3(0,1,0).applyQuaternion(desired);
     handTwists.set(side,new T.Quaternion().setFromAxisAngle(axis,(side==='Left'?1:-1)*Math.PI/2));
    }
    desired.premultiply(handTwists.get(side));
   }
   b.quaternion.copy(worldQ(b.parent).invert().multiply(desired));
   // Keep the runner's fingers curled relative to the moving hand. Retargeting
   // the source's world-space fingers leaves this differently proportioned rig
   // with splayed palms. Other clips retain their original hand animation.
   const finger=b.name.match(/Hand(Index|Middle|Ring|Pinky|Thumb)([123])$/);
   if(name==='Run' && finger){
    const bend=(finger[1]==='Thumb'?[25,35,35]:[55,65,45])[Number(finger[2])-1];
    b.quaternion.copy(targetRest.get(b.name).local).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-T.MathUtils.degToRad(bend)));
   }
   b.updateWorldMatrix(false,true);
   const arr=values.get(b.name),q=b.quaternion.clone();if(arr.length && q.dot(new T.Quaternion().fromArray(arr,arr.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);arr.push(...q.toArray());
  }
  // Anchor the supporting boot to the ground after retargeting proportions.
  dst.scene.updateMatrixWorld(true);
  const boots=body;
  boots.skeleton.update();
  let floor=Infinity;
  for(const v of footVertices)floor=Math.min(floor,boots.getVertexPosition(v,new T.Vector3()).applyMatrix4(boots.matrixWorld).y);
  targetHip.position.y-=floor/hipScale;
  positions.push(...targetHip.position.toArray());
 }
 action.stop();
 const anim=doc.createAnimation(name),input=doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
 const add=(name,path,type,data)=>{const out=doc.createAccessor().setType(type).setArray(new Float32Array(data)).setBuffer(buffer);const sampler=doc.createAnimationSampler().setInput(input).setOutput(out).setInterpolation('LINEAR');anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(doc.getRoot().listNodes().find(n=>n.getName().replace(':','')===name)).setTargetPath(path).setSampler(sampler));};
 for(const b of bones)add(b.name,'rotation','VEC4',values.get(b.name));add(targetHip.name,'translation','VEC3',positions);
}
await io.write('public/assets/character/male-explorer.glb',doc);
console.log('Baked Casual Man motions');
