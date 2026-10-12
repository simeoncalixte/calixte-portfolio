import * as THREE from 'three';

export const SHRINE_BOTS = [
  {id:'codex',name:'Codex',color:'#68e6bb',x:-1.95,z:-1.15,shape:'box'},
  {id:'claude',name:'Claude',color:'#e7a080',x:1.95,z:-1.15,shape:'round'},
  {id:'gemini',name:'Gemini',color:'#9c9aff',x:1.95,z:1.15,shape:'star'},
  {id:'grok',name:'Grok',color:'#e3e9f2',x:-1.95,z:1.15,shape:'visor'},
];

/** Original decorative mascots, with names on the bots rather than an island label. */
export function createShrineBots(walk,origin) {
  const group=new THREE.Group();group.name='shrine-bots';
  const animations=[];
  SHRINE_BOTS.forEach((spec,index)=>{
    const bot=new THREE.Group();bot.name=`shrine-bot-${spec.id}`;bot.userData.botName=spec.name;
    bot.position.set(spec.x,.15,spec.z);bot.rotation.y=spec.x<0?-Math.PI/2:Math.PI/2;group.add(bot);
    const shell=new THREE.MeshStandardMaterial({color:spec.id==='grok'?'#242933':'#d4dce0',roughness:.45,metalness:.45});
    const dark=new THREE.MeshStandardMaterial({color:'#142330',roughness:.3,metalness:.5});
    const light=new THREE.MeshStandardMaterial({color:spec.color,emissive:spec.color,emissiveIntensity:1.4});
    const mesh=(name,geo,mat,x,y,z,parent=bot)=>{const m=new THREE.Mesh(geo,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
    for(const x of [-.16,.16]){
      mesh('boot',new THREE.BoxGeometry(.22,.14,.32),dark,x,.07,.04);
      mesh('leg',new THREE.CylinderGeometry(.065,.08,.23,12),shell,x,.24,0);
    }
    mesh('torso',spec.shape==='round'?new THREE.SphereGeometry(.31,20,14):new THREE.BoxGeometry(.52,.48,.32),shell,0,.55,0);
    mesh('chest-core',new THREE.OctahedronGeometry(.085),light,0,.59,.19);
    const head=new THREE.Group();head.position.y=.98;bot.add(head);
    mesh('head',spec.shape==='round'?new THREE.SphereGeometry(.29,24,16):new THREE.BoxGeometry(.58,.4,.38),shell,0,0,0,head);
    mesh('face-screen',new THREE.BoxGeometry(.46,.24,.035),dark,0,0,.205,head);
    for(const x of [-.12,.12])mesh('eye',new THREE.SphereGeometry(.038,10,8),light,x,.025,.235,head);
    if(spec.shape==='box'){
      // Terminal cursor and keyboard-like chest keys.
      mesh('cursor',new THREE.BoxGeometry(.1,.024,.015),light,.1,-.067,.235,head);
      for(let i=0;i<4;i++)mesh('key',new THREE.BoxGeometry(.045,.026,.02),dark,(i-1.5)*.09,.43,.17);
    }else if(spec.shape==='round'){
      for(let i=0;i<8;i++){const a=i*Math.PI/4;const ray=mesh('sun-ray',new THREE.BoxGeometry(.04,.14,.04),light,Math.sin(a)*.36,Math.cos(a)*.36,0,head);ray.rotation.z=-a;}
    }else if(spec.shape==='star'){
      const star=mesh('twin-star',new THREE.OctahedronGeometry(.19),light,0,.39,0,head);star.scale.set(.75,1.25,.5);
      mesh('satellite-star',new THREE.OctahedronGeometry(.085),light,.23,.27,0,head);
    }else{
      const slash=mesh('visor-slash',new THREE.BoxGeometry(.035,.27,.015),light,0,0,.24,head);slash.rotation.z=-.6;
      mesh('antenna',new THREE.CylinderGeometry(.018,.018,.24,8),dark,.18,.31,0,head);
      mesh('antenna-light',new THREE.SphereGeometry(.05,10,8),light,.18,.44,0,head);
    }
    const arms=[];
    for(const sign of [-1,1]){
      const arm=new THREE.Group();arm.position.set(sign*.34,.7,0);bot.add(arm);
      mesh('arm',new THREE.CapsuleGeometry(.065,.23,4,8),shell,0,-.16,0,arm);
      mesh('hand',new THREE.SphereGeometry(.085,12,8),light,0,-.34,0,arm);arms.push(arm);
    }
    // Small local nameplates; no map pin, beacon, navigation entry or island title.
    if(typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
      const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(15,26,37,.92)';ctx.fillRect(0,0,512,128);
      ctx.strokeStyle=spec.color;ctx.lineWidth=5;ctx.strokeRect(3,3,506,122);
      ctx.font='600 62px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=spec.color;ctx.fillText(spec.name,256,66);
      const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
      const plate=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));plate.name='bot-nameplate';plate.position.y=1.65;plate.scale.set(1,.25,1);bot.add(plate);
    }
    walk.addCollider(origin.x+spec.x,origin.z+spec.z,.43,bot.name);
    animations.push(t=>{head.rotation.y=Math.sin(t*.65+index)*.2;arms[0].rotation.x=Math.sin(t*1.3+index)*.18;arms[1].rotation.z=spec.id==='codex'?-.25-Math.max(0,Math.sin(t*.8))*.7:.12+Math.sin(t+index)*.12;light.emissiveIntensity=1.25+Math.sin(t*1.4+index)*.25;});
  });
  group.userData.update=t=>animations.forEach(update=>update(t));
  return group;
}
