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
test('A/D turn ten degrees per 50 ms without translating at different frame rates',()=>{
 for(const r of [-1,1])for(const dt of [.05,1/60,1/120]){
  const p=player();p.heading=0;p.input.r=r;
  for(let i=0;i<Math.round(.5/dt);i++)p.update(dt);
  close(p.heading,-r*THREE.MathUtils.degToRad(100));close(p.position.length(),0);
  p.input.r=0;const heading=p.heading;p.update(.05);close(p.heading,heading);
 }
});
test('W/S move along facing independently of camera and A/D do not add speed',()=>{
 for(const f of [-1,1]){
  const p=player();p.heading=.7;p.input.f=f;tick(p,2.1);
  const forward=new THREE.Vector3(Math.sin(.7),0,Math.cos(.7));
  assert.ok(p.position.dot(forward)*f>3);close(p.position.clone().cross(forward).length(),0);close(p.heading,.7);
 }
 const a=player(),b=player();a.input.f=b.input.f=1;b.input.r=1;
 tick(a,0);tick(b,0);close(a.speed,b.speed);
});
test('releasing W/S stops translation even while turning; disabled input is ignored',()=>{
 const p=player();p.input.f=1;tick(p,0);p.input.f=0;p.input.r=1;
 const position=p.position.clone();tick(p,0);close(position.distanceTo(p.position),0);
 p.enabled=false;const heading=p.heading;tick(p,0);close(p.heading,heading);
});
test('camera returns after four seconds and camera input resets the timer',()=>{
 const previous=globalThis.window;globalThis.window={addEventListener(){},innerWidth:1000};
 try{
  const camera=new FollowCamera(new THREE.PerspectiveCamera(),{addEventListener(){}},{floors:()=>[]});
  const pos=new THREE.Vector3();camera.rotate(100,0);const yaw=camera.yaw;
  for(let i=0;i<239;i++)camera.update(1/60,pos,false,0);
  close(camera.yaw,yaw);
  for(let i=0;i<120;i++)camera.update(1/60,pos,false,0);
  assert.ok(Math.abs(Math.atan2(Math.sin(camera.yaw-Math.PI),Math.cos(camera.yaw-Math.PI)))<.002);
  camera.rotate(80,0);const changed=camera.yaw;camera.update(3.9,pos,false,0);close(camera.yaw,changed);
  camera.input.rotate=1;camera.update(1/60,pos,false,0);close(camera.cameraIdle,0);
  camera.input.rotate=0;camera.dragging=true;camera.update(5,pos,false,0);close(camera.cameraIdle,0);
 }finally{globalThis.window=previous;}
});
test('automatic camera return does not steer the player',()=>{
 const previous=globalThis.window;globalThis.window={addEventListener(){},innerWidth:1000};
 try{
  const camera=new FollowCamera(new THREE.PerspectiveCamera(),{addEventListener(){}},{floors:()=>[]});
  const p=player();p.heading=.7;p.input.f=1;
  for(let i=0;i<600;i++){p.update(1/60);camera.update(1/60,p.position,false,p.heading);}
  close(p.heading,.7);close(p.position.x*Math.cos(.7)-p.position.z*Math.sin(.7),0);
 }finally{globalThis.window=previous;}
});
