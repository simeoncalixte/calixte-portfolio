import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player, TURN_SPEED } from '../src/player/player.js';
function player(){
 const scene=new THREE.Group();
 const animations=['Idle','Walk','Run','Wave','Interact'].map(name=>new THREE.AnimationClip(name,1,[]));
 return new Player({scene,animations},{move:(p,x,z)=>new THREE.Vector3(p.x+x,0,p.z+z)});
}
function tick(p,n=60,cameraYaw=0){for(let i=0;i<n;i++)p.update(1/60,cameraYaw);}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} equals ${b}`);
test('forward and backward follow facing at arbitrary headings without turning',()=>{
 for(const heading of [0,.7,Math.PI,-1.2])for(const f of [1,-1]){
  const p=player();p.heading=heading;p.input.f=f;tick(p);
  close(p.heading,heading);assert.ok(p.position.dot(new THREE.Vector3(Math.sin(heading),0,Math.cos(heading)))*f>3);
  close(p.position.x*Math.cos(heading)-p.position.z*Math.sin(heading),0);
  assert.equal(Math.sign(p.actions.walk.timeScale),f);
 }
});
test('A and D turn in place and combine with forward movement',()=>{
 for(const r of [-1,1]){
  const p=player();p.heading=0;p.input.r=r;tick(p,30);
  close(p.heading,-r*TURN_SPEED*.5);close(p.position.length(),0);
  p.input.f=1;tick(p,30);assert.ok(p.position.length()>1);
 }
});
test('camera orbit cannot steer movement and releasing keys stops drift',()=>{
 const a=player(),b=player();a.input.f=b.input.f=1;a.input.r=b.input.r=.4;
 tick(a,30,0);tick(b,30,2.6);close(a.position.distanceTo(b.position),0);close(a.heading,b.heading);
 a.input.f=0;const stopped=a.position.clone();tick(a);close(a.position.distanceTo(stopped),0);
 a.enabled=false;const heading=a.heading;tick(a);close(a.heading,heading);close(a.position.distanceTo(stopped),0);
});
test('S reverses immediately without spinning or continuing forward',()=>{
 const p=player();p.heading=.6;p.input.f=1;tick(p);const start=p.position.clone();
 p.input.f=-1;tick(p,1);assert.ok(p.position.clone().sub(start).dot(new THREE.Vector3(Math.sin(.6),0,Math.cos(.6)))<0);close(p.heading,.6);
});
