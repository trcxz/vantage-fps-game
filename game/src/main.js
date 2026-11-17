// main.js: entry point. Creates the renderer and scene, wires input, runs the fixed-step
// simulation (60 Hz, no rendering inside it) and renders once per animation frame.
import * as THREE from 'three';
import { G, note, bombProgress } from './state.js';
import { STEP, SHOP, WEAPONS, NADE_ORDER, TAG_RANGE } from './config.js';
import { clamp } from './util.js';
import { makeTextures } from './textures.js';
import { buildWorld } from './world.js';
import { buildHumanoid, setHeldGun, poseHumanoid, buildViewmodels } from './models.js';
import { hooks, fire, tickWeapon, curW, selectWeapon, startReload, spreadOf, eyeY } from './actors.js';
import { stepPlayer } from './movement.js';
import { stepGrenades, throwNade, nadeHooks, smokeBlocks } from './grenades.js';
import { stepBot } from './bots.js';
import { initMatch, stepRound, buyItem, roundHooks } from './round.js';
import { lineClear } from './map.js';
import * as snd from './audio.js';
import { buildHud, updateHud } from './hud.js';
import { initEffects, updateEffects, addTracer, addSpark, addBoom } from './effects.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
G.shot = params.get('shot') || '';
G.frozen = !!G.shot;

// ---- renderer, scene, camera ----
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.domElement.id = 'view';
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.05, 400);
camera.rotation.order = 'YXZ';
scene.add(camera);
const T = makeTextures();
buildWorld(scene, T, renderer);
initEffects(scene, T);
const vms = buildViewmodels(T, 0);
for (const k in vms) camera.add(vms[k].root);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---- match ----
snd.initAudio();
initMatch();
const p = G.player;
// Bots get a humanoid each; the player has none (first person).
for (const a of G.actors) {
  if (a.isPlayer) continue;
  a.model = buildHumanoid(a.team, a.name, T);
  scene.add(a.model.root);
}
buildHud(document.getElementById('hud'), (item) => {
  const err = buyItem(p, item);
  if (err) note(err); else { G.ui.note = ''; snd.sfxBuy(); }
});
if (G.shot) applyShot(G.shot);

// ---- input ----
const keys = {};
const KEYMAP = {
  KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ShiftLeft: 'shift', ShiftRight: 'shift', ControlLeft: 'ctrl', ControlRight: 'ctrl',
  Space: 'space', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyE: 'e',
};
let mouseDown = false, clicked = false;
addEventListener('keydown', (e) => {
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  const k = KEYMAP[e.code];
  if (k) keys[k] = true;
  if (e.code === 'Tab') G.ui.scores = true;
  if (e.code === 'KeyB') G.ui.buy = !G.ui.buy && (G.phase === 'freeze' || G.elapsed < 8);
  if (e.code === 'Enter') G.ui.buy = false;
  if (e.code === 'KeyR') startReload(p);
  if (e.code === 'KeyF') { cycleNade(); }
  if (e.code === 'KeyG' && p.alive && throwNade(p, p.nadeSel)) snd.sfxThrow();
  const m = e.code.match(/^Digit(\d)$/);
  if (m) {
    if (G.ui.buy) {
      const it = SHOP.find((s) => s.key === m[1]);
      if (it) { const err = buyItem(p, it); if (err) note(err); else { G.ui.note = ''; snd.sfxBuy(); } }
    } else if (m[1] === '1' && p.primary) selectWeapon(p, p.primary);
    else if (m[1] === '2') selectWeapon(p, p.pistol);
    else if (m[1] === '3') selectWeapon(p, 'knife');
  }
});
addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) keys[k] = false;
  if (e.code === 'Tab') { G.ui.scores = false; e.preventDefault(); }
});
function cycleNade() {
  for (let i = 1; i <= 3; i++) {
    const n = NADE_ORDER[(NADE_ORDER.indexOf(p.nadeSel) + i) % 3];
    if (p.nades[n] > 0) { p.nadeSel = n; return; }
  }
}
const cv = renderer.domElement;
cv.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== cv) cv.requestPointerLock?.();
  if (e.button === 0) { mouseDown = true; clicked = true; }
  if (e.button === 2 && WEAPONS[p.cur].zoom) p.scope = !p.scope;
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== cv || !p.alive) return;
  const s = p.scope ? 0.0009 : 0.0022;
  p.yaw -= e.movementX * s;
  p.pitch = clamp(p.pitch - e.movementY * s, -1.45, 1.45);
});

// ---- simulation hooks: visuals and sound react to gameplay events ----
const mz = [0, 0, 0];
function muzzlePos(a) {
  if (a.isPlayer) {
    const s = Math.sin(a.yaw), c = Math.cos(a.yaw);
    mz[0] = a.x - s * 0.7 + c * 0.18; mz[1] = eyeY(a) - 0.16; mz[2] = a.z - c * 0.7 - s * 0.18;
  } else {
    const s = Math.sin(a.yaw), c = Math.cos(a.yaw);
    mz[0] = a.x - s * 0.75 + c * 0.12; mz[1] = a.y + (a.crouch ? 0.9 : 1.3); mz[2] = a.z - c * 0.75 - s * 0.12;
  }
}
hooks.shot = (a, tx, ty, tz, victim, first) => {
  const w = WEAPONS[a.cur];
  if (!w.melee) { muzzlePos(a); addTracer(mz[0], mz[1], mz[2], tx, ty, tz); }
  addSpark(tx, ty, tz, !!victim);
  if (first) {
    G.noise[a.team].x = a.x; G.noise[a.team].z = a.z; G.noise[a.team].t = G.time;
    a.flashShow = 0.06; a.spotted = G.time + 1.5;
    const d = Math.hypot(a.x - p.x, a.z - p.z);
    // pan: sine of the shooter's bearing relative to where the player looks
    snd.sfxShot(a.cur, w.tone, a.isPlayer ? 0 : d, a.isPlayer ? 0 : Math.sin(Math.atan2(a.x - p.x, -(a.z - p.z)) + p.yaw));
  }
};
hooks.hit = (target, attacker, head, fx, fz) => {
  if (attacker === p) { G.ui.hitT = G.time; G.ui.hitHead = head; snd.sfxHit(head); }
  if (target === p) {
    const d = G.ui.dmg[G.ui.dmgI]; G.ui.dmgI = (G.ui.dmgI + 1) % 3;
    d.t = G.time; d.ang = Math.atan2(fx - p.x, -(fz - p.z)) + p.yaw;  // 0 = attacker straight ahead
    G.ui.hurtT = G.time; snd.sfxHurt();
  }
};
hooks.died = (v) => { if (v === p) { p.scope = false; G.ui.buy = false; } };
hooks.reload = (a) => { if (a === p) snd.sfxReload(); };
hooks.empty = (a) => { if (a === p) snd.sfxEmpty(); };
nadeHooks.boom = (kind, x, y, z) => {
  if (kind === 'smoke') snd.sfxSmoke();
  else if (kind === 'flash') { addBoom(x, y, z, 9); snd.sfxFlash(); }
  else { addBoom(x, y + 0.5, z, 12); snd.sfxBoom(false); }
};
roundHooks.planted = () => snd.sfxBeep(true);
roundHooks.exploded = (x, z) => { addBoom(x, 1, z, 26); snd.sfxBoom(true); };
roundHooks.over = (w) => snd.sfxRound(w === p.team);

// ---- fixed step ----
let stepAcc = 0, bob = 0, vmKick = 0, stepDist = 0;
function simStep(dt) {
  p.use = !!keys.e;
  // player trigger
  const w = curW(p);
  if (p.alive && !G.ui.buy && (clicked || (mouseDown && w.auto)) && fire(p)) vmKick = 1;
  clicked = false;
  stepPlayer(p, keys, dt);
  for (const a of G.actors) {
    if (a.bot) stepBot(a, dt);
    tickWeapon(a, dt);
    if (a.flashShow > 0) a.flashShow -= dt;
  }
  stepGrenades(dt);
  stepRound(dt);
  stepDist += Math.hypot(p.vx, p.vz) * dt;
  if (stepDist > 2.2 && p.onGround && !keys.shift && !keys.ctrl) { stepDist = 0; snd.sfxStep(0.12, 0); }
}

// ---- render-side sync ----
function syncView(dt, time) {
  const free = G.ui.free;
  if (free) {
    camera.position.set(free.x, free.y, free.z);
    camera.rotation.set(free.pitch, free.yaw, 0);
    camera.fov = free.fov || 70;
  } else {
    const ey = p.alive ? eyeY(p) : 0.5;
    camera.position.set(p.x, ey + Math.sin(bob * 2) * 0.012 * Math.min(1, Math.hypot(p.vx, p.vz) / 5), p.z);
    camera.rotation.set(p.pitch, p.yaw, p.alive ? 0 : 0.9);
    camera.fov = p.scope ? 24 : 74;
  }
  camera.updateProjectionMatrix();
  // viewmodel
  const sp = Math.min(1, Math.hypot(p.vx, p.vz) / 5);
  bob += dt * (3 + sp * 7);
  vmKick = Math.max(0, vmKick - dt * 9);
  const wdef = curW(p);
  for (const id in vms) vms[id].root.visible = id === p.cur && p.alive && !p.scope && !free;
  const vm = vms[p.cur];
  if (vm) {
    const reload = p.reloadT > 0 ? Math.sin(Math.min(1, 1 - p.reloadT / wdef.reload) * Math.PI) : 0;
    // The gun drops out of view while it is being raised after a switch, and while the hands
    // are busy planting or defusing.
    const raise = bombProgress(p) > 0 ? 1 : p.switchT > 0 ? p.switchT / 0.3 : 0;
    vm.root.position.set(0.17 + Math.sin(bob) * 0.012 * sp, -0.19 - reload * 0.25 - raise * 0.3 - Math.abs(Math.cos(bob)) * 0.01 * sp, -0.4 + vmKick * 0.06);
    vm.root.rotation.set(vmKick * 0.12 + reload * 0.5, 0.04 - reload * 0.3, reload * 0.4);
    vm.flash.visible = p.flashShow > 0;
    if (vm.flash.visible) vm.flash.children[0].material.rotation = time * 40;
  }
  // bots
  for (const a of G.actors) {
    const m = a.model;
    if (!m) continue;
    setHeldGun(m, a.cur);
    poseHumanoid(m, a, time);
    m.flash.visible = a.flashShow > 0 && a.alive;
    // Teammates' nametags always show; an enemy's only within TAG_RANGE and through a clear line of sight.
    if (a.alive) m.tag.visible = a.team === p.team || (Math.hypot(a.x - p.x, a.z - p.z) < TAG_RANGE && lineClear(p.x, eyeY(p), p.z, a.x, a.y + 2, a.z) && !smokeBlocks(p.x, p.z, a.x, a.z));
  }
}

// ---- main loop ----
let last = performance.now(), hudT = 0, frame = 0;
function frameLoop(now) {
  requestAnimationFrame(frameLoop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!G.frozen) {
    stepAcc += dt;
    let n = 0;
    while (stepAcc >= STEP && n++ < 6) { simStep(STEP); stepAcc -= STEP; }
  }
  const time = G.frozen ? 3.1 : G.time;
  updateEffects(G.frozen ? 0 : dt, time);
  syncView(G.frozen ? 0 : dt, time);
  renderer.render(scene, camera);
  hudT -= dt;
  if (hudT <= 0 || G.frozen) { hudT = 0.05; updateHud(p, spreadOf(p)); }
  if (++frame === 3) document.title = G.shot ? `VANTAGE shot ${G.shot}` : document.title;
}
requestAnimationFrame(frameLoop);
window.VANTAGE = { G, THREE_REVISION: THREE.REVISION };
