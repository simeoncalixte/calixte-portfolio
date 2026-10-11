import * as THREE from 'three';
import { island, surfaceHeight } from './layout.js';
import { createBatman } from './characters.js';

/** Closed iron cell on a stone foundation, beyond the island's entrance marker. */
export function createPastPrison(walk) {
  const isl = island('past');
  const x = isl.center[0] - 6, z = isl.center[2];
  const group = new THREE.Group(); group.name = 'prison:past';
  const heights = [];
  for (const dx of [-3.5, 0, 3.5]) for (const dz of [-3.5, 0, 3.5]) heights.push(surfaceHeight(isl, x + dx, z + dz));
  const floor = Math.max(...heights) + 0.15;
  const foundationDepth = floor - Math.min(...heights) + 0.2;
  group.position.set(x, floor, z);
  const iron = new THREE.MeshStandardMaterial({ color: '#333c45', roughness: 0.72, metalness: 0.75 });
  const stone = new THREE.MeshStandardMaterial({ color: '#555a61', roughness: 1 });
  const rust = new THREE.MeshStandardMaterial({ color: '#66534a', roughness: 0.95, metalness: 0.4 });
  const box = (w, h, d, px, py, pz, mat = iron) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(px, py, pz); mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh); return mesh;
  };
  box(7, foundationDepth, 7, 0, -foundationDepth / 2, 0, stone);
  walk.addPlatform(x, z, 3.5, 3.5, floor);
  // Corner posts and horizontal bands enclose all four sides.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.24, 4.6, 0.24, sx * 3, 2.3, sz * 3);
  for (const y of [0.15, 1.35, 3.2, 4.5]) {
    for (const s of [-1, 1]) {
      box(6.2, 0.14, 0.16, 0, y, s * 3);
      if (s < 0 || y >= 3.2) box(0.16, 0.14, 6.2, s * 3, y, 0);
      else for (const side of [-1, 1]) box(0.16, 0.14, 2.05, 3, y, side * 2.075);
    }
  }
  for (let i = -6; i <= 6; i++) {
    const p = i * 0.45;
    for (const s of [-1, 1]) {
      box(0.085, 4.4, 0.085, p, 2.25, s * 3);
      if (s < 0 || Math.abs(p) >= 1.05) box(0.085, 4.4, 0.085, s * 3, 2.25, p);
      else box(0.085, 1.05, 0.085, 3, 3.95, p);
    }
    box(6, 0.085, 0.085, 0, 4.5, p);
  }
  // Sliding gate keeps its opening animation clear of the approaching player.
  const gate = new THREE.Group(); gate.name = 'gate:past'; group.add(gate);
  const gateBox = (...args) => { const mesh = box(...args); group.remove(mesh); gate.add(mesh); return mesh; };
  for (const side of [-1, 1]) gateBox(0.22, 3.1, 0.18, 3.08, 1.65, side * 0.95, rust);
  for (const y of [0.15, 1.5, 3.15]) gateBox(0.22, 0.15, 2.08, 3.08, y, 0, rust);
  for (let i=-2;i<=2;i++) gateBox(0.09, 2.95, 0.09, 3.08, 1.65, i*0.35);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 6, 16, Math.PI), iron);
  shackle.rotation.y = Math.PI / 2; shackle.position.set(3.3, 1.45, 0.45); gate.add(shackle);
  const lock = gateBox(0.14, 0.25, 0.3, 3.3, 1.29, 0.45, rust);
  // Wall colliders follow the bars, leaving a genuine doorway and open interior.
  for (let p=-3;p<=3.001;p+=0.3) {
    for(const side of [-1,1]) walk.addCollider(x+p,z+side*3,0.16,'prison:wall');
    walk.addCollider(x-3,z+p,0.16,'prison:wall');
    if(Math.abs(p)>1.05) walk.addCollider(x+3,z+p,0.16,'prison:wall');
  }
  const gateColliders=[];
  for(let offset=-0.9;offset<=0.901;offset+=0.3) gateColliders.push({offset, collider:walk.addCollider(x+3.08,z+offset,0.16,'prison:gate')});
  const batman=createBatman(); batman.position.set(-0.8,0,0); batman.rotation.y=Math.PI/2; group.add(batman);
  walk.addCollider(x-0.8,z,0.5,'batman');
  let unlocked=false, open=0;
  const interaction={
    id:'prison', position:new THREE.Vector3(x+3.5,floor,z), radius:2.4,
    label:'Unlock prison', available:()=>!unlocked,
    activate(){
      if(unlocked) return;
      unlocked=true; shackle.visible=lock.visible=false;
      return 'Prison unlocked — Batman is free. You can enter.';
    },
  };
  group.userData.interactable=interaction;
  group.userData.update=(time,_camera,_player,dt=1/60)=>{
    if(unlocked && open<1){
      open=Math.min(1,open+dt/1.1); gate.position.z=THREE.MathUtils.smoothstep(open,0,1)*2.2;
      for(const entry of gateColliders) entry.collider.z=z+entry.offset+gate.position.z;
      if(open===1) walk.navigationVersion=(walk.navigationVersion??0)+1;
    }
    batman.userData.animate(time,unlocked);
  };
  group.userData.isUnlocked=()=>unlocked;
  return group;
}
