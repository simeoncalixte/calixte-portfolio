import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Walkable} from '../src/world/walkable.js';
import {buildBridgeData,island} from '../src/world/layout.js';
import {interestStonePosition} from '../src/world/interestStone.js';
import {createAIShrine} from '../src/world/aiShrine.js';
import {overlapsBridgeRoute} from '../src/world/bridgeClearance.js';
import {createForest,prepPine,prepVariants,prepProp,scatterProps} from '../src/world/vegetation.js';
import {propBounds} from '../src/world/propCollision.js';
async function load(path){
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),d=await io.read(path);
 for(const m of d.getRoot().listMaterials())for(const key of ['BaseColor','Normal','Emissive','MetallicRoughness','Occlusion'])m[`set${key}Texture`](null);
 const b=await io.writeBinary(d);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
}
test('real scattered rocks and new tree trunks leave every bridge approach clear',async()=>{
 const walk=new Walkable(buildBridgeData());
 const models=await Promise.all(['rock_moss_set_01','rock_moss_set_02','rock_07','namaqualand_cliff_01','fern_02','shrub_02','tree_stump_01','dead_tree_trunk','rock_face_01'].map(n=>load(`public/assets/opt/${n}.glb`)));
 const [rm1,rm2,r7,cliff,fern,shrub,stump,trunk,rface]=models;
 const lib={rocks:[...prepVariants(rm1,1.6),...prepVariants(rm2,1.6),...prepVariants(r7,1.8)],ferns:prepVariants(fern,1.2),shrubs:prepVariants(shrub,1.4),stump:prepProp(stump,1.4),trunk:prepProp(trunk,4.5),cliff:prepProp(cliff,2.4),rockFace:prepProp(rface,2.4)};
 const props=scatterProps(lib,walk);
 assert.ok(walk.colliders.filter(c=>c.tag==='rock').length>20,'retains scenery away from routes');
 const trees=await Promise.all([1,2,3,4].map(i=>load(`public/assets/trees/canopy-${i}.glb`)));
 const forest=createForest(trees.map(prepPine),walk);assert.ok(forest.children.length>=4);
 for(const c of walk.colliders){
  const bounds=new T.Box3(new T.Vector3(c.x-c.halfWidth,0,c.z-c.halfDepth),new T.Vector3(c.x+c.halfWidth,2,c.z+c.halfDepth));
  assert.equal(overlapsBridgeRoute(bounds,walk.bridges),false,`${c.tag} overlaps an approach`);
  const stone=interestStonePosition(walk.bridges);
  const dx=stone.x-T.MathUtils.clamp(stone.x,bounds.min.x,bounds.max.x);
  const dz=stone.z-T.MathUtils.clamp(stone.z,bounds.min.z,bounds.max.z);
  assert.ok(Math.hypot(dx,dz)>=4.5,`${c.tag} obscures the reflection stone`);
 }
 // Inspect visual instances as well: a removed collider alone must not leave a rock in the path.
 for(const mesh of props.children.filter(m=>m.castShadow))for(let i=0;i<mesh.count;i++){
  const matrix=new T.Matrix4();mesh.getMatrixAt(i,matrix);
  assert.equal(overlapsBridgeRoute(propBounds([{geometry:mesh.geometry,matrix:new T.Matrix4()}],matrix),walk.bridges),false);
 }
 for(const br of walk.bridges)for(const end of ['pa','pb'])for(let distance=0;distance<=6;distance+=.5){
  const p=br[end].clone().addScaledVector(br.dir,end==='pa'?-distance:distance);
  assert.equal(!!walk.blocked(p.x,p.z,.35),false,`${br.from}-${br.to} ${end} approach blocked`);
 }
});
test('unlabeled shrine has a traversable platform, solid altar and animated network',()=>{
 const walk=new Walkable(buildBridgeData()),shrine=createAIShrine(walk),isl=island('lookout');
 assert.equal(isl.label,null);assert.equal(shrine.userData.interactable,undefined);
 assert.equal(!!walk.blocked(shrine.position.x,shrine.position.z,.35),true);
 assert.equal(!!walk.blocked(shrine.position.x,shrine.position.z+2,.35),false);
 assert.equal(walk.platforms.length,1);
 const stone=shrine.getObjectByName('shrine-entrance-stone');
 assert.ok(stone.getObjectByName('isaiah-artwork'));
 assert.ok(walk.blocked(shrine.position.x+stone.position.x,shrine.position.z+stone.position.z,.2));
 const bots=shrine.getObjectByName('shrine-bots');
 assert.deepEqual(bots.children.map(bot=>bot.userData.botName),['Codex','Claude','Gemini','Grok']);
 for(const bot of bots.children)assert.ok(walk.blocked(shrine.position.x+bot.position.x,shrine.position.z+bot.position.z,.2));
 shrine.userData.update(10);shrine.updateMatrixWorld(true);
 shrine.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
 // Separate bounds: the space between the shrine and its entrance stone is empty.
 for(const child of shrine.children){
  const bounds=new T.Box3().setFromObject(child);
  assert.equal(overlapsBridgeRoute(bounds,walk.bridges),false,'shrine and stone stay out of the landing corridor');
 }
 const bridge=walk.bridges.find(b=>b.to==='lookout');
 assert.ok(stone.getWorldPosition(new T.Vector3()).distanceTo(bridge.pb)<6,'stone is near bridge landing');
 for(let d=0;d<=6;d+=.5)for(const side of [-1,0,1]){
  const p=bridge.pb.clone().addScaledVector(bridge.dir,d).add(new T.Vector3(-bridge.dir.z,0,bridge.dir.x).multiplyScalar(side));
  assert.equal(!!walk.blocked(p.x,p.z,.35),false,'landing remains open across its width');
 }
});
