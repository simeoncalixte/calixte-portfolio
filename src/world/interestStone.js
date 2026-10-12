import * as THREE from 'three';
import { island, surfaceHeight } from './layout.js';

export const REFLECTION = 'A reflection of curiosity today, a world of possibilities tomorrow.';

export function interestStonePosition(bridges) {
  const bridge=bridges.find(b=>b.to==='interest');
  const side=new THREE.Vector3(-bridge.dir.z,0,bridge.dir.x);
  const position=bridge.pb.clone().addScaledVector(bridge.dir,3).addScaledVector(side,bridge.halfWidth+3.3);
  position.y=surfaceHeight(island('interest'),position.x,position.z);
  return position;
}

/** A readable stone facing arriving visitors, outside the bridge approach. */
export function createInterestStone(walk) {
  const bridge=walk.bridges.find(b=>b.to==='interest');
  const stone=new THREE.Group();stone.name='interest-reflection-stone';
  stone.position.copy(interestStonePosition(walk.bridges));
  stone.rotation.y=Math.atan2(-bridge.dir.x,-bridge.dir.z);
  stone.userData.inscription=REFLECTION;
  const shape=new THREE.Shape();
  shape.moveTo(-1.35,0);shape.lineTo(1.35,0);shape.lineTo(1.4,1.75);
  shape.lineTo(1.12,2.12);shape.lineTo(-.9,2.2);shape.lineTo(-1.4,1.9);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.48,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:2});
  geometry.translate(0,0,-.24);
  const body=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#66716b',roughness:1}));
  body.castShadow=true;body.receiveShadow=true;stone.add(body);
  let map=null;
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1024;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#192520';ctx.fillRect(0,0,1536,1024);
    ctx.strokeStyle='#a9ab8e';ctx.lineWidth=3;ctx.strokeRect(48,48,1440,928);
    ctx.textAlign='center';ctx.fillStyle='#eee4c9';ctx.font='italic 112px Georgia, serif';
    ctx.fillText('A reflection',768,260);
    ctx.font='bold 86px Georgia, serif';
    ['of curiosity today,','a world of possibilities','tomorrow.'].forEach((line,i)=>ctx.fillText(line,768,440+i*125));
    map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  }
  const inscription=new THREE.Mesh(new THREE.PlaneGeometry(2.5,1.67),new THREE.MeshBasicMaterial({map,color:'#ffffff',toneMapped:false}));
  inscription.name='reflection-inscription';inscription.position.set(0,1.04,.325);stone.add(inscription);
  walk.addBoxCollider(stone.position.x,stone.position.z,1.5,.34,stone.rotation.y,stone.name);
  return stone;
}
