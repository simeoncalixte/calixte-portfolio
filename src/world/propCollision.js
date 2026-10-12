import * as THREE from 'three';

/** Bounds of rendered triangles, optionally clipped below a world-space height. */
export function propBounds(parts, placement, ceiling = Infinity) {
  const bounds=new THREE.Box3(), matrix=new THREE.Matrix4();
  const vertices=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  const crossing=new THREE.Vector3();
  for(const part of parts){
    matrix.multiplyMatrices(placement,part.matrix);
    const geometry=part.geometry, positions=geometry.attributes.position, index=geometry.index;
    const start=geometry.drawRange.start;
    const end=Math.min(index?.count ?? positions.count,start+geometry.drawRange.count);
    for(let i=start;i+2<end;i+=3){
      for(let k=0;k<3;k++)vertices[k].fromBufferAttribute(positions,index?index.getX(i+k):i+k).applyMatrix4(matrix);
      for(let k=0;k<3;k++){
        const a=vertices[k], b=vertices[(k+1)%3];
        if(a.y<=ceiling)bounds.expandByPoint(a);
        if((a.y<ceiling && b.y>ceiling)||(b.y<ceiling && a.y>ceiling)){
          crossing.copy(a).lerp(b,(ceiling-a.y)/(b.y-a.y));
          bounds.expandByPoint(crossing);
        }
      }
    }
  }
  return bounds;
}

export function addPropCollider(walk, parts, placement, tag, ceiling = Infinity) {
  const bounds=propBounds(parts,placement,ceiling);
  if(bounds.isEmpty())return;
  const center=bounds.getCenter(new THREE.Vector3()), size=bounds.getSize(new THREE.Vector3());
  return walk.addBoxCollider(center.x,center.z,Math.max(.05,size.x/2),Math.max(.05,size.z/2),0,tag);
}
