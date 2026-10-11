import * as THREE from 'three';
import { INTEREST_VERTICALS } from '../interests.js';
import { island, radiusAt, surfaceHeight } from './layout.js';
import { normalizeModel } from '../core/assets.js';

/** Grounded interest exhibits near the rim, facing back toward the observatory. */
export function createInterestVerticals(lib) {
  const group=new THREE.Group(), stations=[];
  group.name='interest:verticals';
  const isl=island('interest');
  for (const area of INTEREST_VERTICALS) {
    const radius=radiusAt(isl,area.angle)-4.8;
    const x=isl.center[0]+Math.cos(area.angle)*radius;
    const z=isl.center[2]+Math.sin(area.angle)*radius;
    const station=new THREE.Group();station.name=`interest:${area.id}`;
    station.position.set(x,surfaceHeight(isl,x,z),z);
    station.rotation.y=Math.atan2(isl.center[0]-x,isl.center[2]-z);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2,.4,48),new THREE.MeshStandardMaterial({color:'#182b3b',roughness:.65,metalness:.35}));
    base.position.y=.2;base.receiveShadow=true;base.castShadow=true;station.add(base);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1.8,.045,8,64),new THREE.MeshBasicMaterial({color:area.color}));
    rim.rotation.x=Math.PI/2;rim.position.y=.42;station.add(rim);
    if (lib[area.model]) {
      const model=normalizeModel(lib[area.model].clone(true),{maxExtent:3});
      model.name=`interest:model:${area.id}`;model.position.y=.43;station.add(model);
    }
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=320;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#0c1928';ctx.fillRect(0,0,1024,320);
    ctx.fillStyle=area.color;ctx.fillRect(0,0,1024,8);
    ctx.textAlign='center';ctx.fillStyle=area.color;ctx.font='24px sans-serif';ctx.fillText('AREAS I’M INTERESTED IN',512,58);
    ctx.fillStyle='#ffffff';ctx.font='700 68px sans-serif';ctx.fillText(area.title.toUpperCase(),512,147,960);
    ctx.fillStyle='#d5e4ee';ctx.font='30px sans-serif';ctx.fillText(area.subtitle,512,210);
    ctx.fillStyle=area.color;ctx.font='27px sans-serif';ctx.fillText('E  EXPLORE '+area.title.toUpperCase(),512,279);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,toneMapped:false}));
    label.name=`interest:label:${area.id}`;label.position.y=4.25;label.scale.set(4.8,1.5,1);station.add(label);
    group.add(station);
    stations.push({area,station});
  }
  return {group,stations};
}
