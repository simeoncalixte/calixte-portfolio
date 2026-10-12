import {NodeIO} from '@gltf-transform/core';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as T from 'three';
import {Player} from '../../../src/player/player.js';
const io=new NodeIO();
async function load(path){const d=await io.read(path);for(const m of d.getRoot().listMaterials())for(const k of ['BaseColor','Normal','Emissive','MetallicRoughness','Occlusion'])m[`set${k}Texture`](null);const b=await io.writeBinary(d);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const player=new Player(await load('public/assets/character/male-explorer.glb'),{blocked:()=>false,move:(p,x,z)=>new T.Vector3(p.x+x,0,p.z+z)},await load('public/assets/character/female-explorer.glb'));
player.setGender('male');
async function save(name){
 const d=await io.read('public/assets/character/male-explorer.glb');for(const a of d.getRoot().listAnimations())a.dispose();
 for(const n of d.getRoot().listNodes()){const o=player.model.getObjectByName(T.PropertyBinding.sanitizeNodeName(n.getName()));if(o){n.setTranslation(o.position.toArray());n.setRotation(o.quaternion.toArray());n.setScale(o.scale.toArray());}}
 const scene=d.getRoot().listScenes()[0],wrapper=d.createNode('PlayerScale').setTranslation(player.model.position.toArray()).setScale(player.model.scale.toArray());for(const child of [...scene.listChildren()]){scene.removeChild(child);wrapper.addChild(child);}scene.addChild(wrapper);
 await io.write(`/tmp/casual-man-${name}.glb`,d);
}
for(const name of ['idle','walk','run']){player.mixer.stopAllAction();player.actions[name].reset().play();player.mixer.update(.25);await save(name);}
player.mixer.stopAllAction();player.actions.idle.reset().play();player.current=player.actions.idle;
player.meditate(new T.Vector3(),0);for(let i=0;i<80;i++)player.update(1/60,0);await save('meditate');
player.teleport(new T.Vector3(0,0,1.15),Math.PI);
const dog=new T.Group();dog.userData.petTarget=()=>new T.Vector3(0,.8,0);player.petDog(dog);for(let i=0;i<80;i++)player.update(1/60,0);await save('pet');
console.log('Runtime pose snapshots exported');
