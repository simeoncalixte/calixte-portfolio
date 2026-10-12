import * as THREE from 'three';
import { ISLANDS, PAST_REFERENCE_LENGTH, bridgePoint } from './layout.js';
import { WALK, RUN } from '../player/player.js';

export const DOG_SPEED_FACTOR = 0.8;
export const DOG_CHASE_RANGE = PAST_REFERENCE_LENGTH;
const RADIUS = 0.42;

export function dogSpeedLimit(distance) {
  return DOG_SPEED_FACTOR * (distance <= DOG_CHASE_RANGE ? RUN : WALK);
}

/** Navigation samples terrain and bridge centre lines, respecting static obstacles. */
export function buildDogNavigation(walk, ignore = null) {
  const nodes = [];
  const add = (position, islandId = null) => { const node = { position, islandId, edges: [], index: nodes.length }; nodes.push(node); return node; };
  const clear = (a, b) => {
    const steps = Math.ceil(a.distanceTo(b) / 0.22);
    const p = new THREE.Vector3(); let y = a.y;
    for (let i = 1; i <= steps; i++) {
      p.lerpVectors(a, b, i / steps);
      const floor = walk.groundAt(p.x, p.z, y, 0.9);
      if (!floor || Math.abs(floor.y - y) > 0.9 || walk.blocked(p.x, p.z, RADIUS, ignore)) return false;
      y = floor.y;
    }
    return Math.abs(y - b.y) < 0.35;
  };
  const connect = (a, b) => {
    if (!a || !b || !clear(a.position, b.position)) return;
    const cost = a.position.distanceTo(b.position);
    a.edges.push({ node: b, cost }); b.edges.push({ node: a, cost });
  };
  for (const isl of ISLANDS) {
    const grid = new Map(), radius = Math.ceil(isl.radius * 1.2);
    for (let iz = -radius; iz <= radius; iz++) for (let ix = -radius; ix <= radius; ix++) {
      const x = isl.center[0] + ix, z = isl.center[2] + iz;
      if (!walk.insideIsland(isl, x, z, 2.1) || walk.blocked(x, z, RADIUS, ignore)) continue;
      const floor = walk.floors(x, z).find((f) => f.kind === 'island' && f.id === isl.id);
      if (!floor) continue;
      const node = add(new THREE.Vector3(x, floor.y, z), isl.id);
      grid.set(`${ix},${iz}`, node);
      for (const [dx,dz] of [[-1,0],[0,-1],[-1,-1],[1,-1]]) connect(node, grid.get(`${ix+dx},${iz+dz}`));
    }
  }
  for (const bridge of walk.bridges) {
    const steps = Math.ceil(bridge.length);
    let previous = null;
    for (let i=0;i<=steps;i++) {
      const position = bridgePoint(bridge,i/steps);
      if (walk.blocked(position.x,position.z,RADIUS,ignore)) { previous=null; continue; }
      const node = add(position); connect(previous,node); previous=node;
      if (i===0 || i===steps) {
        const id = i===0 ? bridge.from : bridge.to;
        for (const other of nodes) if (other.islandId===id && other.position.distanceTo(position)<3) connect(node,other);
      }
    }
  }
  // Avoid spawning in tiny disconnected pockets between rocks or inside a
  // closed landmark. Hunt on the largest connected region of the world.
  const visited = new Set(); let connected = [];
  for (const node of nodes) {
    if (visited.has(node)) continue;
    const component = [node]; visited.add(node);
    for (let i=0;i<component.length;i++) for (const edge of component[i].edges) {
      if (!visited.has(edge.node)) { visited.add(edge.node); component.push(edge.node); }
    }
    if (component.length > connected.length) connected = component;
  }
  const nearest = (position) => {
    let best=null, distance=Infinity;
    for(const node of connected) { const d=node.position.distanceToSquared(position); if(d<distance) { distance=d;best=node; } }
    return best;
  };
  // Binary min-heap keeps searches across the long crossing inexpensive.
  const route = (from,to) => {
    const start=nearest(from), goal=nearest(to);
    if(!start || !goal) return [];
    const heap=[], costs=new Map([[start,0]]), parents=new Map();
    const push=(entry)=> { heap.push(entry);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].score<=entry.score)break;heap[i]=heap[p];i=p;}heap[i]=entry; };
    const pop=()=> { const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[c].score>=last.score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first; };
    push({node:start,cost:0,score:0});
    while(heap.length){
      const entry=pop(), current=entry.node;
      if(entry.cost!==costs.get(current))continue;
      if(current===goal){ const path=[];let n=goal;while(n){path.push(n.position.clone());n=parents.get(n);}return path.reverse(); }
      for(const edge of current.edges){const cost=entry.cost+edge.cost;if(cost>=(costs.get(edge.node)??Infinity))continue;costs.set(edge.node,cost);parents.set(edge.node,current);push({node:edge.node,cost,score:cost+edge.node.position.distanceTo(goal.position)});}
    }
    return [];
  };
  return { nodes: connected, route, clear, ignoreCollider(collider) { ignore = collider; } };
}

export function createDog(walk, player, random = Math.random, root) {
  if (!root?.userData.animate) throw new Error('An animated dog model is required');
  let navigation = buildDogNavigation(walk);
  const eligible = ISLANDS.filter((isl) => isl.id !== 'past' && navigation.nodes.some((n) => n.islandId === isl.id));
  const spawnIsland = eligible[Math.floor(random() * eligible.length)];
  if (!spawnIsland) throw new Error('No clear island available for the dog');
  const spots = navigation.nodes.filter((n) => n.islandId===spawnIsland.id && n.position.distanceTo(player.position)>3);
  const spawn = spots[Math.floor(random()*spots.length)] || navigation.nodes.find((n)=>n.islandId===spawnIsland.id);
  root.position.copy(spawn.position);
  const collider=walk.addCollider(root.position.x,root.position.z,RADIUS,'dog');
  navigation.ignoreCollider(collider);
  let path=[], pathIndex=0, replan=0, speed=0, version=walk.navigationVersion??0;
  root.userData.spawnIsland=spawnIsland.id;
  let petRemaining=0;
  const canPet=()=>player.enabled&&player.grounded!==false&&petRemaining===0&&
    root.position.distanceTo(player.position)<2.8&&navigation.clear(root.position,player.position);
  root.userData.interactable={
    id:'pet-dog',label:'Pet the dog',position:root.position,radius:2.8,
    available:canPet,
    activate(){
      if(!canPet())return;
      if(player.petDog && !player.petDog(root))return;
      petRemaining=3;speed=0;root.userData.speed=0;root.userData.state='petted';
      return 'Good dog! Its tail starts wagging.';
    },
  };
  root.userData.update=(time,_camera,activePlayer,dt=1/60)=>{
    if(!activePlayer || !activePlayer.enabled) {root.userData.animate(0,0,time,petRemaining>0);return;}
    if(petRemaining>0 || activePlayer.petting?.dog===root){
      petRemaining=activePlayer.petting?.dog===root?.2:Math.max(0,petRemaining-dt);
      const heading=Math.atan2(activePlayer.position.x-root.position.x,activePlayer.position.z-root.position.z);
      const delta=heading-root.rotation.y;
      root.rotation.y+=Math.atan2(Math.sin(delta),Math.cos(delta))*(1-Math.exp(-dt*6));
      root.userData.state='petted';root.userData.speed=0;
      root.userData.animate(dt,0,time,true);
      replan=0;return;
    }
    if(version!==(walk.navigationVersion??0)){navigation=buildDogNavigation(walk,collider);version=walk.navigationVersion;replan=0;}
    const distance=root.position.distanceTo(activePlayer.position);
    root.userData.state=distance<=DOG_CHASE_RANGE?'chasing':'hunting';
    replan-=dt;
    if(replan<=0){path=navigation.route(root.position,activePlayer.position);pathIndex=path.length>1&&navigation.clear(root.position,path[1])?1:0;replan=distance<=DOG_CHASE_RANGE?0.75:2;}
    while(pathIndex<path.length && Math.hypot(path[pathIndex].x-root.position.x,path[pathIndex].z-root.position.z)<0.2)pathIndex++;
    let target=path[pathIndex];
    if(!target && distance<3 && navigation.clear(root.position,activePlayer.position))target=activePlayer.position;
    const limit=dogSpeedLimit(distance);
    const desired=target&&distance>2.4?limit:0;
    speed=Math.min(limit,THREE.MathUtils.lerp(speed,desired,1-Math.exp(-dt*5)));
    let moved=0;
    if(target&&desired>0){
      const dx=target.x-root.position.x,dz=target.z-root.position.z,len=Math.hypot(dx,dz);
      const step=Math.min(speed*dt,len,Math.max(0,distance-2.4));
      if(len>0.001){
        const heading=Math.atan2(dx,dz), delta=heading-root.rotation.y;
        root.rotation.y+=Math.atan2(Math.sin(delta),Math.cos(delta))*Math.min(1,dt*8);
        const next=walk.move(root.position,dx/len*step,dz/len*step,root.position.y,RADIUS,collider);
        moved=Math.hypot(next.x-root.position.x,next.z-root.position.z); root.position.copy(next);
        if(moved<step*0.1) replan=Math.min(replan,0.25);
      }
    }
    collider.x=root.position.x;collider.z=root.position.z;
    root.userData.speed=dt>0?moved/dt:0;
    root.userData.animate(dt,root.userData.speed,time);
  };
  return root;
}
