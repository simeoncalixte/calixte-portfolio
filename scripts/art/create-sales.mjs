import * as T from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'node:fs/promises';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const group=new T.Group();group.name='Sales growth';
const navy=new T.MeshStandardMaterial({color:'#244055',metalness:.3,roughness:.5});
const gold=new T.MeshStandardMaterial({color:'#f3bb66',metalness:.55,roughness:.35});
const teal=new T.MeshStandardMaterial({color:'#60cbbb',roughness:.4});
function add(name,geo,mat,x,y,z){const m=new T.Mesh(geo,mat);m.name=name;m.position.set(x,y,z);group.add(m);return m;}
add('briefcase',new T.BoxGeometry(2.4,1.5,.65),navy,0,.75,0);
add('handle-top',new T.BoxGeometry(.8,.14,.2),gold,0,1.83,0);
for(const x of [-.34,.34])add('handle-side',new T.BoxGeometry(.12,.3,.2),gold,x,1.68,0);
for(const [i,h] of [.35,.6,.9].entries())add('growth-bar',new T.BoxGeometry(.28,h,.1),teal,-.65+i*.55,.2+h/2,.38);
const points=[new T.Vector3(-.9,1.0,.42),new T.Vector3(-.25,1.2,.42),new T.Vector3(.25,1.4,.42),new T.Vector3(.9,1.85,.42)];
add('growth-arrow',new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.05,8,false),gold,0,0,0);
const arrow=add('arrow-tip',new T.ConeGeometry(.14,.3,3),gold,.91,1.87,.42);arrow.rotation.z=-.8;
const data=await new GLTFExporter().parseAsync(group,{binary:true});await fs.writeFile('public/assets/interest/sales.glb',Buffer.from(data));
