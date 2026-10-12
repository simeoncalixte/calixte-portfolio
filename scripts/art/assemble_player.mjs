// Transfer the Blender palette while preserving the proven gameplay mesh and rig.
import { NodeIO } from '@gltf-transform/core';
import { copyToDocument } from '@gltf-transform/functions';
const io=new NodeIO(), original=await io.read('scripts/art/adventurer-original.glb');
const revised=await io.read('scripts/art/adventurer-blender.glb');
const materials=copyToDocument(original,revised,revised.getRoot().listMaterials());
for(const mesh of original.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
 const old=primitive.getMaterial().getName();
 const name=mesh.getName()==='Adventurer_Legs' && old==='Brown'?'Explorer_TrouserPanels':(['Green','LightGreen','Brown','Brown2','Grey','Black','Gold'].includes(old)?'Explorer_'+old:old);
 const material=revised.getRoot().listMaterials().find(m=>m.getName()===name);
 if(material)primitive.setMaterial(materials.get(material));
}
await io.write('public/assets/character/adventurer.glb',original);
