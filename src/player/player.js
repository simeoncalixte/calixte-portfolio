import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const GRAVITY = -24;
const JUMP_V = 7.2;
export const WALK = 3.4, RUN = 7.6;
export const TURN_SPEED = 2.4;

/**
 * Third-person adventurer. The Quaternius rig ships Idle/Walk/Run; the jump is
 * procedural (ballistic arc + a held mid-stride pose + squash on landing).
 */
export class Player {
  constructor(gltf, walk) {
    this.walk = walk;
    this.root = new THREE.Group();
    this.root.name = 'player';
    const model = SkeletonUtils.clone(gltf.scene);
    // Skinned bounds are unreliable on this rig (cm armature scaled x100), so
    // measure with the head bone instead: target head-bone height ~1.45m.
    model.updateMatrixWorld(true);
    let headY = 1.55;
    model.traverse((o) => { if (o.isBone && o.name === 'Head') headY = o.getWorldPosition(new THREE.Vector3()).y; });
    model.scale.setScalar(1.45 / headY);
    this.model = model;
    this.root.add(model);
    this.styleModel(model);

    this.mixer = new THREE.AnimationMixer(model);
    const clip = (n) => gltf.animations.find((a) => a.name.endsWith('|' + n) || a.name === n);
    this.actions = {
      idle: this.mixer.clipAction(clip('Idle')),
      walk: this.mixer.clipAction(clip('Walk')),
      run: this.mixer.clipAction(clip('Run')),
      jump: this.mixer.clipAction(clip('Run').clone()),
      wave: this.mixer.clipAction(clip('Wave')),
      interact: this.mixer.clipAction(clip('Interact')),
    };
    this.actions.jump.timeScale = 0;
    this.actions.wave.setLoop(THREE.LoopOnce, 1);
    this.actions.wave.clampWhenFinished = false;
    this.actions.interact.setLoop(THREE.LoopOnce, 1);
    for (const a of Object.values(this.actions)) a.enabled = true;
    this.current = this.actions.idle;
    this.current.play();

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

    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.oneShot) { this.oneShot = null; this.fadeTo(this.actions.idle, 0.3); }
    });
  }

  styleModel(model) {
    const palette = {
      Green: '#23272e', LightGreen: '#30353d', Brown: '#1b1d22', Brown2: '#2b2420', Grey: '#3a3f47', Black: '#101114', Gold: '#8a7a5a',
    };
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map((m) => {
        const c = m.clone();
        if (palette[m.name]) c.color.set(palette[m.name]);
        c.roughness = 0.75;
        c.metalness = 0;
        c.envMapIntensity = 0.8;
        return c;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    // glowing cyan straps on the backpack (attached to the chest bone so they animate)
    model.updateMatrixWorld(true);
    let chest = null, pack = null;
    model.traverse((o) => { if (o.isBone && /^Chest$|Torso/.test(o.name) && !chest) chest = o; if (o.name === 'Backpack') pack = o; });
    if (chest && pack) {
      const box = new THREE.Box3();
      pack.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        o.computeBoundingBox();
        box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
      });
      const size = box.getSize(new THREE.Vector3());
      const c = box.getCenter(new THREE.Vector3());
      const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#4fd8f0').multiplyScalar(4), toneMapped: false });
      const strips = new THREE.Group();
      for (const [dx, dy, w, hgt] of [[0, 0.3, 0.5, 0.018], [-0.4, 0.0, 0.018, 0.55], [0.4, 0.0, 0.018, 0.55]]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(size.x * w, size.y * hgt, 0.02), glow);
        s.position.set(c.x + dx * size.x, c.y + dy * size.y, box.min.z - 0.005);
        strips.add(s);
      }
      // convert world -> chest-local, keeping the visual size
      chest.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(chest.matrixWorld).invert();
      strips.children.forEach((s) => { s.applyMatrix4(inv); });
      chest.add(...strips.children);
      this.packGlow = glow;
    }
  }

  fadeTo(action, dur = 0.25) {
    if (this.current === action) return;
    action.reset().setEffectiveWeight(1).fadeIn(dur).play();
    this.current.fadeOut(dur);
    this.current = action;
  }

  playOnce(name) {
    const a = this.actions[name];
    if (!a) return;
    this.oneShot = a;
    this.fadeTo(a, 0.2);
  }

  /** W/S move in the player's frame; A/D turn independently of the camera. */
  update(dt) {
    const inp = this.input;
    const f = this.enabled ? THREE.MathUtils.clamp(inp.f,-1,1) : 0;
    const r = this.enabled ? THREE.MathUtils.clamp(inp.r,-1,1) : 0;
    this.heading -= r * TURN_SPEED * dt;
    this.heading = Math.atan2(Math.sin(this.heading),Math.cos(this.heading));
    const moving = Math.abs(f) > .01;
    if(this.enabled)this.ghostSlowdown=Math.max(0,(this.ghostSlowdown||0)-dt);
    const target = moving ? f*(inp.run ? RUN : WALK)*(this.ghostSlowdown>0?.45:1) : 0;
    // Stop on release and brake before reversing, without drifting while turning.
    if(!moving || this.speed*target<0)this.speed=0;
    this.speed += (target - this.speed) * Math.min(1, dt * (moving ? 8 : 10));

    if (moving) {
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
      else this.position.y += (groundY - this.position.y) * Math.min(1, dt * 18);
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
      const direction=this.speed<0?-1:1;
      this.actions.walk.timeScale = direction*THREE.MathUtils.clamp(v / WALK, 0.6, 1.4);
      this.actions.run.timeScale = direction*THREE.MathUtils.clamp(v / RUN, 0.7, 1.2) * 1.05;
    }
    this.mixer.update(dt);
    if (this.packGlow) this.packGlow.color.setRGB(0.31, 0.85, 0.94).multiplyScalar(2.0 + Math.sin(performance.now() * 0.003) * 0.4);
  }

  teleport(p, heading) {
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

  snap(playerPos) {
    this.smoothTarget.copy(playerPos).add(new THREE.Vector3(0, 1.55, 0));
    this.update(1, playerPos, true);
  }

  update(dt, playerPos, instant = false, heading, turning = 0) {
    if (this.enabled && !window.__editorActive) {
      this.rotate(this.input.rotate * 420 * dt, this.input.tilt * 340 * dt);
      // Steering makes the player the reference again, even after free look.
      // Preserve the chosen pitch and zoom; only bring yaw behind the player.
      const cameraInput = this.input.rotate !== 0 || this.input.tilt !== 0;
      if (Math.abs(turning) > .01 && !cameraInput) this.manual = false;
      if (!this.manual && heading !== undefined) {
        const delta = heading + Math.PI - this.yaw;
        this.yaw += Math.atan2(Math.sin(delta), Math.cos(delta)) * (instant ? 1 : 1 - Math.exp(-dt * 10));
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
