import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const material = (color, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness });
function part(parent, geometry, mat, position, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position); mesh.scale.set(...scale);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}

/** Original brick minifigure interpretation of Batman (no external model file). */
export function createBatman() {
  const root = new THREE.Group(); root.name = 'character:batman';
  const black = material('#12171f', 0.32), suit = material('#525d69', 0.4);
  const yellow = material('#e4b934', 0.35), skin = material('#d6ae78', 0.48), white = material('#edf6ff', 0.2);
  const box = (w, h, d) => new RoundedBoxGeometry(w, h, d, 2, 0.035);
  for (const x of [-0.24, 0.24]) {
    part(root, box(0.43, 0.66, 0.42), suit, [x, 0.44, 0]);
    part(root, box(0.44, 0.25, 0.57), black, [x, 0.125, 0.08]);
  }
  part(root, box(1.02, 0.17, 0.51), yellow, [0, 0.81, 0]);
  for (const x of [-0.37, -0.18, 0, 0.18, 0.37]) part(root, box(0.12, 0.14, 0.08), yellow, [x, 0.81, 0.3]);
  const torso = part(root, new THREE.CylinderGeometry(0.49, 0.61, 0.84, 4), suit, [0, 1.32, 0], [1, 1, 0.6]);
  torso.rotation.y = Math.PI / 4;
  const head = new THREE.Group(); head.position.y = 1.91; root.add(head);
  part(head, new THREE.CylinderGeometry(0.33, 0.33, 0.53, 32), skin, [0, 0, 0]);
  part(head, new THREE.CylinderGeometry(0.36, 0.36, 0.48, 32), black, [0, 0.13, -0.015]);
  part(head, box(0.25, 0.25, 0.15), black, [0, 0.01, 0.32]);
  for (const s of [-1, 1]) {
    part(head, new THREE.ConeGeometry(0.11, 0.43, 4), black, [s * 0.26, 0.54, 0]);
    const eye = part(head, box(0.19, 0.055, 0.03), white, [s * 0.19, 0.11, 0.307]);
    eye.rotation.z = s * 0.18;
  }
  part(head, box(0.17, 0.025, 0.02), black, [0, -0.18, 0.334]);
  // Yellow oval and geometric bat silhouette sit on the torso.
  part(root, new THREE.SphereGeometry(1, 24, 12), yellow, [0, 1.48, 0.295], [0.33, 0.16, 0.035]);
  const emblem = new THREE.Shape();
  const outline = [[-0.28,0.07],[-0.17,0.02],[-0.1,0.035],[-0.07,0.11],[-0.035,0.055],[0.035,0.055],[0.07,0.11],[0.1,0.035],[0.17,0.02],[0.28,0.07],[0.21,-0.065],[0.13,-0.025],[0.07,-0.09],[0,-0.12],[-0.07,-0.09],[-0.13,-0.025],[-0.21,-0.065]];
  outline.forEach(([x,y],i)=>i?emblem.lineTo(x,y):emblem.moveTo(x,y)); emblem.closePath();
  part(root, new THREE.ShapeGeometry(emblem), black, [0, 1.48, 0.334]);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.58, 1.65, 0); arm.rotation.z = s * 0.12; root.add(arm);
    part(arm, new THREE.CylinderGeometry(0.16, 0.14, 0.67, 16), suit, [0, -0.32, 0]);
    part(arm, new THREE.CylinderGeometry(0.17, 0.16, 0.25, 16), black, [0, -0.57, 0]);
    const hand = part(arm, new THREE.TorusGeometry(0.115, 0.055, 8, 16, Math.PI * 1.55), black, [0, -0.78, 0]);
    hand.rotation.z = -Math.PI / 4; arms.push(arm);
  }
  const capeShape = new THREE.Shape();
  capeShape.moveTo(-0.42, 0); capeShape.lineTo(0.42, 0); capeShape.lineTo(0.85,-1.5);
  for (let i=0;i<5;i++) capeShape.quadraticCurveTo(0.68-i*0.34,-1.28,0.51-i*0.34,-1.5);
  capeShape.closePath();
  const capeMat = black.clone(); capeMat.side = THREE.DoubleSide; capeMat.roughness = 0.9;
  const cape = part(root,new THREE.ShapeGeometry(capeShape),capeMat,[0,1.79,-0.31]); cape.rotation.x=0.12;
  root.userData.animate = (time, freed) => {
    head.rotation.y = Math.sin(time * 0.6) * 0.1;
    cape.rotation.x = 0.12 + Math.sin(time * 1.4) * 0.045;
    arms[1].rotation.z = freed ? -1.5 + Math.sin(time * 3) * 0.18 : 0.12;
  };
  return root;
}
