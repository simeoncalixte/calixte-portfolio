import * as THREE from 'three';
import { createObservatoryScene } from './observatoryScene.js';

/** The complete observatory lives in the world, under the player's normal camera. */
export function createInterestObservatory() {
  const group = new THREE.Group();
  const observatory = createObservatoryScene();
  observatory.scale.setScalar(0.62);
  observatory.position.y = 1.8;
  group.add(observatory);
  group.userData.update = observatory.userData.update;
  return { group, beaconLocal: new THREE.Vector3(0, 16, 0) };
}
