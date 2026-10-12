import * as T from 'three';
import {SKILL_JOURNEY} from '../skillJourney.js';
import {island,surfaceHeight} from './layout.js';

function board(chapter,index){
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1024;
  const c=canvas.getContext('2d');c.fillStyle='#0c1928';c.fillRect(0,0,1536,1024);
  c.fillStyle=chapter.color;c.fillRect(0,0,1536,14);c.font='bold 44px sans-serif';c.fillText(`SKILLS JOURNEY   ${index+1} / 4`,80,115);
  c.fillStyle='#ffffff';c.font='bold 72px sans-serif';c.fillText(chapter.short,80,245,1376);
  c.font='46px sans-serif';
  chapter.topics.forEach(([title],i)=>c.fillText(`${i+1}. ${title}`,80,390+i*105,1376));
  c.fillStyle=chapter.color;c.font='bold 40px sans-serif';c.fillText('E  EXPLORE IN DETAIL',80,790);
  c.fillStyle='#cbd9e7';c.font='34px sans-serif';
  c.fillText(index<3?`NEXT: ${SKILL_JOURNEY[index+1].short}`:'JOURNEY COMPLETE · RETURN TO THE SKILLS HUB',80,915,1376);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  return new T.MeshBasicMaterial({map,toneMapped:false});
}

/** Four distinct physical exhibits beside a clear route through each island. */
export function createSkillJourney(walk){
  const group=new T.Group();group.name='skills-journey';
  const interactables=[],beacons=[],updates=[];
  const metal=new T.MeshStandardMaterial({color:'#142333',roughness:.55,metalness:.4});
  SKILL_JOURNEY.forEach((chapter,index)=>{
    const isl=island(chapter.id),[x,,z]=isl.center;
    const exhibit=new T.Group();exhibit.name=chapter.id;
    exhibit.position.set(x+5.5,surfaceHeight(isl,x+5.5,z),z);group.add(exhibit);
    const accent=new T.MeshStandardMaterial({color:chapter.color,emissive:chapter.color,emissiveIntensity:.4,roughness:.45});
    const add=(geometry,material,px,py,pz,parent=exhibit)=>{const mesh=new T.Mesh(geometry,material);mesh.position.set(px,py,pz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    add(new T.CylinderGeometry(3,3.2,.4,48),metal,0,.2,0);
    if(index===0){
      for(let i=0;i<3;i++){
        add(new T.CylinderGeometry(.55,.55,.8,24),accent,(i-1)*1.7,1,0);
        if(i<2){const pipe=add(new T.CylinderGeometry(.09,.09,1.7,12),metal,(i-.5)*1.7,1,0);pipe.rotation.z=Math.PI/2;}
      }
      for(let i=0;i<5;i++){const packet=add(new T.SphereGeometry(.12,10,8),accent,0,1.6,0);updates.push(t=>packet.position.x=-1.9+((t*.6+i*.8)%4));}
      for(let i=0;i<4;i++)add(new T.BoxGeometry(.4,.5+i*.3,.4),accent,-.9+i*.6,2.1+i*.15,-.65);
    }else if(index===1){
      for(let i=0;i<3;i++){
        add(new T.BoxGeometry(.95,2.5,.85),metal,(i-1)*1.35,1.65,0);
        for(let j=0;j<5;j++){
          add(new T.BoxGeometry(.78,.25,.08),accent,(i-1)*1.35,.7+j*.44,.47);
          const light=add(new T.SphereGeometry(.05,8,6),new T.MeshBasicMaterial({color:chapter.color}),(i-1)*1.35+.26,.7+j*.44,.53);
          updates.push(t=>light.visible=Math.sin(t*2+i+j)>.0);
        }
      }
    }else if(index===2){
      add(new T.BoxGeometry(4,2.6,.22),metal,0,2.15,0);
      add(new T.BoxGeometry(3.7,.3,.05),accent,0,3.15,.15);
      for(let i=0;i<3;i++)add(new T.BoxGeometry(.95,1.35,.05),accent,(i-1)*1.2,2.05,.15);
      add(new T.BoxGeometry(.3,.8,.3),metal,0,.8,0);
      add(new T.BoxGeometry(1.1,1.9,.18),metal,2,1.45,.9);
      add(new T.BoxGeometry(.85,1.55,.05),accent,2,1.45,1.01);
    }else{
      for(let i=0;i<5;i++){
        const height=[.9,1.6,1.2,2.5,3][i];
        add(new T.BoxGeometry(.5,height,.6),accent,-1.7+i*.8,.4+height/2,0);
      }
      const points=[.9,1.6,1.2,2.5,3].map((h,i)=>new T.Vector3(-1.7+i*.8,h+.75,0));
      exhibit.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:'#ffffff'})));
      for(const p of points)add(new T.SphereGeometry(.11,10,8),accent,p.x,p.y,p.z);
    }
    walk.addCollider(exhibit.position.x,exhibit.position.z,3.25,chapter.id);
    const sign=new T.Group();sign.name=`${chapter.id}:sign`;sign.position.set(x-5,surfaceHeight(isl,x-5,z),z);
    group.add(sign);const material=board(chapter,index);
    add(new T.BoxGeometry(5,3.5,.2),metal,0,3,0,sign);
    for(const side of [1,-1]){const face=add(new T.PlaneGeometry(4.8,3.2),material,0,3,side*.11,sign);face.rotation.y=side===1?0:Math.PI;}
    for(const px of [-2,2])add(new T.BoxGeometry(.18,1.4,.18),metal,px,.7,0,sign);
    walk.addBoxCollider(sign.position.x,sign.position.z,2.5,.2,0,chapter.id);
    for(const side of [1,-1])interactables.push({id:chapter.id,label:`Explore ${chapter.title}`,position:sign.position.clone().add(new T.Vector3(0,0,side*2)),radius:3.4});
    beacons.push({id:chapter.id,label:isl.label,anchor:new T.Vector3(x,isl.center[1]+12,z),base:new T.Vector3(x,isl.center[1]+1,z)});
  });
  return {group,interactables,beacons,update:t=>updates.forEach(fn=>fn(t))};
}
