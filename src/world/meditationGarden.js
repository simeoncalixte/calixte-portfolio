import * as THREE from 'three';

/** Open overlook: timber deck, reflecting pool, stones, and a marked cushion. */
export function createMeditationGarden(trees=[]) {
  const group=new THREE.Group();group.name='meditation-garden';
  const wood=new THREE.MeshStandardMaterial({color:'#75604b',roughness:.9});
  const stone=new THREE.MeshStandardMaterial({color:'#687674',roughness:1});
  const moss=new THREE.MeshStandardMaterial({color:'#567351',roughness:1});
  const cushionMat=new THREE.MeshStandardMaterial({color:'#b47c54',roughness:1});
  const add=(name,geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
  add('overlook-deck',new THREE.BoxGeometry(8,.3,7),wood,0,.05,.5);
  const seams=new THREE.MeshStandardMaterial({color:'#4c4136',roughness:1});
  for(let i=-9;i<=9;i++)add('deck-plank-seam',new THREE.BoxGeometry(.018,.004,7),seams,i*.4,.202,.5);
  add('meditation-cushion',new THREE.CylinderGeometry(.62,.66,.14,48),cushionMat,0,.27,1.4);
  const marker=add('meditation-marker',new THREE.TorusGeometry(.88,.023,8,64),new THREE.MeshBasicMaterial({color:'#c8e9bd',transparent:true,opacity:.65}),0,.215,1.4);marker.rotation.x=Math.PI/2;
  add('pool-basin',new THREE.CylinderGeometry(1.7,1.85,.25,48),stone,-2.15,.3,-1);
  const water=add('reflecting-water',new THREE.CircleGeometry(1.56,64),new THREE.MeshStandardMaterial({color:'#6eb5b2',metalness:.5,roughness:.2}),-2.15,.43,-1);water.rotation.x=-Math.PI/2;
  for(let i=0;i<3;i++){
    const rock=add('balanced-stone',new THREE.DodecahedronGeometry(.6-i*.12,1),stone,2.6,.5+i*.5,-1.6);rock.scale.set(1,.55,.8);rock.rotation.y=i*.7;
  }
  for(const [x,z] of [[-3.4,-2.5],[3.35,-2.3]]){
    add('mossy-planter',new THREE.SphereGeometry(.65,16,10),moss,x,.27,z).scale.y=.5;
    if(trees.length){
      const tree=trees[x<0?0:Math.min(1,trees.length-1)].scene.clone();
      tree.name='garden-tree';tree.scale.setScalar(2.8);tree.position.set(x,.3,z);group.add(tree);
    }
  }
  // A low reading stone keeps the About Me panel accessible by the entrance.
  add('about-reading-stone',new THREE.BoxGeometry(1.1,.6,.55),stone,2.8,.48,2.9);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#253c38';ctx.fillRect(0,0,512,256);ctx.textAlign='center';ctx.fillStyle='#edf3df';ctx.font='32px sans-serif';ctx.fillText('A MOMENT OF STILLNESS',256,85);ctx.font='24px sans-serif';ctx.fillText('E · Meditate at the circle',256,150);ctx.fillText('Move to stand up',256,195);
  const sign=add('meditation-sign',new THREE.PlaneGeometry(1.8,.9),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide}),-1.7,.85,3.2);sign.rotation.x=-.2;
  group.userData.update=time=>{marker.material.opacity=.45+.18*Math.sin(time*1.4);};
  return {group,beaconLocal:new THREE.Vector3(0,2.8,-1),register(walk){
    group.updateMatrixWorld(true);
    const world=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(group.matrixWorld);
    const deck=world(0,.2,.5);walk.addPlatform(deck.x,deck.z,4,3.5,deck.y,group.rotation.y);
    const seat=world(0,.34,1.4);walk.addPlatform(seat.x,seat.z,.55,.55,seat.y,group.rotation.y);
    for(const [x,z,r] of [[-2.15,-1,1.85],[2.6,-1.6,.65],[-3.4,-2.5,.4],[3.35,-2.3,.4],[2.8,2.9,.6],[-1.7,3.2,.35]]){const p=world(x,0,z);walk.addCollider(p.x,p.z,r,'meditation-garden');}
    return {seat,reading:world(2.8,.2,3.7),heading:group.rotation.y};
  }};
}
