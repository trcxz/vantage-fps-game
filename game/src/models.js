// models.js: blocky humanoids (bots), gun models and the first-person viewmodels. All boxes, no assets.
import * as THREE from 'three';
import { TEAMS } from './config.js';
import { nameTagTexture } from './textures.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();
export function flat(color, rough = 0.7, metal = 0.1) {
  const k = color + '|' + rough + '|' + metal;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return matCache.get(k);
}
// A box mesh sized (w,h,d) at (x,y,z) added to `parent`.
export function part(parent, w, h, d, x, y, z, mat, shadow = true) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

const GUN_DARK = 0x23262b, GUN_MID = 0x3d4249, GUN_WOOD = 0x6b4a2c, GUN_STEEL = 0x8b929b;

// Weapon built along -Z (muzzle at negative z), origin at the grip. Returns {g, muzzleZ}.
function buildGun(id) {
  const g = new THREE.Group();
  const dark = flat(GUN_DARK, 0.5, 0.5), mid = flat(GUN_MID, 0.55, 0.4), wood = flat(GUN_WOOD, 0.8, 0), steel = flat(GUN_STEEL, 0.35, 0.7);
  let muzzleZ = -0.4;
  if (id === 'knife') {
    part(g, 0.03, 0.05, 0.14, 0, 0, 0, flat(0x2a2a2a));
    part(g, 0.012, 0.045, 0.3, 0, 0.005, -0.2, steel);
    muzzleZ = -0.35;
  } else if (id === 'pike' || id === 'anvil') {
    const big = id === 'anvil';
    part(g, 0.05, 0.1, 0.07, 0, -0.07, 0.05, dark);               // grip
    part(g, 0.055, 0.07, big ? 0.34 : 0.26, 0, 0.0, -0.1, mid);   // slide / frame
    part(g, 0.035, 0.035, big ? 0.14 : 0.06, 0, 0.0, big ? -0.34 : -0.26, steel); // barrel
    muzzleZ = big ? -0.42 : -0.3;
  } else if (id === 'wasp') {
    part(g, 0.06, 0.12, 0.08, 0, -0.09, 0.07, dark);
    part(g, 0.07, 0.09, 0.5, 0, 0, -0.15, mid);
    part(g, 0.045, 0.2, 0.06, 0, -0.14, -0.12, dark);             // magazine
    part(g, 0.04, 0.04, 0.2, 0, 0.0, -0.5, steel);
    part(g, 0.05, 0.05, 0.22, 0, 0.0, 0.3, dark);                 // stock
    muzzleZ = -0.62;
  } else if (id === 'bulwark') {
    part(g, 0.07, 0.1, 0.55, 0, 0, -0.2, wood);
    part(g, 0.05, 0.05, 0.7, 0, 0.065, -0.45, steel);             // barrel
    part(g, 0.055, 0.05, 0.3, 0, -0.045, -0.5, dark);             // magazine tube
    part(g, 0.06, 0.13, 0.08, 0, -0.1, 0.1, wood);
    part(g, 0.06, 0.1, 0.25, 0, -0.01, 0.38, wood);
    muzzleZ = -0.82;
  } else if (id === 'halberd') {
    part(g, 0.065, 0.13, 0.08, 0, -0.1, 0.08, dark);
    part(g, 0.075, 0.1, 0.62, 0, 0, -0.2, mid);
    part(g, 0.05, 0.2, 0.07, 0.0, -0.15, -0.14, dark);
    part(g, 0.045, 0.05, 0.3, 0, 0.0, -0.66, steel);
    part(g, 0.04, 0.06, 0.16, 0, 0.085, -0.15, dark);             // sight rail
    part(g, 0.06, 0.1, 0.3, 0, -0.01, 0.42, wood);
    muzzleZ = -0.84;
  } else { // longsight
    part(g, 0.065, 0.12, 0.08, 0, -0.09, 0.1, dark);
    part(g, 0.07, 0.1, 0.9, 0, 0, -0.3, mid);
    part(g, 0.04, 0.04, 0.55, 0, 0.0, -0.95, steel);
    const scope = part(g, 0.055, 0.055, 0.3, 0, 0.1, -0.28, dark);
    scope.castShadow = false;
    part(g, 0.065, 0.12, 0.3, 0, -0.02, 0.52, wood);
    muzzleZ = -1.25;
  }
  return { g, muzzleZ };
}

// Yellow muzzle flash: two crossed planes + glow sprite; toggled by showing/hiding.
function buildFlash(T) {
  const g = new THREE.Group();
  const mat = new THREE.SpriteMaterial({ map: T.flash, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(0.5, 0.5, 1);
  g.add(s);
  const l = new THREE.PointLight(0xffc070, 3, 9, 2);
  g.add(l);
  g.visible = false;
  return g;
}

// ---- humanoid ----
export function buildHumanoid(team, name, T) {
  const tm = TEAMS[team];
  const cloth = flat(tm.cloth, 0.8), dark = flat(tm.dark, 0.85), skin = flat(tm.skin, 0.9), vest = flat(0x2c3138, 0.6, 0.3);
  const root = new THREE.Group();
  const body = new THREE.Group();   // tilts/crouches without moving the root
  root.add(body);
  part(body, 0.46, 0.58, 0.26, 0, 1.2, 0, cloth);                 // torso
  part(body, 0.5, 0.34, 0.3, 0, 1.28, 0, vest);                   // vest plate
  part(body, 0.26, 0.26, 0.26, 0, 1.64, 0, skin);                 // head
  part(body, 0.29, 0.12, 0.29, 0, 1.78, 0, dark);                 // cap
  part(body, 0.29, 0.05, 0.12, 0, 1.74, -0.17, dark);             // brim
  part(body, 0.46, 0.2, 0.26, 0, 0.84, 0, dark);                  // hips
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.12, 0.84, 0); legR.position.set(0.12, 0.84, 0);
  for (const l of [legL, legR]) { part(l, 0.18, 0.8, 0.2, 0, -0.4, 0, dark); part(l, 0.2, 0.1, 0.3, 0, -0.78, -0.04, flat(0x16181b)); body.add(l); }
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.3, 1.43, 0); armR.position.set(0.3, 1.43, 0);
  for (const a of [armL, armR]) { part(a, 0.14, 0.5, 0.16, 0, -0.25, 0, cloth); part(a, 0.12, 0.12, 0.12, 0, -0.52, 0, skin); body.add(a); }
  // Both arms point forward holding the gun.
  armL.rotation.x = armR.rotation.x = -1.25;
  armL.rotation.y = 0.35;
  const gunHolder = new THREE.Group();
  gunHolder.position.set(0.12, 1.2, -0.38);
  body.add(gunHolder);
  const flash = buildFlash(T);
  body.add(flash);
  const tagMat = new THREE.SpriteMaterial({ map: nameTagTexture(name, tm.css), transparent: true, depthTest: false, fog: false });
  const tag = new THREE.Sprite(tagMat);
  tag.scale.set(1.5, 0.375, 1);
  tag.position.set(0, 2.25, 0);
  tag.renderOrder = 10;
  root.add(tag);
  return { root, body, legL, legR, armL, armR, gunHolder, flash, tag, gunId: '' };
}

// Swap the gun a humanoid holds; does nothing while the weapon id is unchanged.
export function setHeldGun(h, id) {
  if (h.gunId === id) return;
  h.gunId = id;
  while (h.gunHolder.children.length) h.gunHolder.remove(h.gunHolder.children[0]);
  const { g, muzzleZ } = buildGun(id);
  h.gunHolder.add(g);
  h.flash.position.set(0.12, 1.2, -0.38 + muzzleZ);
}

// Walk cycle + posture, driven by the actor's speed. `t` is the simulation clock.
export function poseHumanoid(h, a, t) {
  const sp = Math.min(1, Math.hypot(a.vx, a.vz) / 5);
  const ph = t * 9 * (0.4 + sp);
  h.legL.rotation.x = Math.sin(ph) * 0.8 * sp;
  h.legR.rotation.x = -Math.sin(ph) * 0.8 * sp;
  h.body.position.y = a.crouch ? -0.35 : 0;
  h.body.rotation.x = a.crouch ? 0.15 : 0;
  h.root.position.set(a.x, a.y, a.z);
  h.root.rotation.y = a.yaw;
  if (!a.alive) { h.root.rotation.x = -1.45; h.root.position.y = a.y + 0.2; h.tag.visible = false; }
}

// ---- first-person viewmodel ----
// One group per weapon, parented to the camera. Arms are two skin/cloth boxes behind the gun.
export function buildViewmodels(T, team) {
  const tm = TEAMS[team];
  const out = {};
  for (const id of ['knife', 'pike', 'anvil', 'wasp', 'bulwark', 'halberd', 'longsight']) {
    const root = new THREE.Group();
    const { g, muzzleZ } = buildGun(id);
    g.scale.setScalar(0.8);
    root.add(g);
    const sleeve = flat(tm.cloth, 0.8), skin = flat(tm.skin, 0.9);
    // Right hand wraps the grip, forearm runs back and down out of frame.
    part(root, 0.075, 0.075, 0.4, 0.0, -0.12, 0.25, sleeve, false);
    part(root, 0.07, 0.07, 0.09, 0.0, -0.08, 0.06, skin, false);
    if (id !== 'knife') {
      // Left hand cups the fore-end, forearm comes in from the lower left.
      const reach = Math.max(0.2, -muzzleZ * 0.8 * 0.45);
      const fa = part(root, 0.07, 0.07, 0.5, -0.12, -0.14, -reach + 0.28, sleeve, false);
      fa.rotation.y = -0.2;
      part(root, 0.075, 0.075, 0.09, -0.05, -0.065, -reach, skin, false);
    }
    const flash = buildFlash(T);
    flash.position.set(0, 0.0, muzzleZ * 0.8 - 0.08);
    flash.children[0].scale.set(0.55, 0.55, 1);
    flash.children[0].material.depthTest = false;
    flash.children[1].intensity = 2;
    root.add(flash);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    root.visible = false;
    out[id] = { root, flash, muzzleZ: muzzleZ * 0.8 };
  }
  return out;
}
