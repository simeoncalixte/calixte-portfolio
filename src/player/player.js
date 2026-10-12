import * as THREE from 'three';
import { createCharacterRig } from './characterAppearance.js';
import { PettingPose } from './petting.js';

const GRAVITY = -24;
const JUMP_V = 7.2;
export const WALK = 3.4, RUN = 7.6;
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _move = new THREE.Vector3();

/**
 * Third-person adventurer. The Quaternius rig ships Idle/Walk/Run; the jump is
 * procedural (ballistic arc + a held mid-stride pose + squash on landing).
 */
export class Player {
  constructor(gltf, walk, femaleAsset=null) {
    this.walk = walk;
    this.root = new THREE.Group();
    this.root.name = 'player';
    this.characters={male:createCharacterRig(gltf)};
    if(femaleAsset)this.characters.female=createCharacterRig(femaleAsset);
    for(const rig of Object.values(this.characters))rig.mixer.addEventListener('finished',e=>{
      if(e.action===this.oneShot){this.oneShot=null;this.fadeTo(this.actions.idle,.3);}
    });
    this.setGender('male');

    this.position = this.root.position;
    this.velY = 0;
    this.grounded = true;
    this.speed = 0;
    this.effSpeed = 0;
    this.heading = Math.PI; // facing -Z
    this.squash = 0;
    this.input = { f: 0, r: 0, run: false, jump: false };
    this.enabled = true;
    this.oneShot = null;
  }

  fadeTo(action, dur = 0.25) {
    if (this.current === action) return;
    action.reset().setEffectiveWeight(1).fadeIn(dur).play();
    this.current.fadeOut(dur);
    this.current = action;
  }

  playOnce(name) {
    if(this.petting || this.meditation)return;
    const a = this.actions[name];
    if (!a) return;
    this.oneShot = a;
    this.fadeTo(a, 0.2);
  }

  setGender(gender) {
    const rig=Object.hasOwn(this.characters,gender)?this.characters[gender]:null;
    if(!rig)return false;
    if(this.gender===gender)return true;
    for(const state of [this.petting,this.meditation])state?.pose.restore();
    this.petting=null;this.meditation=null;this.oneShot=null;
    if(this.model){this.root.remove(this.model);this.mixer.stopAllAction();}
    Object.assign(this,rig);
    this.root.add(this.model);
    this.current=this.actions.idle;this.current.reset().play();this.mixer.update(0);
    this.gender=gender;return true;
  }

  petDog(dog) {
    if(!this.grounded || this.petting || this.meditation)return false;
    const direction=this.position.clone().sub(dog.position).setY(0).normalize();
    const destination=dog.position.clone().addScaledVector(direction,1.15);
    if(this.walk.blocked(destination.x,destination.z,.35))return false;
    this.petting={dog,destination,time:0,approach:0,pose:new PettingPose(this.model)};
    this.oneShot=null;this.speed=0;this.effSpeed=0;
    return true;
  }

  meditate(destination,heading) {
    if(!this.enabled || !this.grounded || this.petting || this.meditation || this.position.distanceTo(destination)>1.7)return false;
    if(this.walk.blocked(destination.x,destination.z,.35))return false;
    this.meditation={destination:destination.clone(),heading,time:0,approach:0,pose:new PettingPose(this.model)};
    this.oneShot=null;this.speed=0;this.effSpeed=0;
    return true;
  }

  updateMeditation(dt) {
    const state=this.meditation;state.pose.restore();
    if(this.enabled && (this.input.f || this.input.r || this.input.jump)){
      this.meditation=null;this.input.jump=false;return;
    }
    if(!this.enabled)dt=0;
    const delta=state.destination.clone().sub(this.position);delta.y=0;
    if(delta.length()>.035){
      state.approach+=dt;
      const step=delta.clampLength(0,dt*1.5);
      this.position.copy(this.walk.move(this.position,step.x,step.z,this.position.y));
      this.fadeTo(this.actions.walk,.2);
      if(state.approach>2){this.meditation=null;return;}
    }else{
      state.time+=dt;this.fadeTo(this.actions.idle,.25);
    }
    this.heading=state.heading;this.root.rotation.y=this.heading;
    this.mixer.update(dt);
    state.pose.apply(THREE.MathUtils.smoothstep(state.time,0,.85),null,this.root,true);
  }

  updatePetting(dt) {
    const pet=this.petting;
    pet.pose.restore();
    if(!this.enabled)dt=0;
    const delta=pet.destination.clone().sub(this.position);delta.y=0;
    if(delta.length()>.04 && pet.time===0){
      pet.approach+=dt;
      const step=delta.clone().clampLength(0,dt*2);
      const next=this.walk.move(this.position,step.x,step.z,this.position.y).clone();
      this.position.copy(next);this.fadeTo(this.actions.walk,.15);
      if(pet.approach>2){this.petting=null;return;}
    }else{
      pet.time+=dt;this.fadeTo(this.actions.idle,.15);
    }
    this.heading=Math.atan2(pet.dog.position.x-this.position.x,pet.dog.position.z-this.position.z);
    this.root.rotation.y=this.heading;
    this.mixer.update(dt);
    const weight=THREE.MathUtils.smoothstep(pet.time,0,.6)*(1-THREE.MathUtils.smoothstep(pet.time,2.5,3.2));
    const target=pet.dog.userData.petTarget?.() ?? pet.dog.position.clone().add(new THREE.Vector3(0,.8,0));
    pet.pose.apply(weight,target,this.root);
    this.input.jump=false;
    if(pet.time>=3.2){pet.pose.restore();this.petting=null;}
  }

  /** @param cameraYaw yaw of the follow camera, so W moves away from it. */
  update(dt, cameraYaw) {
    if(this.meditation){this.updateMeditation(dt);return;}
    if(this.petting){this.updatePetting(dt);return;}
    const inp = this.input;
    let f = this.enabled ? inp.f : 0, r = this.enabled ? inp.r : 0;
    const len = Math.hypot(f, r);
    if (len > 1) { f /= len; r /= len; }

    _fwd.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    _right.set(-_fwd.z, 0, _fwd.x);
    _move.set(0, 0, 0).addScaledVector(_fwd, f).addScaledVector(_right, r);
    const moving = _move.lengthSq() > 0.01;
    if(this.enabled)this.ghostSlowdown=Math.max(0,(this.ghostSlowdown||0)-dt);
    const target = moving ? (inp.run ? RUN : WALK)*(this.ghostSlowdown>0?.45:1) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * (moving ? 8 : 10));

    if (moving) {
      const want = Math.atan2(_move.x, _move.z);
      let d = want - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * 12);
      if (this.oneShot) { this.oneShot = null; }
    }
    this.root.rotation.y = this.heading;

    // horizontal motion along the facing direction (smooth turning arcs)
    const step = this.speed * dt * (this.grounded ? 1 : 0.95);
    const dx = Math.sin(this.heading) * step, dz = Math.cos(this.heading) * step;
    const feetY = this.position.y;
    const res = this.walk.move(this.position, dx, dz, feetY);
    const moved = Math.hypot(res.x - this.position.x, res.z - this.position.z);
    this.position.x = res.x;
    this.position.z = res.z;
    const groundY = res.y;
    // animation follows the real ground speed (so pushing against an edge idles)
    this.effSpeed += ((dt > 0 ? moved / dt : 0) - this.effSpeed) * Math.min(1, dt * 10);

    // jump / gravity
    if (this.grounded && inp.jump && this.enabled) {
      this.velY = JUMP_V;
      this.grounded = false;
      this.fadeTo(this.actions.jump, 0.12);
      this.actions.jump.time = this.actions.jump.getClip().duration * 0.3;
    }
    inp.jump = false;
    if (!this.grounded) {
      this.velY += GRAVITY * dt;
      this.position.y += this.velY * dt;
      if (this.position.y <= groundY && this.velY < 0) {
        this.position.y = groundY;
        this.grounded = true;
        this.squash = Math.min(1, -this.velY / 10);
        this.velY = 0;
      }
    } else {
      // follow terrain smoothly; small drops snap, big ones fall
      if (groundY < this.position.y - 0.6) { this.grounded = false; this.velY = 0; }
      else this.position.y = groundY;
    }

    // landing squash & stretch
    this.squash *= Math.exp(-dt * 9);
    const air = this.grounded ? 0 : Math.min(1, Math.abs(this.velY) / 8) * 0.05;
    this.model.scale.setScalar(this.model.userData.s || (this.model.userData.s = this.model.scale.x));
    const s0 = this.model.userData.s;
    this.model.scale.set(s0 * (1 + this.squash * 0.12), s0 * (1 - this.squash * 0.16 + air), s0 * (1 + this.squash * 0.12));

    // animation state
    if (this.grounded && !this.oneShot) {
      const v = this.effSpeed;
      if (v > 5) this.fadeTo(this.actions.run, 0.2);
      else if (v > 0.5) this.fadeTo(this.actions.walk, 0.2);
      else this.fadeTo(this.actions.idle, 0.3);
      this.actions.walk.timeScale = THREE.MathUtils.clamp(v / WALK, 0.6, 1.4);
      this.actions.run.timeScale = THREE.MathUtils.clamp(v / RUN, 0.7, 1.2) * 1.05;
    }
    this.mixer.update(dt);
  }

  teleport(p, heading) {
    if(this.meditation){this.meditation.pose.restore();this.meditation=null;}
    if(this.petting){this.petting.pose.restore();this.petting=null;}
    this.ghostSlowdown=0;
    this.position.copy(p);
    this.heading = heading;
    this.velY = 0;
    this.grounded = true;
    this.speed = 0;
  }
}

/**
 * Spring-arm follow camera. Mouse drag / pointer-lock to orbit, wheel to zoom.
 * Keeps itself above the terrain beneath it.
 */
export class FollowCamera {
  constructor(camera, dom, walk) {
    this.camera = camera;
    this.walk = walk;
    this.yaw = 0; // camera looks along -Z when yaw = 0
    this.pitch = 0.12;
    this.dist = 6.2;
    this.targetDist = 6.2;
    this.target = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.shoulder = 0.9;
    this.enabled = true;
    this.dragging = false;
    this.manual = false;
    this.input = { rotate: 0, tilt: 0 };
    this.movementYaw = null;

    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled || window.__editorActive) return;
      if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45) return; // left side = joystick
      if (e.button === 0 || e.button === 2) { this.dragging = true; this.dragId = e.pointerId; }
    });
    window.addEventListener('pointerup', (e) => { if (e.pointerId === this.dragId) this.dragging = false; });
    window.addEventListener('pointercancel', (e) => { if (e.pointerId === this.dragId) this.dragging = false; });
    window.addEventListener('blur', () => { this.dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!this.enabled || window.__editorActive) return;
      if (document.pointerLockElement === dom || (this.dragging && e.pointerId === this.dragId)) this.rotate(e.movementX * (e.pointerType === 'touch' ? 1.6 : 1), e.movementY * (e.pointerType === 'touch' ? 1.6 : 1));
    });
    dom.addEventListener('wheel', (e) => { this.targetDist = THREE.MathUtils.clamp(this.targetDist + e.deltaY * 0.006, 2.5, 16); }, { passive: true });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  rotate(mx, my) {
    if (!mx && !my) return;
    this.manual = true;
    this.yaw -= mx * 0.0032;
    this.pitch = THREE.MathUtils.clamp(this.pitch + my * 0.0026, -0.35, 1.2);
  }

  resumeFollow() {
    this.manual = false;
    this.pitch = 0.22;
  }

  // Keep a held movement direction stable while the automatic camera turns.
  getMovementYaw(input) {
    if (!input.f && !input.r) this.movementYaw = null;
    else if (this.manual || this.movementYaw === null) this.movementYaw = this.yaw;
    return this.movementYaw ?? this.yaw;
  }

  snap(playerPos) {
    this.smoothTarget.copy(playerPos).add(new THREE.Vector3(0, 1.55, 0));
    this.update(1, playerPos, true);
  }

  update(dt, playerPos, instant = false, heading) {
    if (this.enabled && !window.__editorActive) {
      this.rotate(this.input.rotate * 420 * dt, this.input.tilt * 340 * dt);
      if (!this.manual && heading !== undefined) {
        const delta = heading + Math.PI - this.yaw;
        this.yaw += Math.atan2(Math.sin(delta), Math.cos(delta)) * (instant ? 1 : 1 - Math.exp(-dt * 5));
      }
    }
    this.target.copy(playerPos).y += 1.55;
    const k = instant ? 1 : 1 - Math.exp(-dt * 10);
    this.smoothTarget.lerp(this.target, k);
    this.dist += (this.targetDist - this.dist) * (instant ? 1 : 1 - Math.exp(-dt * 6));
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const off = new THREE.Vector3(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp).multiplyScalar(this.dist);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const pos = this.smoothTarget.clone().add(off).addScaledVector(right, this.shoulder);
    // keep above the ground / bridges under the camera
    const floors = this.walk.floors(pos.x, pos.z, []);
    for (const f of floors) if (pos.y < f.y + 0.6 && f.y < this.smoothTarget.y + 1) pos.y = f.y + 0.6;
    this.camera.position.copy(pos);
    this.camera.lookAt(this.smoothTarget.x + right.x * this.shoulder * 0.55, this.smoothTarget.y + 0.25, this.smoothTarget.z + right.z * this.shoulder * 0.55);
  }
}
