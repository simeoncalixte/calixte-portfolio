import * as THREE from 'three';
import { CONTENT } from './content.js';
import { PROFILE } from '../experience.js';
import { ISLANDS, SPAWN, island, radiusAt, surfaceHeight } from '../world/layout.js';

const $ = (id) => document.getElementById(id);
const NAV_KEYS = { 1: 'about', 2: 'projects', 3: 'skills', 4: 'contact', 5: 'interest' };

/** Pointer lock can reject (iframes, embedded previews) — never let that surface as an error. */
function lockPointer(el) {
  try { const p = el.requestPointerLock?.(); p?.catch?.(() => {}); } catch { /* unsupported */ }
}

export function createHUD({ camera, walk, bridges }) {
  let ctx = null; // {player, follow, landmarks}
  let started = false;
  let panelOpen = null;
  let near = null;
  let lastGhostEvent=null;
  const labels = [];
  const v = new THREE.Vector3();
  const skyScript = $('sky-script');
  const SKY_ANCHOR = new THREE.Vector3(120, 150, -800);
  const keys = new Set();

  const hero = $('hero'), panel = $('panel'), panelBody = $('panel-body'), help = $('help');
  const prompt = $('prompt'), promptText = $('prompt-text'), toast = $('toast');
  const mini = $('minimap').getContext('2d');
  const arrow = document.querySelector('.compass .arrow');

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function interact() {
    if (!ctx || !near || panelOpen || window.__editorActive || near.available?.() === false) return;
    const p = ctx.player.position;
    if (Math.hypot(p.x - near.position.x, p.z - near.position.z) >= near.radius || Math.abs(p.y - near.position.y) >= 4) return;
    if (near.activate) {
      const message = near.activate();
      ctx.player.playOnce('interact');
      if (message) showToast(message);
    } else openPanel(near.id);
  }

  function start() {
    if (started) return;
    started = true;
    document.body.classList.add('started');
    hero.classList.add('hidden');
    const c = $('scene');
    if (!matchMedia('(pointer: coarse)').matches) lockPointer(c);
    showToast('WASD move · Mouse look · SHIFT run · SPACE jump');
  }

  function setActiveNav(id) {
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === id));
  }

  function openPanel(id) {
    if (!CONTENT[id]) return;
    panelOpen = id;
    keys.clear();
    setInput();
    panel.classList.toggle('experience-panel', id === 'projects' || id.startsWith('experience-'));
    panelBody.innerHTML = CONTENT[id];
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    setActiveNav(id.startsWith('experience-') ? 'projects' : id.startsWith('skills-') ? 'skills' : id.startsWith('interest-') ? 'interest' : id);
    document.exitPointerLock?.();
    ctx?.player.playOnce(id === 'contact' ? 'wave' : 'interact');
    const form = document.getElementById('contact-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = new FormData(form);
      const body = encodeURIComponent(`${d.get('message')}\n\n— ${d.get('name')} (${d.get('email')})`);
      window.location.href = `mailto:${PROFILE.email}?subject=${encodeURIComponent('Hello from your portfolio')}&body=${body}`;
    });
  }
  function closePanel() {
    panelOpen = null;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    setActiveNav('home');
  }

  /** Fade out, move the player next to a landmark, fade in. */
  async function travel(id) {
    if (!ctx) return;
    start();
    closePanel();
    const grade = ctx.post?.grade;
    const fade = (to) => new Promise((res) => {
      if (!grade) return res();
      const from = grade.uniforms.uFade.value, t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 350);
        grade.uniforms.uFade.value = from + (to - from) * k;
        k < 1 ? requestAnimationFrame(step) : res();
      };
      step();
    });
    await fade(1);
    if (id === 'home') {
      const p = SPAWN.clone();
      p.y = surfaceHeight(island('main'), p.x, p.z);
      ctx.player.teleport(p, Math.PI);
    } else {
      const isl = island(id);
      const c = new THREE.Vector3(isl.center[0], 0, isl.center[2]);
      // approach from the side facing the main island
      const toMain = new THREE.Vector3(-c.x, 0, -c.z).normalize();
      const ang = Math.atan2(toMain.z, toMain.x);
      let p = null;
      for (let f = 0.62; f > 0.3 && !p; f -= 0.06) {
        for (const da of [0, 0.3, -0.3, 0.6, -0.6]) {
          const r = radiusAt(isl, ang + da) * f;
          const x = c.x + Math.cos(ang + da) * r, z = c.z + Math.sin(ang + da) * r;
          if (walk.groundAt(x, z, isl.center[1] + 5, 10) && !walk.blocked(x, z, 0.5)) { p = new THREE.Vector3(x, surfaceHeight(isl, x, z), z); break; }
        }
      }
      if (p) {
        const heading = Math.atan2(c.x - p.x, c.z - p.z);
        ctx.player.teleport(p, heading);
        ctx.follow.yaw = heading + Math.PI;
      }
    }
    ctx.follow.resumeFollow();
    ctx.follow.yaw = ctx.player.heading + Math.PI;
    ctx.follow.snap(ctx.player.position);
    await fade(0);
    setActiveNav(id);
  }

  // ---------------------------------------------------------------- input
  const setInput = () => {
    if (!ctx) return;
    const i = ctx.player.input;
    i.f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    i.r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    ctx.follow.input.rotate = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    ctx.follow.input.tilt = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
    i.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  };
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (window.__editorActive && !['Escape'].includes(e.code)) return;
    keys.add(e.code);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      if (!started && ctx) start();
      e.preventDefault();
    }
    if (e.code === 'Space') { e.preventDefault(); if (ctx && !e.repeat) ctx.player.input.jump = true; if (!started) start(); }
    if (e.code === 'KeyH') help.classList.toggle('open');
    if (e.code === 'KeyC' && ctx) { ctx.follow.resumeFollow(ctx.player.heading); showToast('Camera centered behind player'); }
    if (e.code === 'Escape') { help.classList.remove('open'); closePanel(); }
    if (e.code === 'KeyE' && !e.repeat) interact();
    if (NAV_KEYS[e.key]) travel(NAV_KEYS[e.key]);
    setInput();
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); setInput(); });
  window.addEventListener('blur', () => { keys.clear(); setInput(); });

  // ---------------------------------------------------------------- touch
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch) {
    document.body.classList.add('touch');
    const stick = document.createElement('div');
    stick.className = 'joystick';
    stick.innerHTML = '<i></i>';
    document.body.appendChild(stick);
    const knob = stick.firstChild;
    let jid = null, ox = 0, oy = 0;
    $('scene').addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || e.clientX >= innerWidth * 0.45 || jid !== null) return;
      jid = e.pointerId; ox = e.clientX; oy = e.clientY;
      stick.style.left = `${ox - 60}px`; stick.style.top = `${oy - 60}px`;
      stick.classList.add('on');
      start();
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== jid || !ctx) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const len = Math.hypot(dx, dy), max = 55;
      if (len > max) { dx *= max / len; dy *= max / len; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      ctx.player.input.r = dx / max;
      ctx.player.input.f = -dy / max;
      ctx.player.input.run = len > max * 0.95;
    });
    const end = (e) => {
      if (e.pointerId !== jid || !ctx) return;
      jid = null; stick.classList.remove('on'); knob.style.transform = '';
      ctx.player.input.f = ctx.player.input.r = 0; ctx.player.input.run = false;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    const btns = document.createElement('div');
    btns.className = 'touch-btns';
    btns.innerHTML = '<button data-a="jump">JUMP</button><button data-a="use">E</button>';
    document.body.appendChild(btns);
    btns.addEventListener('pointerdown', (e) => {
      const a = e.target.dataset.a;
      if (a === 'jump' && ctx) ctx.player.input.jump = true;
      if (a === 'use') interact();
      e.stopPropagation();
    });
  }

  $('start-btn').addEventListener('click', start);
  $('help-btn').addEventListener('click', () => help.classList.toggle('open'));
  help.addEventListener('click', () => help.classList.remove('open'));
  $('panel-close').addEventListener('click', closePanel);
  panelBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-experience]');
    if (button) { openPanel(button.dataset.experience); panel.scrollTop = 0; }
  });
  document.querySelectorAll('[data-nav]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    travel(a.dataset.nav).then(() => { if (a.dataset.nav !== 'home') openPanel(a.dataset.nav); });
  }));
  $('scene').addEventListener('click', () => {
    if (started && !panelOpen && !window.__editorActive && !matchMedia('(pointer: coarse)').matches) lockPointer($('scene'));
  });

  // ---------------------------------------------------------------- minimap
  const bounds = { minX: -60, maxX: 90, minZ: -135, maxZ: 25 };
  function drawMinimap(player, heading) {
    const W = 180, H = 180;
    mini.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, scale = 0.55;
    mini.save();
    mini.translate(cx, cy);
    mini.fillStyle = 'rgba(14,40,52,.55)';
    mini.fillRect(-W, -H, W * 2, H * 2);
    // centre map on the player
    const px = player.position.x, pz = player.position.z;
    const tx = (x) => (x - px) * scale, tz = (z) => (z - pz) * scale;
    mini.strokeStyle = 'rgba(255,220,170,.55)';
    mini.lineWidth = 1.5;
    mini.setLineDash([3, 3]);
    for (const b of bridges) { mini.beginPath(); mini.moveTo(tx(b.pa.x), tz(b.pa.z)); mini.lineTo(tx(b.pb.x), tz(b.pb.z)); mini.stroke(); }
    mini.setLineDash([]);
    for (const isl of ISLANDS) {
      mini.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2, r = radiusAt(isl, a);
        const x = tx(isl.center[0] + Math.cos(a) * r), y = tz(isl.center[2] + Math.sin(a) * r);
        i ? mini.lineTo(x, y) : mini.moveTo(x, y);
      }
      mini.fillStyle = isl.id === 'main' ? 'rgba(90,120,70,.75)' : 'rgba(70,100,70,.65)';
      mini.fill();
      if (isl.label) {
        mini.fillStyle = '#4fd8f0';
        mini.beginPath(); mini.arc(tx(isl.center[0]), tz(isl.center[2]), 2.5, 0, Math.PI * 2); mini.fill();
      }
    }
    mini.restore();
    arrow.style.transform = `rotate(${-heading + Math.PI}rad)`;
  }

  // ---------------------------------------------------------------- per frame
  function update(dt, t) {
    const ghostEvent=ctx?.player.ghostEvent;
    if(ghostEvent&&ghostEvent!==lastGhostEvent){showToast(ghostEvent.message);lastGhostEvent=ghostEvent;}
    if (!ctx) return;
    const { player, landmarks } = ctx;
    // beacon labels
    const w = window.innerWidth, h = window.innerHeight;
    for (const L of labels) {
      v.copy(L.anchor).project(camera);
      const behind = v.z > 1;
      const x = (v.x * 0.5 + 0.5) * w, y = Math.max((-v.y * 0.5 + 0.5) * h, 120);
      const flip = x > w - 190;
      L.el.classList.toggle('flip', flip);
      const b = L.base.clone().project(camera);
      const by = (-b.y * 0.5 + 0.5) * h;
      const dist = camera.position.distanceTo(L.anchor);
      L.el.style.opacity = behind ? 0 : Math.min(1, (dist - 6) / 10);
      L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${flip ? '-100%' : '0'},-100%)`;
      L.el.style.setProperty('--stem', `${Math.max(0, by - y - 8).toFixed(0)}px`);
    }
    // sky lettering
    v.copy(SKY_ANCHOR).project(camera);
    skyScript.style.opacity = v.z > 1 || Math.abs(v.x) > 1.3 ? 0 : 1;
    skyScript.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px)`;
    // nearest interactable
    let best = null, bd = Infinity;
    for (const it of landmarks.interactables) {
      if (it.available?.() === false) continue;
      const d = Math.hypot(player.position.x - it.position.x, player.position.z - it.position.z);
      if (d < it.radius && d < bd && Math.abs(player.position.y - it.position.y) < 4) { best = it; bd = d; }
    }
    if (best !== near) {
      near = best;
      prompt.classList.toggle('show', !!near);
      labels.forEach((L) => L.el.classList.toggle('near', near && L.id === near.id));
      if (near) promptText.textContent = near.label || `Open ${near.id.toUpperCase()}`;
    }
    if (Math.floor(t * 10) % 2 === 0) drawMinimap(player, player.heading);
    if (!started && (player.speed > 0.5)) start();
  }

  return {
    progress(p) { $('loader-fill').style.width = `${Math.round(p * 100)}%`; },
    init(c) {
      ctx = c;
      ctx.post = window.__app?.post;
      for (const b of c.landmarks.beacons) {
        const el = document.createElement('div');
        el.className = 'beacon-label';
        el.innerHTML = `<div class="num">${b.label.num}</div><div class="title">${b.label.title}</div><div class="sub">${b.label.sub}</div>`;
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => travel(b.id).then(() => openPanel(b.id)));
        $('labels').appendChild(el);
        labels.push({ ...b, el });
      }
    },
    ready() {
      $('loader-fill').style.width = '100%';
      $('loader-text').textContent = 'Ready';
      setTimeout(() => $('loader').classList.add('done'), 350);
    },
    error(e) { $('loader-text').textContent = 'Failed to load: ' + e.message; },
    update,
    travel,
    openPanel,
  };
}
