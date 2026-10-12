import * as THREE from 'three';
import { publicUrl } from '../core/publicUrl.js';
import { island, surfaceHeight } from './layout.js';

export function shrineStonePosition(bridges) {
  const bridge=bridges.find(b=>b.to==='lookout');
  // Three metres inland, beyond the full bridge width plus a generous shoulder.
  const side=new THREE.Vector3(-bridge.dir.z,0,bridge.dir.x);
  const position=bridge.pb.clone().addScaledVector(bridge.dir,3).addScaledVector(side,bridge.halfWidth+2.5);
  position.y=surfaceHeight(island('lookout'),position.x,position.z);
  return {position,yaw:Math.atan2(-bridge.dir.x,-bridge.dir.z)};
}

/** User-supplied artwork inset into a stone beside the entrance, facing the approach. */
export function createShrineStone(walk,origin) {
  const stone=new THREE.Group();stone.name='shrine-entrance-stone';
  const {position,yaw}=shrineStonePosition(walk.bridges);
  stone.position.copy(position).sub(origin);stone.rotation.y=yaw;
  const shape=new THREE.Shape();
  shape.moveTo(-.7,0);shape.lineTo(.7,0);shape.lineTo(.72,2.25);
  shape.lineTo(.53,2.47);shape.lineTo(-.46,2.5);shape.lineTo(-.73,2.27);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:true,bevelThickness:.06,bevelSize:.055,bevelSegments:2,steps:1});
  geometry.translate(0,0,-.15);
  const body=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#343b3d',roughness:.95}));
  body.name='carved-stone';body.castShadow=true;body.receiveShadow=true;stone.add(body);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1.3,2.27,.035),new THREE.MeshStandardMaterial({color:'#111719',roughness:.85}));
  frame.position.set(0,1.23,.218);stone.add(frame);
  let map=null;
  if(typeof document!=='undefined' && document.createElementNS){
    map=new THREE.TextureLoader().load(publicUrl('assets/shrine/isaiah-60-22.jpg'));
    map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  }
  // Match the image's exact aspect ratio so neither the cross nor the text is cropped.
  const artwork=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2*1308/736),new THREE.MeshStandardMaterial({map,color:'#ffffff',roughness:.9,emissive:'#ffffff',emissiveMap:map,emissiveIntensity:map?.22:0}));
  artwork.name='isaiah-artwork';artwork.position.set(0,1.23,.239);stone.add(artwork);
  walk.addBoxCollider(position.x,position.z,.8,.24,yaw,stone.name);
  return stone;
}
