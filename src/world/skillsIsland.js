import * as THREE from 'three';
import { SKILL_GROUPS } from '../experience.js';

export const SKILL_AREAS = [
  { id:'interfaces', title:'Interfaces', color:'#61dafb', symbol:'</>', examples:['manit','geeks'], description:'Build responsive interfaces and reusable components.' },
  { id:'services', title:'Services', color:'#b59aff', symbol:'{ }', examples:['manit','sparks'], description:'Connect applications through APIs and backend services.' },
  { id:'data', title:'Data', color:'#ffc570', symbol:'DB', examples:['sparks','prowinch'], description:'Work with databases, search, and inventory integrations.' },
  { id:'delivery', title:'Delivery', color:'#85e2ab', symbol:'✓', examples:['cbs','manit'], description:'Test, deploy, and maintain dependable applications.' },
].map((area,i)=>({...area, skills:SKILL_GROUPS[i][1], x:Math.sin(Math.PI/4+i*Math.PI/2)*7, z:Math.cos(Math.PI/4+i*Math.PI/2)*7}));

function sign(area) {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
  const c=canvas.getContext('2d');
  c.fillStyle='#0c1928';c.fillRect(0,0,1024,1024);
  c.fillStyle=area.color;c.fillRect(0,0,1024,12);
  c.font='700 78px sans-serif';c.fillText(area.symbol,55,125);
  c.font='700 68px sans-serif';c.fillStyle='#ffffff';c.fillText(area.title.toUpperCase(),55,240);
  area.skills.forEach((skill,i)=>{
    const columns=area.skills.length>8?2:1, rows=Math.ceil(area.skills.length/columns);
    const x=55+Math.floor(i/rows)*480, y=330+(i%rows)*(columns===2?104:72);
    c.fillStyle=area.color;c.fillRect(x,y-22,9,9);
    c.fillStyle='#e0ebf4';c.font=columns===2?'30px sans-serif':'38px sans-serif';c.fillText(skill,x+28,y);
  });
  c.fillStyle=area.color;c.font='27px sans-serif';c.fillText('E  EXPLORE SKILLS + RELATED WORK',55,966);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  return texture;
}

/** Four skill workbenches with tangible symbols and moving links to the core. */
export function createSkillsExhibits() {
  const group=new THREE.Group(),stations=[],animations=[];
  const metal=new THREE.MeshStandardMaterial({color:'#162636',metalness:.65,roughness:.4});
  for(const area of SKILL_AREAS) {
    const station=new THREE.Group();station.position.set(area.x,0,area.z);station.rotation.y=Math.atan2(-area.x,-area.z);station.name=`skills:${area.id}`;
    const accent=new THREE.MeshStandardMaterial({color:area.color,emissive:area.color,emissiveIntensity:.45,roughness:.3,metalness:.2});
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1.65,1.8,.28,32),metal);base.position.y=.14;station.add(base);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1.7,.045,6,64),new THREE.MeshBasicMaterial({color:area.color}));rim.rotation.x=Math.PI/2;rim.position.y=.3;station.add(rim);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(3.8,3.8,.16),metal);frame.position.set(0,3.6,-.6);station.add(frame);
    const material=new THREE.MeshBasicMaterial({map:sign(area),toneMapped:false});
    // Readable from both the centre and bridge approaches, never mirrored text.
    for(const side of [1,-1]) {const board=new THREE.Mesh(new THREE.PlaneGeometry(3.65,3.65),material);board.position.set(0,3.6,-.6+side*.09);board.rotation.y=side===1?0:Math.PI;station.add(board);}
    for(const x of [-1.45,1.45]){const post=new THREE.Mesh(new THREE.BoxGeometry(.12,1.9,.12),metal);post.position.set(x,1,-.6);station.add(post);}
    const emblem=new THREE.Group();emblem.position.set(0,1,.45);station.add(emblem);
    if(area.id==='interfaces') {
      const nucleus=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),accent);emblem.add(nucleus);
      for(let i=0;i<3;i++){const orbit=new THREE.Mesh(new THREE.TorusGeometry(.6,.025,6,48),accent);orbit.scale.y=.4;orbit.rotation.z=i*Math.PI/3;emblem.add(orbit);}
      animations.push(t=>emblem.rotation.y=Math.sin(t*.5)*.4);
    } else if(area.id==='data') {
      for(let i=0;i<3;i++){const disc=new THREE.Mesh(new THREE.CylinderGeometry(.53,.53,.24,32),accent);disc.position.y=i*.3-.3;emblem.add(disc);}
      animations.push(t=>emblem.rotation.y=t*.25);
    } else if(area.id==='services') {
      const points=[new THREE.Vector3(-.65,-.2,0),new THREE.Vector3(0,.45,0),new THREE.Vector3(.65,-.2,0)];
      for(const position of points){const box=new THREE.Mesh(new THREE.BoxGeometry(.35,.35,.35),accent);box.position.copy(position);emblem.add(box);}
      emblem.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([...points,points[0]]),new THREE.LineBasicMaterial({color:area.color})));
      animations.push(t=>emblem.rotation.y=Math.sin(t*.45)*.5);
    } else {
      for(let i=0;i<3;i++){const block=new THREE.Mesh(new THREE.BoxGeometry(.42,.5,.3),metal);block.position.x=(i-1)*.65;emblem.add(block);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.09,10,6),accent.clone());lamp.position.set((i-1)*.65,0,.2);emblem.add(lamp);animations.push(t=>lamp.material.emissiveIntensity=.3+Math.max(0,Math.sin(t*2-i*1.4)));}
    }
    station.traverse(o=>{if(o.isMesh&&o.material!==material)o.castShadow=true;});
    group.add(station);stations.push({area,station});
    const from=new THREE.Vector3(0,1.2,0),to=new THREE.Vector3(area.x,.45,area.z);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([from,to]),new THREE.LineBasicMaterial({color:area.color,transparent:true,opacity:.45})));
    const packet=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),new THREE.MeshBasicMaterial({color:area.color}));group.add(packet);
    animations.push(t=>packet.position.lerpVectors(from,to,(t*.18+stations.length*.21)%1));
  }
  group.userData.update=t=>animations.forEach(fn=>fn(t));
  return {group,stations};
}
