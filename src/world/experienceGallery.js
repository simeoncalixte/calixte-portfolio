import * as THREE from 'three';
import { EXPERIENCE } from '../experience.js';

export const EXHIBIT_LAYOUT = EXPERIENCE.map((experience, i) => {
  const angle = -Math.PI * 5 / 6 + i * Math.PI / 3;
  return { experience, x: Math.sin(angle) * 7, z: Math.cos(angle) * 7, rotation: angle + Math.PI };
});

function displayTexture(experience) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
  const c = canvas.getContext('2d'), images = {};
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const contain = (image, x, y, w, h) => {
    const ratio = Math.min(w / image.width, h / image.height);
    c.drawImage(image, x + (w - image.width * ratio) / 2, y + (h - image.height * ratio) / 2, image.width * ratio, image.height * ratio);
  };
  function draw() {
    c.fillStyle = '#101a28'; c.fillRect(0, 0, 1024, 768);
    c.fillStyle = experience.color; c.fillRect(0, 0, 1024, 8);
    c.font = '600 26px sans-serif'; c.fillStyle = experience.color; c.fillText(experience.year, 42, 57);
    c.textAlign = 'right'; c.fillStyle = '#b8c4d4'; c.fillText('EXPERIENCE', 982, 57); c.textAlign = 'left';
    c.fillStyle = experience.darkLogo || experience.id === 'xbox' ? '#13231e' : '#edf2f7'; c.fillRect(30, 86, 964, 480);
    if (images.image) contain(images.image, 72, 105, 880, 430);
    if (images.logo && experience.logo !== experience.image) {
      c.fillStyle = '#ffffff'; c.fillRect(48, 104, 250, 84); contain(images.logo, 62, 116, 222, 60);
    }
    c.fillStyle = '#ffffff'; c.font = '700 43px sans-serif'; c.fillText(experience.company, 42, 636);
    c.fillStyle = '#c9d4df'; c.font = '26px sans-serif'; c.fillText(experience.focus, 42, 685);
    c.fillStyle = experience.color; c.font = '22px sans-serif'; c.fillText('E  EXPLORE THIS CHAPTER', 42, 733);
    texture.needsUpdate = true;
  }
  draw();
  if (typeof Image !== 'undefined') for (const kind of ['image', 'logo']) {
    if (!experience[kind]) continue;
    const image = new Image(); image.onload = () => { images[kind] = image; draw(); }; image.src = experience[kind];
  }
  return texture;
}

function sculpture(type, color) {
  const root = new THREE.Group(), animated = [];
  const dark = new THREE.MeshStandardMaterial({ color: '#172431', metalness: .65, roughness: .35 });
  const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .7, roughness: .3 });
  const box = (x,y,z,w,h,d,mat=dark) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); root.add(m); return m; };
  if (type === 'console') {
    box(0,.6,0,.48,1.2,.48); box(0,1.21,0,.45,.03,.45,glow);
    for(let i=0;i<4;i++) box(-.13+i*.085,1.24,0,.035,.03,.35);
    box(.65,.16,.12,.7,.22,.38); box(.5,.29,.15,.12,.02,.12,glow); box(.85,.29,.15,.08,.02,.08,glow);
  } else if (type === 'classroom') {
    for(let i=0;i<10;i++) { const x=(i%5-2)*.39,z=Math.floor(i/5)*.52-.2; box(x,.23,z,.3,.04,.26); box(x,.37,z-.08,.24,.2,.035,glow); }
    box(0,.55,-.65,1.8,.7,.08,glow);
  } else if (type === 'inventory') {
    box(0,.16,0,2,.15,.6);
    for(let i=0;i<3;i++) { const crate=box(i*.6-.6,.42,0,.38,.38,.38,glow); animated.push(t=>crate.position.x=((t*.3+i*.6)%1.8)-.9); }
  } else if (type === 'cloud') {
    for(let i=0;i<3;i++) { box((i-1)*.6,.5,0,.42,1,.42); for(let j=0;j<4;j++)box((i-1)*.6,.2+j*.2,.22,.3,.035,.025,glow); }
    const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.3,1),glow);orb.position.y=1.4;root.add(orb);animated.push(t=>orb.rotation.y=t*.5);
  } else {
    const points=[];
    for(let i=0;i<7;i++) { const a=i*Math.PI*2/6, p=new THREE.Vector3(i===6?0:Math.cos(a)*.9,i===6?.75:.45+Math.sin(a)*.3,i===6?0:Math.sin(a)*.45); points.push(p);const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(i===6?.25:.13,1),glow);orb.position.copy(p);root.add(orb); }
    const lines=[];for(let i=0;i<6;i++)lines.push(points[i],points[6]);
    root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines),new THREE.LineBasicMaterial({color})));
    animated.push(t=>root.rotation.y=Math.sin(t*.35)*.15);
  }
  root.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  root.userData.update=t=>animated.forEach(fn=>fn(t));
  return root;
}

export function createExperienceGallery() {
  const group = new THREE.Group(), stations = [], animations=[];
  const metal = new THREE.MeshStandardMaterial({color:'#152131',roughness:.4,metalness:.65});
  for (const entry of EXHIBIT_LAYOUT) {
    const {experience:e,x,z,rotation}=entry, station=new THREE.Group();
    station.name=`exhibit:${e.id}`;station.position.set(x,0,z);station.rotation.y=rotation;
    const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(1.65,1.8,.24,32),metal);pedestal.position.y=.08;pedestal.receiveShadow=true;station.add(pedestal);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(3.9,2.95,.16),metal);frame.position.set(0,3,-.45);station.add(frame);
    const screen=new THREE.Mesh(new THREE.PlaneGeometry(3.72,2.79),new THREE.MeshBasicMaterial({map:displayTexture(e),toneMapped:false}));screen.position.set(0,3,-.36);station.add(screen);
    for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,2,.12),metal);leg.position.set(side*1.6,1,-.45);station.add(leg);}
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.68,.035,6,48),new THREE.MeshBasicMaterial({color:e.color,toneMapped:false}));ring.rotation.x=Math.PI/2;ring.position.y=.22;station.add(ring);
    const object=sculpture(e.type,e.color);object.position.set(0,.24,.35);station.add(object);animations.push(object.userData.update);
    group.add(station);stations.push({id:`experience-${e.id}`,company:e.company,station});
  }
  const ring=new THREE.Mesh(new THREE.TorusGeometry(4.3,.035,6,96),new THREE.MeshBasicMaterial({color:'#8ccbd7'}));ring.rotation.x=Math.PI/2;ring.position.y=.06;group.add(ring);
  group.userData.update=t=>animations.forEach(fn=>fn(t));
  return {group,stations,beaconLocal:new THREE.Vector3(0,5,0)};
}
