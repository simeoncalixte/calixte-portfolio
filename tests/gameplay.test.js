import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Walkable } from '../src/world/walkable.js';
import { ISLANDS, buildBridgeData, bridgePoint, island, surfaceHeight } from '../src/world/layout.js';
import { createPastPrison } from '../src/world/prison.js';
import { createDog, buildDogNavigation, dogSpeedLimit, DOG_CHASE_RANGE } from '../src/world/dog.js';
import { addPropCollider } from '../src/world/propCollision.js';
import { extractParts } from '../src/core/assets.js';
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
    const pine=new THREE.Group();
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.02,.04,1,8),new THREE.MeshStandardMaterial());
    trunk.position.y=.5;pine.add(trunk);
    createForest(Array.from({length:4},()=>({scene:pine,height:1})),walk);
    scatterProps(lib,walk);
    const nav=buildDogNavigation(walk);
    for(const isl of ISLANDS)assert.ok(nav.nodes.some(n=>n.islandId===isl.id),`${isl.id} remains connected`);
    const skillDisplays=landmarks.interactables.filter(it=>it.id.startsWith('skills-'));
    assert.equal(skillDisplays.length,12);
    for(const display of skillDisplays) {
      assert.ok(nav.nodes.some(n=>n.islandId===(island(display.id)?display.id:'skills') &&
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

test('petting pauses the dog, rejects distant or repeated interaction, and resumes navigation',()=>{
  const walk=new Walkable(buildBridgeData());
  const player={position:new THREE.Vector3(0,0,0),enabled:true};
  const reactions=[];const model=dogTestModel();model.userData.animate=(dt,speed,time,petting)=>reactions.push(!!petting);
  const dog=createDog(walk,player,()=>.1,model),interaction=dog.userData.interactable;
  player.position.copy(dog.position).add(new THREE.Vector3(0,0,10));
  assert.equal(interaction.available(),false);assert.equal(interaction.activate(),undefined);
  const nav=buildDogNavigation(walk,walk.colliders.find(c=>c.tag==='dog'));
  const nearby=nav.nodes.find(n=>n.position.distanceTo(dog.position)>1&&n.position.distanceTo(dog.position)<2.5&&nav.clear(dog.position,n.position));
  assert.ok(nearby);player.position.copy(nearby.position);
  const midpoint=player.position.clone().add(dog.position).multiplyScalar(.5);
  const obstacle=walk.addCollider(midpoint.x,midpoint.z,.5,'test-wall');
  assert.equal(interaction.available(),false);walk.colliders.splice(walk.colliders.indexOf(obstacle),1);
  assert.equal(interaction.position,dog.position);assert.equal(interaction.available(),true);
  assert.match(interaction.activate(),/wagging/);assert.equal(interaction.activate(),undefined);
  const start=dog.position.clone();
  for(let i=0;i<120;i++)dog.userData.update(i/60,null,player,1/60);
  assert.equal(dog.position.distanceTo(start),0);assert.equal(dog.userData.state,'petted');assert.ok(reactions.every(Boolean));
  for(let i=0;i<70;i++)dog.userData.update(2+i/60,null,player,1/60);
  assert.equal(reactions.at(-1),false);assert.equal(interaction.available(),true);
});

test('long moves cannot tunnel through thin walls and slide along rotated buildings', () => {
  const walk=new Walkable([]), y=surfaceHeight(island('main'),0,0);
  walk.addBoxCollider(0,0,.08,3,0,'thin-wall');
  const stopped=walk.move(new THREE.Vector3(-2,y,0),4,0,y).clone();
  assert.ok(stopped.x < -.42,'swept movement stops before the wall');
  assert.ok(!walk.blocked(stopped.x,stopped.z,.35));
  walk.colliders.length=0;
  walk.addBoxCollider(0,0,2,1,Math.PI/4,'building');
  assert.ok(walk.blocked(0,0,.35));
  assert.ok(walk.blocked(Math.SQRT2,-Math.SQRT2,.35),'rotated corner is solid');
  const slide=walk.move(new THREE.Vector3(-3,y,0),2,2,y).clone();
  assert.ok(!walk.blocked(slide.x,slide.z,.35));
  assert.ok(slide.z>0,'movement can slide along the building');
});

test('rotated raised decks replace terrain only inside their footprint', () => {
  const walk=new Walkable([]), y=surfaceHeight(island('main'),0,0);
  walk.addPlatform(0,0,3,1,y+.5,Math.PI/2);
  assert.equal(walk.groundAt(0,2,y).y,y+.5);
  assert.notEqual(walk.groundAt(2,0,y).y,y+.5);
  const result=walk.move(new THREE.Vector3(-1.2,y,0),.5,0,y);
  assert.equal(result.y,y+.5,'stepping onto deck returns its visible top');
});


test('prop collisions follow transformed rock extents and clip trees at body height', () => {
  const walk=new Walkable([]), model=new THREE.Group();
  const rock=new THREE.Mesh(new THREE.BoxGeometry(4,1,1));
  rock.position.set(1,.5,0);model.add(rock);
  const matrix=new THREE.Matrix4().makeRotationY(Math.PI/2);
  const collider=addPropCollider(walk,extractParts(model),matrix,'rock');
  assert.ok(walk.blocked(0,-2.9,.35),'offset, rotated far end of rock is solid');
  assert.ok(!walk.blocked(1,0,.35),'space beside the rock stays open');
  const y=surfaceHeight(island('main'),0,0);
  const stopped=walk.move(new THREE.Vector3(-2,y,-2),4,0,y).clone();
  assert.ok(stopped.x<-.8,'cannot walk through the far end of a long rock');
  const tree=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.2,.4,5,8));trunk.position.y=2.5;tree.add(trunk);
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(6,2,6));canopy.position.y=5;tree.add(canopy);
  const treeCollider=addPropCollider(walk,extractParts(tree),new THREE.Matrix4().makeTranslation(8,0,0),'tree',1.8);
  assert.ok(treeCollider.halfWidth>=.39 && treeCollider.halfWidth<.5,'trunk blocks movement without blocking overhead foliage');
  assert.ok(walk.blocked(8.3,0,.35));
  assert.ok(!walk.blocked(9,0,.35));
  assert.ok(collider.halfDepth>=2);
});

test('About garden has a reachable meditation seat and retains the biography interaction',()=>{
 const previous=globalThis.document;
 const context=new Proxy({}, {get:(_,key)=>key.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:()=>true});
 globalThis.document={createElement:()=>({getContext:()=>context})};
 try{
  const model=new THREE.Group();model.add(new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2)));
  const walk=new Walkable(buildBridgeData());
  const landmarks=createLandmarks({lantern:model,telescope:model},{woodDiff:new THREE.Texture()},walk);
  const seat=landmarks.interactables.find(it=>it.id==='meditate');
  assert.ok(seat);assert.ok(landmarks.interactables.find(it=>it.id==='about'));
  assert.ok(!walk.colliders.some(c=>c.tag==='about'),'old cabin collider removed');
  assert.ok(!walk.blocked(seat.position.x,seat.position.z,.35));
  assert.equal(walk.groundAt(seat.position.x,seat.position.z,seat.position.y).y,seat.position.y);
  const nav=buildDogNavigation(walk);
  assert.ok(nav.nodes.some(n=>n.position.distanceTo(seat.position)<1.6),'seat is reachable');
  let activated=false;
  seat.activate({meditate(position){activated=position.equals(seat.position);return true;}});
  assert.ok(activated);
 }finally{globalThis.document=previous;}
});
