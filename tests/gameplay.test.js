import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Walkable } from '../src/world/walkable.js';
import { ISLANDS, buildBridgeData, bridgePoint, island, surfaceHeight } from '../src/world/layout.js';
import { createPastPrison } from '../src/world/prison.js';
import { createDog, buildDogNavigation, dogSpeedLimit, DOG_CHASE_RANGE } from '../src/world/dog.js';
import { WALK, RUN } from '../src/player/player.js';
import { createLandmarks } from '../src/world/landmarks.js';
import { createForest, scatterProps } from '../src/world/vegetation.js';

function dogTestModel() { const root=new THREE.Group(); root.userData.animate=()=>{}; return root; }

test('prison unlock opens the real gate, retains walls, and has a walkable floor', () => {
  const walk=new Walkable(buildBridgeData()), prison=createPastPrison(walk);
  const {x,y,z}=prison.position;
  assert.ok(walk.blocked(x+3.08,z,0.35));
  assert.ok(!walk.blocked(x+1,z,0.35));
  assert.equal(walk.groundAt(x+1,z,y).y,y);
  assert.equal(prison.userData.interactable.available(),true);
  prison.userData.interactable.activate();
  prison.userData.interactable.activate(); // repeated input is harmless
  for(let i=0;i<100;i++)prison.userData.update(i/60,null,null,1/60);
  assert.equal(prison.userData.isUnlocked(),true);
  assert.equal(prison.userData.interactable.available(),false);
  assert.equal(walk.navigationVersion,1);
  assert.ok(!walk.blocked(x+3.08,z,0.35));
  assert.ok(walk.blocked(x-3,z,0.35));
  assert.ok(walk.blocked(x,z+3,0.35));
  const p=new THREE.Vector3(x+4,surfaceHeight(island('past'),x+4,z),z);
  for(let i=0;i<50;i++)p.copy(walk.move(p,-0.04,0,p.y));
  assert.ok(Math.abs(p.x-(x+2))<0.001,'player should enter through the doorway');
  assert.equal(p.y,y);
  assert.ok(prison.getObjectByName('character:batman'));
});

test('dog speed limits use player speeds and exactly one reference bridge', () => {
  assert.equal(dogSpeedLimit(DOG_CHASE_RANGE+0.001),0.8*WALK);
  assert.equal(dogSpeedLimit(DOG_CHASE_RANGE),0.8*RUN);
});

test('bridge decks take priority over the island ground beneath them', () => {
  const walk=new Walkable(buildBridgeData());
  walk.floors=()=>[{y:0,kind:'island'},{y:0.12,kind:'bridge'}];
  assert.equal(walk.groundAt(0,0,0).kind,'bridge');
  assert.equal(walk.groundAt(0,0,-0.85).kind,'island');
});

test('player can pass a dog on either side of every bridge', () => {
  for (const bridge of buildBridgeData()) {
    const walk=new Walkable([bridge]);
    const side=new THREE.Vector3(bridge.dir.z,0,-bridge.dir.x).normalize();
    for (const t of [.2,.5,.8]) {
      const dog=bridgePoint(bridge,t);
      walk.colliders.length=0;
      walk.addCollider(dog.x,dog.z,.42,'dog');
      for (const direction of [-1,1]) {
        const player=bridgePoint(bridge,t-1.5/bridge.length).addScaledVector(side,direction);
        for (let step=1;step<=60;step++) {
          const target=bridgePoint(bridge,t+(-1.5+step*.05)/bridge.length).addScaledVector(side,direction);
          player.copy(walk.move(player,target.x-player.x,target.z-player.z,player.y));
          assert.ok(Math.hypot(player.x-target.x,player.z-target.z)<1e-6,`${bridge.from}–${bridge.to}: passing lane stays clear`);
          assert.notEqual(walk.bridgeT(bridge,player.x,player.z),null);
        }
      }
    }
  }
});

test('navigation connects every island and dog hunts, chases, and stops before contact', () => {
  const walk=new Walkable(buildBridgeData());
  const navigation=buildDogNavigation(walk);
  const home=navigation.nodes.find(n=>n.islandId==='main').position;
  for(const isl of ISLANDS){
    const to=navigation.nodes.find(n=>n.islandId===isl.id).position;
    assert.ok(navigation.route(home,to).length>0,`${isl.id} must be connected`);
  }
  const player={position:home.clone(),enabled:true};
  const dog=createDog(walk,player,()=>0.01,dogTestModel());
  assert.notEqual(dog.userData.spawnIsland,'past');
  const start=dog.position.clone();
  // Far from the dog, on a different island: it must start hunting along a route.
  player.position.copy(navigation.nodes.find(n=>n.islandId==='skills').position);
  for(let i=0;i<120;i++){
    dog.userData.update(i/60,null,player,1/60);
    assert.ok(dog.userData.speed<=0.8*WALK+1e-8);
  }
  assert.equal(dog.userData.state,'hunting');
  assert.ok(start.distanceTo(dog.position)>0.5);
  player.position.copy(dog.position).add(new THREE.Vector3(0,0,5));
  dog.userData.update(3,null,player,1/60);
  assert.equal(dog.userData.state,'chasing');
  assert.ok(dog.userData.speed<=0.8*RUN+1e-8);
  player.position.copy(dog.position).add(new THREE.Vector3(0,0,1.5));
  const before=dog.position.clone();
  dog.userData.update(4,null,player,1/60);
  assert.equal(dog.position.distanceTo(before),0);
});

test('dog reaches the player across islands with landmark and vegetation obstacles', () => {
  // Mesh stand-ins leave procedural obstacle positions and random placement
  // unchanged; the canvas stub only substitutes labels, not collision logic.
  const previousDocument=globalThis.document;
  const context=new Proxy({}, {
    get:(_,key)=>key.startsWith('create')?()=>({addColorStop(){}}):key==='measureText'?text=>({width:text.length*25}):()=>{},
    set:()=>true,
  });
  globalThis.document={createElement:()=>({getContext:()=>context})};
  try {
    const model=new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial()));
    const lib={lantern:model,telescope:model,rocks:[model],ferns:[model],shrubs:[model],stump:model,trunk:model,rockFace:model,cliff:model};
    const walk=new Walkable(buildBridgeData());
    const landmarks=createLandmarks(lib,{woodDiff:new THREE.Texture()},walk);
    createForest(Array.from({length:4},()=>({scene:model,height:1})),walk);
    scatterProps(lib,walk);
    const nav=buildDogNavigation(walk);
    for(const isl of ISLANDS)assert.ok(nav.nodes.some(n=>n.islandId===isl.id),`${isl.id} remains connected`);
    const skillDisplays=landmarks.interactables.filter(it=>it.id.startsWith('skills-'));
    assert.equal(skillDisplays.length,4);
    for(const display of skillDisplays) {
      assert.ok(nav.nodes.some(n=>n.islandId==='skills' &&
        Math.hypot(n.position.x-display.position.x,n.position.z-display.position.z)<display.radius &&
        Math.abs(n.position.y-display.position.y)<4),`${display.id} has a reachable interaction point`);
    }
    const player={position:nav.nodes.find(n=>n.islandId==='skills').position.clone(),enabled:true};
    const dog=createDog(walk,player,()=>0.01,dogTestModel());
    assert.equal(dog.userData.spawnIsland,'main');
    for(let i=0;i<6000;i++){
      dog.userData.update(i*0.05,null,player,0.05);
      assert.ok(dog.userData.speed<=0.8*RUN+1e-8);
    }
    const distance=dog.position.distanceTo(player.position);
    assert.ok(distance>=2.39 && distance<2.6,'dog reaches the player and stops without overlap');
  } finally { globalThis.document=previousDocument; }
});
