import test from 'node:test';
import assert from 'node:assert/strict';
import {SKILL_JOURNEY} from '../src/skillJourney.js';
import {CONTENT} from '../src/ui/content.js';
import {buildBridgeData,bridgePoint,island} from '../src/world/layout.js';
import {Walkable} from '../src/world/walkable.js';
import {createSkillJourney} from '../src/world/skillJourneyIslands.js';

test('four skills chapters form a walkable chain from the skills hub with detailed related work',()=>{
 const bridges=buildBridgeData(),walk=new Walkable(bridges);
 assert.equal(SKILL_JOURNEY.length,4);
 SKILL_JOURNEY.forEach((chapter,i)=>{
  const bridge=bridges.find(b=>b.from===(i?SKILL_JOURNEY[i-1].id:'skills')&&b.to===chapter.id);
  assert.ok(bridge,`${chapter.id} connects in order`);
  for(let step=0;step<=20;step++){
   const p=bridgePoint(bridge,step/20);assert.ok(walk.floors(p.x,p.z).length,'bridge has a traversable surface');
  }
  assert.ok(island(chapter.id));
  for(const [title,text] of chapter.topics){assert.ok(CONTENT[chapter.id].includes(title));assert.ok(CONTENT[chapter.id].includes(text));}
  for(const id of chapter.examples)assert.ok(CONTENT[chapter.id].includes(`experience-${id}`));
 });
});

test('new exhibits leave the central walking route clear and animate without invalid geometry',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})})};
 try{
  const walk=new Walkable(buildBridgeData()),journey=createSkillJourney(walk);
  journey.update(5);journey.group.updateMatrixWorld(true);
  assert.equal(journey.beacons.length,4);assert.equal(journey.interactables.length,8);
  journey.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
  for(const chapter of SKILL_JOURNEY){
   const [x,,z]=island(chapter.id).center;
   assert.equal(walk.blocked(x,z,.4),null,'centre stays clear');
   for(const entry of journey.interactables.filter(it=>it.id===chapter.id))assert.equal(walk.blocked(entry.position.x,entry.position.z,.4),null,'reading point stays clear');
  }
 }finally{globalThis.document=previous;}
});
