import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player, FollowCamera } from '../src/player/player.js';
function player(){
 const animations=['Idle','Walk','Run','Wave','Interact'].map(name=>new THREE.AnimationClip(name,1,[]));
 return new Player({scene:new THREE.Group(),animations},{move:(p,x,z)=>new THREE.Vector3(p.x+x,0,p.z+z)});
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} equals ${b}`);
function tick(p,yaw,n=60){for(let i=0;i<n;i++)p.update(1/60,yaw);}
test('WASD follows the camera at arbitrary yaw, regardless of initial facing',()=>{
 for(const yaw of [0,.7,Math.PI,-1.2])for(const [f,r] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const p=player();p.heading=1.8;p.input.f=f;p.input.r=r;tick(p,yaw);
  const direction=new THREE.Vector3(-Math.sin(yaw)*f+Math.cos(yaw)*r,0,-Math.cos(yaw)*f-Math.sin(yaw)*r);
  assert.ok(p.position.dot(direction)>3);close(p.position.clone().cross(direction).length(),0);
  assert.ok(new THREE.Vector3(Math.sin(p.heading),0,Math.cos(p.heading)).dot(direction)>.999);
 }
});
test('diagonal speed is normalized and release stops movement',()=>{
 const a=player(),b=player();a.input.f=b.input.f=1;b.input.r=1;tick(a,0);tick(b,0);
 close(a.position.length(),b.position.length());b.input.f=b.input.r=0;
 const start=b.position.clone();tick(b,0);close(start.distanceTo(b.position),0);
});
test('reversal follows input immediately and disabled input cannot move',()=>{
 const p=player();p.input.f=1;tick(p,0);let z=p.position.z;p.input.f=-1;p.update(1/60,0);assert.ok(p.position.z>z);
 p.enabled=false;const start=p.position.clone();tick(p,1);close(start.distanceTo(p.position),0);
});
test('camera follows position without a sideways steering loop; orbit and recenter work',()=>{
 const previous=globalThis.window;globalThis.window={addEventListener(){},innerWidth:1000};
 try{
  const camera=new FollowCamera(new THREE.PerspectiveCamera(),{addEventListener(){}},{floors:()=>[]});
  const p=player();p.input.r=1;
  for(let i=0;i<180;i++){p.update(1/60,camera.yaw);camera.update(1/60,p.position);}
  close(camera.yaw,0);close(p.position.z,0);assert.ok(p.position.x>9);
  camera.input.rotate=1;camera.update(1/60,p.position);assert.ok(camera.yaw<0);
  camera.input.rotate=0;camera.resumeFollow(p.heading);
  for(let i=0;i<120;i++)camera.update(1/60,p.position);
  assert.ok(Math.abs(Math.atan2(Math.sin(camera.yaw-p.heading-Math.PI),Math.cos(camera.yaw-p.heading-Math.PI)))<.002);
  camera.resumeFollow(0);camera.rotate(50,0);assert.equal(camera.recenterYaw,null);
 }finally{globalThis.window=previous;}
});

test('camera returns after six seconds and camera input resets the timer',()=>{
 const previous=globalThis.window;globalThis.window={addEventListener(){},innerWidth:1000};
 try{
  const camera=new FollowCamera(new THREE.PerspectiveCamera(),{addEventListener(){}},{floors:()=>[]});
  const pos=new THREE.Vector3();camera.rotate(100,0);const yaw=camera.yaw;
  for(let i=0;i<359;i++)camera.update(1/60,pos,false,0);
  close(camera.yaw,yaw);
  for(let i=0;i<120;i++)camera.update(1/60,pos,false,0);
  assert.ok(Math.abs(Math.atan2(Math.sin(camera.yaw-Math.PI),Math.cos(camera.yaw-Math.PI)))<.002);
  camera.rotate(80,0);const changed=camera.yaw;camera.update(5.9,pos,false,0);close(camera.yaw,changed);
  camera.input.rotate=1;camera.update(1/60,pos,false,0);close(camera.cameraIdle,0);
  camera.input.rotate=0;camera.dragging=true;camera.update(5,pos,false,0);close(camera.cameraIdle,0);
 }finally{globalThis.window=previous;}
});
test('automatic return does not bend a held sideways movement into circles',()=>{
 const previous=globalThis.window;globalThis.window={addEventListener(){},innerWidth:1000};
 try{
  const camera=new FollowCamera(new THREE.PerspectiveCamera(),{addEventListener(){}},{floors:()=>[]});
  const p=player();p.input.r=1;
  for(let i=0;i<600;i++){p.update(1/60,camera.getMovementYaw(p.input));camera.update(1/60,p.position,false,p.heading);}
  assert.ok(Math.abs(p.position.z)<.2);assert.ok(p.position.x>30);
 }finally{globalThis.window=previous;}
});

test('changing held key combinations uses the current camera after automatic return',()=>{
 const previous=globalThis.window;globalThis.window={addEventListener(){},innerWidth:1000};
 try{
  const camera=new FollowCamera(new THREE.PerspectiveCamera(),{addEventListener(){}},{floors:()=>[]});
  const p=player();p.input.f=1;camera.yaw=0;camera.cameraIdle=7;
  close(camera.getMovementYaw(p.input),0);
  camera.yaw=1.1;
  for(const [f,r] of [[1,1],[0,1],[1,-1],[-1,-1],[-1,1],[1,0]]){
   p.input.f=f;p.input.r=r;
   const yaw=camera.getMovementYaw(p.input);close(yaw,camera.yaw);
   const start=p.position.clone();p.update(1/60,yaw);
   const step=p.position.clone().sub(start).normalize();
   const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
   const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
   const magnitude=Math.hypot(f,r);
   close(step.dot(forward),f/magnitude);close(step.dot(right),r/magnitude);
   camera.yaw+=.2;
  }
 }finally{globalThis.window=previous;}
});

test('keyboard lock lasts the complete six-second camera delay and restarts on orbit',()=>{
 const previous=globalThis.window;globalThis.window={addEventListener(){},innerWidth:1000};
 try{
  const camera=new FollowCamera(new THREE.PerspectiveCamera(),{addEventListener(){}},{floors:()=>[]});
  close(camera.keyboardDelayRemaining,6);
  camera.update(5.9,new THREE.Vector3(),false,0);assert.ok(camera.keyboardDelayRemaining>0);
  camera.update(.11,new THREE.Vector3(),false,0);close(camera.keyboardDelayRemaining,0);
  camera.rotate(1,0);close(camera.keyboardDelayRemaining,6);
 }finally{globalThis.window=previous;}
});
