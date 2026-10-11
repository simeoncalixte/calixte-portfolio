import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLANDS, buildBridgeData } from '../src/world/layout.js';
import { CONTENT } from '../src/ui/content.js';
import { createInterestObservatory } from '../src/world/interestIsland.js';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { INTEREST_VERTICALS } from '../src/interests.js';
import { createInterestVerticals } from '../src/world/interestVerticals.js';
import { MODEL_LIBRARY } from '../src/core/assets.js';
import { island, radiusAt, surfaceHeight } from '../src/world/layout.js';
import { Walkable } from '../src/world/walkable.js';
import { buildDogNavigation } from '../src/world/dog.js';

test('Interest contains the full native observatory and animates all workflow stages without a portal or floor',()=>{
  assert.equal(ISLANDS.find(i=>i.id==='interest').label.title,'INTEREST');
  assert.ok(buildBridgeData().some(b=>b.from==='about'&&b.to==='interest'));
  assert.equal(CONTENT.interest,undefined);
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){},fillText(){}})})};
  try {
    const {group}=createInterestObservatory(),scene=group.getObjectByName('observatory:elements');
    assert.equal(scene.isGroup,true);
    assert.equal(scene.userData.nodeKeys.length,40);
    assert.equal(scene.userData.stageNames.length,14);
    for(const key of scene.userData.nodeKeys){
      const label=scene.getObjectByName('observatory:label:'+key);
      assert.ok(label?.isSprite,`${key} has a camera-facing label`);
      assert.equal(label.parent,scene.getObjectByName('observatory:node:'+key));
      assert.ok(label.userData.title&&label.userData.description);
    }
    assert.equal(scene.getObjectByName('observatory:document-cells').count,192);
    for(const key of ['sourceExcel','sourceChat','ingest','human','vectorStore','apiA','clientWeb','db'])assert.ok(scene.getObjectByName('observatory:node:'+key));
    assert.equal(scene.background,undefined);assert.equal(scene.fog,undefined);
    let cameras=0;scene.traverse(o=>{if(o.isCamera)cameras++;});assert.equal(cameras,0);
    for(let t=0;t<225;t+=.5){
      group.userData.update(t);group.updateMatrixWorld(true);
      scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),`${o.name} has finite transforms at ${t}`));
    }
  } finally {globalThis.document=previous;}
});

test('industry exhibits load real models and remain reachable near the Interest island rim',async()=>{
  const io=new NodeIO(),lib={};
  for(const area of INTEREST_VERTICALS){
    const doc=await io.read('public'+MODEL_LIBRARY[area.model]);
    assert.ok(doc.getRoot().listMeshes().length>0);
    for(const material of doc.getRoot().listMaterials())material.setBaseColorTexture(null);
    const binary=await io.writeBinary(doc);
    lib[area.model]=(await new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),'')).scene;
  }
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
  try {
    const {group,stations}=createInterestVerticals(lib),isl=island('interest');
    assert.deepEqual(stations.map(({area})=>area.id),['insurance','education','finance','gaming','saas','aiaas']);
    const walk=new Walkable(buildBridgeData());
    group.updateMatrixWorld(true);
    for(const {area,station} of stations){
      const p=station.position;
      assert.ok(Math.abs(Math.hypot(p.x-isl.center[0],p.z-isl.center[2])-(radiusAt(isl,area.angle)-4.8))<1e-6);
      assert.equal(p.y,surfaceHeight(isl,p.x,p.z));
      assert.ok(walk.insideIsland(isl,p.x,p.z,3.3),'pedestal is safely inset from rim');
      assert.equal(walk.nearBridge(p.x,p.z,3),false,'exhibit leaves the bridge entrance clear');
      for(const other of stations){
        if(other.station===station)continue;
        assert.ok(Math.hypot(p.x-other.station.position.x,p.z-other.station.position.z)>8,'exhibits leave room to walk between them');
      }
      const model=station.getObjectByName(`interest:model:${area.id}`);
      const bounds=new THREE.Box3().setFromObject(model);
      assert.ok(Math.abs(bounds.min.y-(p.y+.43))<1e-5,'model rests on pedestal');
      assert.ok(bounds.getSize(new THREE.Vector3()).length()>2,'model is visible at exhibit scale');
      assert.ok(CONTENT[`interest-${area.id}`].includes(area.source));
      walk.addCollider(p.x,p.z,2,area.id);
    }
    const navigation=buildDogNavigation(walk);
    const entrance=navigation.nodes.find(n=>n.islandId==='about').position;
    for(const {station} of stations){
      const approach=station.localToWorld(new THREE.Vector3(0,0,2.7));
      assert.equal(walk.blocked(approach.x,approach.z,.35),null);
      const route=navigation.route(entrance,approach);
      assert.ok(route.length>0,'exhibit reachable from bridge');
      assert.ok(Math.hypot(route.at(-1).x-approach.x,route.at(-1).z-approach.z)<1.5);
    }
  } finally {globalThis.document=previous;}
});
