import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {Matrix4,Matrix3,Vector3} from 'three';
const io=new NodeIO(),doc=await io.read('public/assets/character/adventurer.glb');
const fabric=doc.createTexture('Explorer woven fabric').setMimeType('image/png').setImage(await fs.readFile('public/assets/character/female-fabric.png'));
const edits=JSON.parse(await fs.readFile('scripts/art/female-sculpt.json','utf8'));
const buffer=doc.getRoot().listBuffers()[0],meshes=new Map(),materials=new Map();
for(const edit of edits){
 const node=doc.getRoot().listNodes().find(n=>n.getName()===edit.node);
 if(!meshes.has(edit.node)){
  const old=node.getMesh(),mesh=doc.createMesh(edit.node);node.setMesh(mesh);old.dispose();meshes.set(edit.node,mesh);
 }
 const inverse=new Matrix4().fromArray(node.getWorldMatrix()).invert(),normal=new Matrix3().getNormalMatrix(inverse);
 const positions=[],normals=[],uvs=[];
 for(let i=0;i<edit.vertices.length;i++){
  const [x,y,z]=edit.vertices[i],[nx,ny,nz]=edit.normals[i];uvs.push(x*8,z*8);
  positions.push(...new Vector3(x,z,-y).applyMatrix4(inverse));
  normals.push(...new Vector3(nx,nz,-ny).applyMatrix3(normal).normalize());
 }
 if(!materials.has(edit.material))materials.set(edit.material,doc.createMaterial(edit.material).setBaseColorFactor(edit.color).setRoughnessFactor(edit.material.startsWith('Eye_')?.35:.75).setDoubleSided(edit.material.includes('Hair')));
 if(edit.material.startsWith('Explorer_'))materials.get(edit.material).setBaseColorTexture(fabric);
 const accessor=(type,values)=>doc.createAccessor().setType(type).setArray(values).setBuffer(buffer);
 meshes.get(edit.node).addPrimitive(doc.createPrimitive().setMaterial(materials.get(edit.material))
  .setAttribute('POSITION',accessor('VEC3',new Float32Array(positions)))
  .setAttribute('NORMAL',accessor('VEC3',new Float32Array(normals)))
  .setAttribute('TEXCOORD_0',accessor('VEC2',new Float32Array(uvs)))
  .setAttribute('JOINTS_0',accessor('VEC4',new Uint16Array(edit.joints)))
  .setAttribute('WEIGHTS_0',accessor('VEC4',new Float32Array(edit.weights)))
  .setIndices(accessor('SCALAR',edit.vertices.length>65535?new Uint32Array(edit.indices):new Uint16Array(edit.indices))));
}
await io.write('public/assets/character/female-explorer.glb',doc);
