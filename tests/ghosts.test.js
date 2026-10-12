import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildBridgeData, bridgePoint } from '../src/world/layout.js';
import { createGhostFlight } from '../src/world/ghostFlight.js';
import { createPastGhosts, ghostPresence } from '../src/world/ghosts.js';
const bridge=buildBridgeData().find(b=>b.to==='past');
function encounter(){
 const position=bridgePoint(bridge,.5),side=new THREE.Vector3(-bridge.dir.z,0,bridge.dir.x);
 const home=position.clone().addScaledVector(bridge.dir,8).addScaledVector(side,4);
 const player={enabled:true,position,heading:Math.atan2(bridge.dir.x,bridge.dir.z)};
 return {player,side,flight:createGhostFlight(bridge,[home,home.clone().addScaledVector(bridge.dir,1)])};
}
function tick(flight,player,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)flight.update(1/60,player);}

test('ghost warns then swoops, hits once, and leaves time between attacks',()=>{
 const {flight,player}=encounter();tick(flight,player,.6);
 assert.equal(flight.states.filter(s=>s.phase==='warning').length,1);
 assert.equal(player.ghostSlowdown,undefined);
 tick(flight,player,5.4);assert.equal(player.ghostSlowdown,1.2);
 assert.match(player.ghostEvent.message,/hit/);const event=player.ghostEvent;
 tick(flight,player,1.8);assert.equal(player.ghostEvent,event);
 assert.ok(flight.states.every(s=>s.phase==='idle'));
});

test('locked target allows a sideways dodge without leaving the deck',()=>{
 const {flight,player,side}=encounter();tick(flight,player,2.7);
 const target=flight.states[0].target.clone();
 player.position.addScaledVector(side,-1.1);
 tick(flight,player,3.6);
 assert.ok(flight.states[0].target.equals(target),'does not home onto the dodging player');
 assert.equal(player.ghostSlowdown,undefined);assert.equal(player.ghostEvent.message,'Dodged!');
});

test('ghost attacks pause when disabled and cancel when leaving the bridge',()=>{
 const {flight,player}=encounter();tick(flight,player,.4);
 const age=flight.states[0].age;player.enabled=false;tick(flight,player,3);
 assert.equal(flight.states[0].age,age);
 player.enabled=true;player.position.copy(bridge.pa).addScaledVector(bridge.dir,-10);tick(flight,player,1);
 assert.ok(flight.states.every(s=>s.phase==='idle'&&s.position.equals(s.home)));
 assert.equal(player.ghostSlowdown,undefined);
});

test('Blender wraith rigs animate independently with visible warning and attack states',async()=>{
 const io=new NodeIO(),doc=await io.read('public/assets/character/ghost/ghost.glb');
 for(const m of doc.getRoot().listMaterials())m.setBaseColorTexture(null);
 const data=await io.writeBinary(doc);
 const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['Ghost|Fast_Flying','Ghost|Flying_Idle']);
 assert.ok(gltf.animations.every(a=>a.tracks.some(t=>t.values.some(v=>v!==t.values[0]))));
 const materials=doc.getRoot().listMaterials().map(m=>m.getName());
 assert.ok(materials.includes('Face_Void') && materials.includes('Ivory_Gauze') && materials.includes('Lantern_Flame'));
 assert.ok(!materials.includes('Eye_White'),'faceless reference has no glowing eyes');
 const group=createPastGhosts(bridge,['',''],gltf);
 const player={enabled:true,position:bridgePoint(bridge,.1),heading:0};
 for(let i=0;i<480;i++){
   group.userData.update(i/60,null,player,1/60);group.updateMatrixWorld(true);
   const ghost=group.getObjectByName('ghost:past:1');
   ghost.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingBox();});
   const height=new THREE.Box3().setFromObject(ghost).getSize(new THREE.Vector3()).y;
   assert.ok(height>2.5&&height<5,`animated ghost stays full-sized: ${height}`);
 }
 const skins=[];group.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.isSkinnedMesh)skins.push(o);});
 assert.ok(skins.length>=2);assert.notEqual(skins[0].skeleton,skins.at(-1).skeleton);
 assert.ok(group.userData.flight.states[0].cooldown>0);
 player.position.copy(bridgePoint(bridge,.1)).addScaledVector(bridge.dir,-45);
 for(let i=0;i<60;i++)group.userData.update(4+i/60,null,player,1/60);
 const distant=group.getObjectByName('ghost:past:1');assert.equal(distant.visible,false);
 distant.traverse(o=>{if(o.isSkinnedMesh){assert.equal(o.material.fog,false);}});
});

test('ghosts are visible well before attack range in both crossing directions',()=>{
 const position=bridgePoint(bridge,.5);
 for(const direction of [-1,1]){
   const player={enabled:true,heading:direction*Math.PI/2,position:position.clone().addScaledVector(bridge.dir,direction*50)};
   assert.equal(ghostPresence(player,position,bridge),1);
   player.position.copy(position).addScaledVector(bridge.dir,direction*70);
   assert.ok(ghostPresence(player,position,bridge)>.4);
   player.position.copy(position).addScaledVector(bridge.dir,direction*90);
   assert.equal(ghostPresence(player,position,bridge),0);
 }
});


test('ghost descends from 20 meters high and 40 meters ahead in either crossing direction',()=>{
 for(const direction of [-1,1]){
  const {flight,player}=encounter();
  player.heading=Math.atan2(bridge.dir.x*direction,bridge.dir.z*direction);
  flight.update(1/60,player);
  const state=flight.states.find(s=>s.phase==='warning');
  const offset=state.spawn.clone().sub(player.position);
  assert.ok(Math.abs(offset.dot(bridge.dir)-direction*40)<.01);
  assert.ok(Math.abs(offset.dot(new THREE.Vector3(-bridge.dir.z,0,bridge.dir.x)))<.01);
  assert.equal(state.spawn.y-state.launch.y,20);
  assert.ok(state.position.y>state.launch.y+19);
  tick(flight,player,1);
  assert.ok(state.position.y<state.spawn.y && state.position.y>state.launch.y);
 }
});
