import * as THREE from 'three';
import { bridgePoint } from './layout.js';
import { PAST_MESSAGES } from './pastMessages.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { normalizeModel } from '../core/assets.js';
import { createGhostFlight } from './ghostFlight.js';

export const GHOST_APPEAR_DISTANCE = 85;

export function ghostPresence(player, position, bridge) {
  if (!player || !player.enabled) return 0;
  if (Math.abs(player.position.y - position.y) > 12) return 0;
  const dx = player.position.x - position.x, dz = player.position.z - position.z;
  const distance = Math.hypot(dx, dz);
  return 1 - THREE.MathUtils.smoothstep(distance, 55, GHOST_APPEAR_DISTANCE);
}

function signTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#202831'; ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = '#8998a5'; ctx.lineWidth = 5; ctx.strokeRect(24, 24, 976, 464);
  ctx.fillStyle = '#e1e8ed'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // Fit wrapped text to the board; explicit newlines are preserved.
  let lines = [], size = 60;
  for (; size >= 16; size -= 2) {
    ctx.font = `500 ${size}px sans-serif`;
    lines = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > 880) { lines.push(line); line = word; }
        else line = next;
      }
      lines.push(line);
    }
    if (lines.length * size * 1.3 <= 380 && lines.every((line) => ctx.measureText(line).width <= 880)) break;
  }
  size = Math.max(16, size);
  lines.forEach((line, i) => ctx.fillText(line, 512, 256 + (i - (lines.length - 1) / 2) * size * 1.3, 880));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Ghosts appear above the bridge ahead, descend, then commit to dodgeable swoops. */
export function createPastGhosts(bridge, messages = PAST_MESSAGES, asset = null) {
  const group = new THREE.Group(); group.name = 'ghosts:past';
  const side = new THREE.Vector3(-bridge.dir.z, 0, bridge.dir.x);
  const cloth = new THREE.MeshStandardMaterial({ color: '#c4d1dc', emissive: '#7e91a4', emissiveIntensity: 0.22, transparent: true, opacity: 0.72, depthWrite: false, roughness: 1, side: THREE.DoubleSide });
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#141d29' });
  const boardMat = new THREE.MeshStandardMaterial({ color: '#303740', roughness: 1 });
  const profile = [[0, 2.75], [0.25, 2.7], [0.43, 2.48], [0.48, 2.15], [0.55, 1.6], [0.68, 0.9], [0.82, 0.25]].map(([x, y]) => new THREE.Vector2(x, y));
  const bodyGeo = new THREE.LatheGeometry(profile, 32);
  const vertices = bodyGeo.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    if (vertices.getY(i) < 0.3) vertices.setY(i, 0.25 + Math.cos(Math.atan2(vertices.getZ(i), vertices.getX(i)) * 7) * 0.12);
  }
  bodyGeo.computeVertexNormals();
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const boardGeo = new THREE.BoxGeometry(2.45, 1.25, 0.1);
  const faceGeo = new THREE.PlaneGeometry(2.35, 1.17);
  const floats = [];
  messages.forEach((text, i) => {
    const anchor = new THREE.Group(); anchor.name = `ghost:past:${i + 1}`;
    const t = 0.1 + (messages.length === 1 ? 0.4 : i / (messages.length - 1) * 0.8);
    const direction = i % 2 ? -1 : 1;
    bridgePoint(bridge, t, anchor.position).addScaledVector(side, direction * (bridge.halfWidth + 2.2));
    anchor.rotation.y = Math.atan2(-side.x * direction, -side.z * direction);
    const figure = new THREE.Group(); anchor.add(figure);
    let mixer, idle, flying;
    if(asset){
      const rig=clone(asset.scene);
      mixer=new THREE.AnimationMixer(rig);
      idle=mixer.clipAction(asset.animations.find(a=>a.name.endsWith('|Flying_Idle'))).play();
      flying=mixer.clipAction(asset.animations.find(a=>a.name.endsWith('|Fast_Flying')));
      mixer.update(0);
      rig.updateMatrixWorld(true);
      rig.traverse(o=>{if(o.isMesh){o.frustumCulled=false;if(o.isSkinnedMesh)o.computeBoundingBox();
        o.material=o.material.clone();
        o.material.fog=false; // The dense bridge fog must not hide an incoming hazard.
        if(o.material.name==='Eye_White'){o.material.color.set('#ff493f');o.material.emissive.set('#ff1608');o.material.emissiveIntensity=3;}
        else if(o.material.name==='Ghost_Main'){o.material.color.set('#8294ba');o.material.emissive.set('#8294ba');o.material.emissiveIntensity=.8;}
      }});
      // Animation tracks write the imported root's scale. Normalize an outer
      // group so playback cannot shrink the ghost back to its source units.
      const sizing=new THREE.Group();sizing.add(rig);
      figure.add(normalizeModel(sizing,{height:3.6}));
    }else{
    figure.add(new THREE.Mesh(bodyGeo, cloth));
    for (const x of [-0.17, 0.17]) {
      const eye = new THREE.Mesh(sphere, eyeMat);
      eye.scale.set(0.08, 0.13, 0.04); eye.position.set(x, 2.35, 0.43); figure.add(eye);
    }
    }
    if(text.trim()){
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 1.3, 0.65); figure.add(board);
    const texture = signTexture(text);
    const ink = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 0.4, roughness: 1 });
    // Separate faces keep the writing readable, never mirrored, from either side.
    for (const facing of [1, -1]) {
      const face = new THREE.Mesh(faceGeo, ink);
      face.position.set(0, 1.3, 0.65 + facing * 0.056);
      face.rotation.y = facing === 1 ? 0 : Math.PI; figure.add(face);
    }
    }
    if(!asset)for (const x of [-1.12, 1.12]) {
      const sleeve = new THREE.Mesh(sphere, cloth);
      sleeve.position.set(x * 0.7, 1.65, 0.3); sleeve.scale.set(0.38, 0.25, 0.5); figure.add(sleeve);
      const hand = new THREE.Mesh(sphere, cloth);
      hand.position.set(x, 1.43, 0.76); hand.scale.set(0.16, 0.22, 0.14); figure.add(hand);
    }
    // Every part, including the sign and eyes, fades with its own ghost.
    const materials = new Map();
    figure.traverse((mesh) => {
      if (!mesh.isMesh) return;
      if (!materials.has(mesh.material)) {
        const material = mesh.material.clone();
        const opacity = material.opacity;
        material.transparent = true; material.depthWrite = false; material.opacity = 0;
        materials.set(mesh.material, { material, opacity });
      }
      mesh.material = materials.get(mesh.material).material;
    });
    anchor.visible = false;
    floats.push({ figure, anchor, materials: [...materials.values()], opacity: 0, mixer, idle, flying }); group.add(anchor);
  });
  const flight=createGhostFlight(bridge,floats.map(s=>s.anchor.position));
  const marker=new THREE.Mesh(new THREE.RingGeometry(.55,.72,40),new THREE.MeshBasicMaterial({color:'#ff4035',side:THREE.DoubleSide,transparent:true,depthWrite:false}));
  marker.rotation.x=-Math.PI/2;marker.visible=false;group.add(marker);
  group.userData.flight=flight;
  group.userData.update = (time, _cameraPosition, player, dt = 1 / 60) => {
    flight.update(dt,player);marker.visible=false;
    floats.forEach((state, i) => {
    const { figure, anchor, materials } = state;
    const motion=flight.states[i], attacking=motion.phase!=='idle';
    anchor.position.copy(motion.position);
    if(attacking){anchor.lookAt(motion.phase==='warning'?motion.target:motion.end);anchor.rotation.x=0;anchor.rotation.z=0;}
    if(motion.phase==='warning'){marker.visible=true;marker.position.copy(motion.target);marker.position.y+=.08;marker.material.opacity=.55+.4*Math.sin(time*16)**2;}
    const charging=motion.phase==='swoop';
    if(state.mixer){
      if(charging!==state.charging){const next=charging?state.flying:state.idle,old=charging?state.idle:state.flying;old.fadeOut(.15);next.reset().fadeIn(.15).play();state.charging=charging;}
      if(player?.enabled)state.mixer.update(dt);
    }
    const target = attacking?1:0;
    state.opacity = THREE.MathUtils.lerp(state.opacity, target, 1 - Math.exp(-dt * 10));
    anchor.visible = attacking && state.opacity > 0.01;
    for (const entry of materials) entry.material.opacity = entry.opacity * state.opacity;
    figure.position.y = 0.35 + Math.sin(time * 0.9 + i * 1.7) * 0.15;
    figure.rotation.z = Math.sin(time * 0.65 + i) * 0.025;
    });
  };
  return group;
}
