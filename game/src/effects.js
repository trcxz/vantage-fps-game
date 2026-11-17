// effects.js: render-side visuals driven by simulation events: tracers, impact sparks, smoke clouds,
// grenade meshes, explosions, the bomb prop. Pools are allocated once; nothing is created per frame.
import * as THREE from 'three';
import { G } from './state.js';
import { flat, part } from './models.js';

const MAX_TRACERS = 40, MAX_SPARKS = 40, MAX_PUFFS = 60;
let scene, T;
const tracers = [], sparks = [], puffs = [], nadeMeshes = [], booms = [];
let bomb, bombLight, nadeMats;

export function initEffects(sc, textures) {
  scene = sc; T = textures;
  const tm = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const tg = new THREE.BoxGeometry(0.03, 0.03, 1);
  for (let i = 0; i < MAX_TRACERS; i++) {
    const m = new THREE.Mesh(tg, tm.clone());
    m.visible = false; m.userData.life = 0;
    scene.add(m); tracers.push(m);
  }
  const sm = new THREE.SpriteMaterial({ map: T.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < MAX_SPARKS; i++) {
    const s = new THREE.Sprite(sm.clone());
    s.visible = false; s.userData = { life: 0, vx: 0, vy: 0, vz: 0 };
    scene.add(s); sparks.push(s);
  }
  for (let i = 0; i < MAX_PUFFS; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.puff, transparent: true, depthWrite: false, opacity: 0.5, color: 0xc8c8d0 }));
    s.visible = false; s.userData = { smoke: null, ox: 0, oy: 0, oz: 0, ph: 0, sz: 0 };
    scene.add(s); puffs.push(s);
  }
  // grenade bodies: a pool of small boxes sharing one material per kind
  nadeMats = { frag: flat(0x4a5a3a, 0.5, 0.3), flash: flat(0xd0d0d8, 0.5, 0.3), smoke: flat(0x9a9aa4, 0.5, 0.3) };
  const ng = new THREE.BoxGeometry(0.12, 0.16, 0.12);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(ng, nadeMats.frag);
    m.visible = false; scene.add(m); nadeMeshes.push(m);
  }
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.flash, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.visible = false; s.userData = { life: 0, size: 6 };
    scene.add(s); booms.push(s);
  }
  // Bomb prop: red slab with blinking light, shown on the floor while dropped or planted.
  bomb = new THREE.Group();
  part(bomb, 0.5, 0.2, 0.32, 0, 0.1, 0, flat(0x2d3036, 0.5, 0.4));
  part(bomb, 0.36, 0.05, 0.2, 0, 0.225, 0, flat(0xc2402f, 0.5, 0.2));
  const led = part(bomb, 0.08, 0.08, 0.08, 0.14, 0.28, 0, new THREE.MeshBasicMaterial({ color: 0xff3a2a }), false);
  bomb.userData.led = led;
  bombLight = new THREE.PointLight(0xff3a2a, 0, 8, 2);
  bomb.add(bombLight);
  bomb.visible = false;
  scene.add(bomb);
}

// A bullet trail from (ax,ay,az) to (bx,by,bz) that fades in ~0.08 s.
export function addTracer(ax, ay, az, bx, by, bz) {
  const m = tracers.find((t) => !t.visible);
  if (!m) return;
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  m.scale.set(1, 1, len);
  m.lookAt(bx, by, bz);
  m.userData.life = 0.09; m.visible = true; m.material.opacity = 0.9;
}
export function addSpark(x, y, z, hot) {
  for (let n = 0; n < 3; n++) {
    const s = sparks.find((q) => !q.visible);
    if (!s) return;
    s.position.set(x, y, z);
    s.userData.life = 0.25;
    s.userData.vx = (Math.random() - 0.5) * 3; s.userData.vy = Math.random() * 2.5; s.userData.vz = (Math.random() - 0.5) * 3;
    s.material.color.set(hot ? 0xff3030 : 0xffd080);
    s.scale.set(0.25, 0.25, 1); s.visible = true;
  }
}
export function addBoom(x, y, z, size) {
  const s = booms.find((q) => !q.visible);
  if (!s) return;
  s.position.set(x, y, z); s.userData.life = 0.45; s.userData.size = size; s.visible = true;
}

// Per-frame: age things, place grenade meshes, grow smoke clouds, blink the bomb.
export function updateEffects(dt, time) {
  for (const t of tracers) if (t.visible) { t.userData.life -= dt; t.material.opacity = Math.max(0, t.userData.life / 0.09) * 0.9; if (t.userData.life <= 0) t.visible = false; }
  for (const s of sparks) if (s.visible) {
    const u = s.userData; u.life -= dt; u.vy -= 9 * dt;
    s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
    s.material.opacity = Math.max(0, u.life / 0.25);
    if (u.life <= 0) s.visible = false;
  }
  for (const s of booms) if (s.visible) {
    const u = s.userData; u.life -= dt;
    const k = 1 - u.life / 0.45;
    s.scale.set(u.size * (0.4 + k), u.size * (0.4 + k), 1); s.material.opacity = Math.max(0, 1 - k);
    if (u.life <= 0) s.visible = false;
  }
  // grenades in flight
  for (let i = 0; i < nadeMeshes.length; i++) {
    const m = nadeMeshes[i], n = G.grenades[i];
    m.visible = !!n;
    if (n) {
      m.position.set(n.x, n.y, n.z); m.rotation.set(n.spin, n.spin * 0.7, 0);
      m.material = nadeMats[n.kind];
    }
  }
  // smoke: each cloud owns up to 12 puffs, billboarded sprites that billow outward for 1.5 s
  let pi = 0;
  for (const sm of G.smokes) {
    const grow = Math.min(1, (G.time - (sm.until - 14)) / 1.5), fade = Math.min(1, (sm.until - G.time) / 2);
    for (let k = 0; k < 12 && pi < puffs.length; k++, pi++) {
      const p = puffs[pi], u = p.userData;
      if (u.smoke !== sm) {
        u.smoke = sm; u.ox = (Math.sin(k * 2.4) * 0.7); u.oz = (Math.cos(k * 1.9) * 0.7); u.oy = (k % 4) * 0.55; u.sz = 4 + (k % 3) * 1.4;
      }
      p.visible = true;
      p.position.set(sm.x + u.ox * sm.r * 0.6 * grow, 0.8 + u.oy * grow, sm.z + u.oz * sm.r * 0.6 * grow);
      const sz = u.sz * (0.5 + 0.5 * grow);
      p.scale.set(sz, sz, 1);
      p.material.opacity = 0.55 * fade;
      p.material.rotation = time * 0.05 * (k % 2 ? 1 : -1) + k;
    }
  }
  for (; pi < puffs.length; pi++) { puffs[pi].visible = false; puffs[pi].userData.smoke = null; }

  const B = G.bomb;
  bomb.visible = B.state === 'planted' || B.state === 'dropped';
  if (bomb.visible) {
    bomb.position.set(B.x, 0, B.z);
    const on = B.state === 'planted' ? (time * (B.timer < 10 ? 8 : 2)) % 1 < 0.3 : false;
    bomb.userData.led.visible = on || B.state === 'dropped';
    bombLight.intensity = on ? 3 : 0;
  }
}
