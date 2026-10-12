import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {Matrix4,Matrix3,Vector3} from 'three';
const doc=await new NodeIO().read('public/assets/character/adventurer.glb');
const parts=[];
for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh())){
 const matrix=new Matrix4().fromArray(node.getWorldMatrix()),normalMatrix=new Matrix3().getNormalMatrix(matrix);
 node.getMesh().listPrimitives().forEach((p,index)=>{
  const pos=p.getAttribute('POSITION'),normal=p.getAttribute('NORMAL'),vertices=[],normals=[];
  for(let i=0;i<pos.getCount();i++){
   const v=new Vector3().fromArray(pos.getElement(i,[])).applyMatrix4(matrix);vertices.push([v.x,-v.z,v.y]);
   const n=new Vector3().fromArray(normal.getElement(i,[])).applyMatrix3(normalMatrix);normals.push([n.x,-n.z,n.y]);
  }
  parts.push({joints:Array.from(p.getAttribute('JOINTS_0').getArray()),weights:Array.from(p.getAttribute('WEIGHTS_0').getArray()),headJoint:node.getSkin().listJoints().findIndex(j=>j.getName()==='Head'),node:node.getName(),index,material:p.getMaterial().getName(),color:p.getMaterial().getBaseColorFactor(),vertices,normals,indices:Array.from(p.getIndices()?.getArray()??Array.from({length:pos.getCount()},(_,i)=>i))});
 });
}
await fs.writeFile('scripts/art/female-source.json',JSON.stringify(parts));
