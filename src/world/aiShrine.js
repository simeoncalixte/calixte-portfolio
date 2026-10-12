import * as THREE from 'three';
import { createShrineStone } from './shrineStone.js';
import { createShrineBots } from './shrineBots.js';
import { island, surfaceHeight } from './layout.js';

/** A wordless discovery on the existing lookout: stone, circuits and a living network. */
export function createAIShrine(walk) {
  const group=new THREE.Group();group.name='ai-shrine';
  const isl=island('lookout'),x=isl.center[0]+4,z=isl.center[2]+2;
  const ground=surfaceHeight(isl,x,z);
  group.position.set(x,ground,z);
  const stone=new THREE.MeshStandardMaterial({color:'#253841',roughness:.65,metalness:.25});
  const bronze=new THREE.MeshStandardMaterial({color:'#aa8852',roughness:.4,metalness:.8});
  const glow=new THREE.MeshStandardMaterial({color:'#8beeff',emissive:'#43cddd',emissiveIntensity:2.5,roughness:.25});
  const violet=new THREE.MeshStandardMaterial({color:'#cbb6ff',emissive:'#9470ed',emissiveIntensity:1.6,metalness:.3,roughness:.2});
  const add=(name,geometry,material,px,py,pz)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(px,py,pz);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  };
  // Flush, traversable square dais: low enough to walk onto from every direction.
  add('stone-dais',new THREE.BoxGeometry(6,.22,6),stone,0,.04,0);
  walk.addPlatform(x,z,3,3,ground+.15);
  const ring=(radius,y,mat,tube=.025)=>{const r=add('circuit-ring',new THREE.TorusGeometry(radius,tube,8,96),mat,0,y,0);r.rotation.x=Math.PI/2;return r;};
  ring(2.65,.17,bronze);ring(2.35,.17,glow,.012);
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,px=Math.cos(angle),pz=Math.sin(angle);
    const trace=add('circuit-trace',new THREE.BoxGeometry(.025,.015,.58),bronze,px*2.03,.17,pz*2.03);trace.rotation.y=Math.PI/2-angle;
    add('circuit-node',new THREE.SphereGeometry(.055,8,6),glow,px*1.75,.18,pz*1.75);
  }
  add('altar',new THREE.CylinderGeometry(.85,1.05,.65,8),stone,0,.475,0);
  ring(.83,.81,bronze,.045);
  walk.addCollider(x,z,1.05,'ai-shrine-altar');
  for(const [px,pz] of [[-2.35,-2.35],[2.35,-2.35],[-2.35,2.35],[2.35,2.35]]){
    add('pillar-base',new THREE.BoxGeometry(.7,.24,.7),bronze,px,.27,pz);
    add('stone-pillar',new THREE.BoxGeometry(.42,2.7,.42),stone,px,1.7,pz);
    add('pillar-cap',new THREE.OctahedronGeometry(.32),violet,px,3.26,pz);
    const stripe=add('pillar-inlay',new THREE.BoxGeometry(.035,2.2,.43),glow,px,1.7,pz);
    stripe.castShadow=false;
    walk.addBoxCollider(x+px,z+pz,.35,.35,0,'ai-shrine-pillar');
  }
  const network=new THREE.Group();network.position.y=2.1;group.add(network);
  const points=[];
  for(let i=0;i<18;i++){
    const y=1-2*(i+.5)/18,r=Math.sqrt(1-y*y),a=i*2.399963;
    const p=new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(.83);points.push(p);
    const node=new THREE.Mesh(new THREE.IcosahedronGeometry(i%3===0?.09:.06),i%3===0?violet:glow);node.position.copy(p);network.add(node);
  }
  const lines=[];
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(points[i].distanceTo(points[j])<.85)lines.push(...points[i],...points[j]);
  const links=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(lines,3)),new THREE.LineBasicMaterial({color:'#67dce5',transparent:true,opacity:.65}));network.add(links);
  const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.23,1),glow);network.add(core);
  const halo=ring(1.12,2.1,bronze,.025);halo.rotation.set(.5,0,.4);
  const light=new THREE.PointLight('#64e5f2',8,8,2);light.position.y=2.2;group.add(light);
  const bots=createShrineBots(walk,group.position);group.add(bots);
  group.add(createShrineStone(walk,group.position));
  group.userData.update=t=>{
    bots.userData.update(t);
    network.rotation.y=t*.18;network.position.y=2.1+Math.sin(t*1.2)*.09;
    halo.rotation.z=t*.13;core.rotation.x=t*.4;core.rotation.z=t*.3;
    glow.emissiveIntensity=2.1+Math.sin(t*1.5)*.4;light.intensity=7+Math.sin(t*1.5)*1.5;
  };
  return group;
}
