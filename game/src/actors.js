// actors.js: actors (player + bots), their loadouts, and the shared combat rules:
// firing, spread, hit detection against head and body, damage with armour, death.
// Player and bots use exactly the same fire()/applyDamage() so the rules are identical.
import { G, pushFeed, pushRadio } from './state.js';
import { WEAPONS, MOVE, NAMES } from './config.js';
import { rand, randRange, TAU, yawTo } from './util.js';
import { rayWorld, callout } from './map.js';

// Side effects (sound, tracers, blood) are wired by main.js; the rules here stay pure.
export const hooks = {
  shot: () => {}, hit: () => {}, died: () => {}, reload: () => {}, empty: () => {}, step: () => {},
};

export function makeActor(team, slot, isPlayer) {
  return {
    id: team * 5 + slot, team, slot, isPlayer, name: NAMES[team][slot],
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: false, walk: false, onGround: true,
    hp: 100, armor: 0, alive: true, money: 0, kit: false, hasBomb: false,
    kills: 0, deaths: 0, roundKills: 0, dmgDealt: 0,
    primary: '', pistol: 'pike', cur: 'pike',
    mag: {}, reserve: {}, nades: { frag: 0, flash: 0, smoke: 0 }, nadeSel: 'frag',
    cool: 0, reloadT: 0, bloom: 0, kickP: 0, kickY: 0, switchT: 0, flashT: 0, scope: false,
    model: null, bot: null, boot: false,
  };
}

// Give a weapon with a full magazine and reserve (replaces the same slot).
export function giveWeapon(a, id) {
  const w = WEAPONS[id];
  if (w.slot === 'primary') a.primary = id; else if (w.slot === 'pistol') a.pistol = id;
  a.mag[id] = w.mag;
  a.reserve[id] = w.reserve;
}
export function resetLoadout(a) {
  a.primary = ''; a.armor = 0; a.kit = false; a.hasBomb = false;
  a.nades.frag = a.nades.flash = a.nades.smoke = 0;
  a.pistol = 'pike';
  giveWeapon(a, 'pike'); a.mag.knife = 1; a.reserve.knife = 0;
  a.cur = 'pike';
}
export const curW = (a) => WEAPONS[a.cur];
export function selectWeapon(a, id) {
  if (!id || a.cur === id || (id !== 'knife' && a.mag[id] === undefined)) return;
  a.cur = id; a.cool = 0.4; a.reloadT = 0; a.scope = false; a.switchT = 0.3;
}
export const bestWeapon = (a) => a.primary || a.pistol;
export const eyeY = (a) => a.y + (a.crouch ? MOVE.eyeCrouch : MOVE.eye);

export function startReload(a) {
  const w = curW(a);
  if (w.melee || a.reloadT > 0 || a.mag[a.cur] >= w.mag || a.reserve[a.cur] <= 0) return;
  a.reloadT = w.reload;
  hooks.reload(a);
}

// Current cone half-angle in radians: base + moving + sustained fire + airborne, less when crouched.
export function spreadOf(a) {
  const w = curW(a);
  const sp = Math.min(1, Math.hypot(a.vx, a.vz) / MOVE.run);
  let s = w.spread + w.moveSpread * sp * sp + a.bloom;
  if (!a.onGround) s += w.moveSpread * 1.5 + 0.03;
  if (a.crouch) s *= 0.7;
  if (a.scope) s *= 0.15;
  return s;
}

// ---- hit geometry ----
const hitRes = { t: 2, actor: null, head: false };
// Segment A->B (B = A + D) against an actor's body cylinder and head sphere. Fills hitRes if closer.
function hitActor(t_max, ax, ay, az, dx, dy, dz, o) {
  const top = o.crouch ? 1.38 : 1.8, r = 0.32;
  // head sphere (centre near the top, radius 0.19)
  const hy = o.y + top - 0.17;
  const fx = ax - o.x, fy = ay - hy, fz = az - o.z;
  const a2 = dx * dx + dy * dy + dz * dz, b2 = fx * dx + fy * dy + fz * dz, c2 = fx * fx + fy * fy + fz * fz - 0.19 * 0.19;
  const disc = b2 * b2 - a2 * c2;
  if (disc >= 0) {
    const t = (-b2 - Math.sqrt(disc)) / a2;
    if (t >= 0 && t < hitRes.t && t < t_max) { hitRes.t = t; hitRes.actor = o; hitRes.head = true; }
  }
  // body cylinder (vertical), checked in the xz plane then clipped by height
  const ex = ax - o.x, ez = az - o.z;
  const qa = dx * dx + dz * dz;
  if (qa < 1e-9) return;
  const qb = ex * dx + ez * dz, qc = ex * ex + ez * ez - r * r;
  const dd = qb * qb - qa * qc;
  if (dd < 0) return;
  const t = (-qb - Math.sqrt(dd)) / qa;
  if (t < 0 || t >= hitRes.t || t >= t_max) return;
  const y = ay + dy * t;
  if (y >= o.y && y <= o.y + top - 0.3) { hitRes.t = t; hitRes.actor = o; hitRes.head = false; }
}

// Fire one ray from the eye along a direction. Returns {t, actor, head} (shared object, read at once).
export function castBullet(shooter, dirx, diry, dirz, range) {
  const ax = shooter.x, ay = eyeY(shooter), az = shooter.z;
  const bx = ax + dirx * range, by = ay + diry * range, bz = az + dirz * range;
  const tw = rayWorld(ax, ay, az, bx, by, bz);
  hitRes.t = tw; hitRes.actor = null; hitRes.head = false;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  for (const o of G.actors) {
    if (!o.alive || o === shooter || o.team === shooter.team) continue;
    hitActor(tw, ax, ay, az, dx, dy, dz, o);
  }
  return hitRes;
}

// Damage with falloff, head multiplier and armour. Returns true when the target died.
export function applyDamage(target, attacker, dmg, head, wid, fromX, fromZ) {
  if (!target.alive) return false;
  const w = WEAPONS[wid];
  let hp = dmg;
  if (target.armor > 0) {
    const pen = w ? w.pen : 0.5;
    hp = dmg * pen;
    target.armor = Math.max(0, target.armor - (dmg - hp) * 0.5);
  }
  hp = Math.max(1, Math.round(hp));
  target.hp -= hp;
  if (attacker) attacker.dmgDealt += hp;
  hooks.hit(target, attacker, head, fromX, fromZ);
  if (target.hp <= 0) { kill(target, attacker, wid, head); return true; }
  return false;
}

export function kill(v, k, wid, head) {
  v.hp = 0; v.alive = false; v.deaths++; v.hasBomb = false;
  if (k && k !== v) { k.kills++; k.roundKills++; k.money = Math.min(12000, k.money + (WEAPONS[wid] ? WEAPONS[wid].reward : 300)); }
  pushFeed(k || v, v, WEAPONS[wid] ? WEAPONS[wid].name : wid, head);
  if (v.team === G.player.team && v !== G.player) pushRadio(v.team, v.name, `Down at ${callout(v.x, v.z)}!`);
  hooks.died(v, k, head);
}

// Trigger pull. Handles cooldown, ammo, recoil, bloom, pellets. Returns true if a shot left the barrel.
export function fire(a, yawJitter = 0, pitchJitter = 0) {
  const w = curW(a);
  if (a.cool > 0 || a.reloadT > 0 || a.switchT > 0 || a.flashT > 1.6 && !a.isPlayer) return false;
  if (!w.melee && a.mag[a.cur] <= 0) { hooks.empty(a); a.cool = 0.25; if (a.reserve[a.cur] > 0) startReload(a); return false; }
  a.cool = w.interval;
  if (!w.melee) a.mag[a.cur]--;
  const cone = spreadOf(a);
  const eye = eyeY(a);
  const cp = Math.cos(a.pitch + pitchJitter), sp = Math.sin(a.pitch + pitchJitter);
  let any = null;
  const n = w.melee ? 1 : w.pellets;
  for (let i = 0; i < n; i++) {
    // random point in the cone (uniform disc), applied to yaw/pitch
    const ang = rand() * TAU, rad = Math.sqrt(rand()) * cone;
    const yw = a.yaw + yawJitter + Math.cos(ang) * rad, pt = a.pitch + pitchJitter + Math.sin(ang) * rad;
    const c = Math.cos(pt);
    const dx = -Math.sin(yw) * c, dy = Math.sin(pt), dz = -Math.cos(yw) * c;
    const res = castBullet(a, dx, dy, dz, w.range);
    const dist = res.t * w.range;
    const tx = a.x + dx * dist, ty = eye + dy * dist, tz = a.z + dz * dist;
    hooks.shot(a, tx, ty, tz, res.actor, i === 0);
    if (res.actor) {
      const mult = 0.5 ** (dist / (w.falloff * 3));
      applyDamage(res.actor, a, w.dmg * (res.head ? w.head : 1) * Math.max(0.35, mult), res.head, a.cur, a.x, a.z);
      any = res.actor;
    }
  }
  a.bloom = Math.min(w.bloomMax, a.bloom + w.bloom);
  a.kickP += w.kickV * (0.8 + rand() * 0.4);
  a.kickY += w.kickH * randRange(-1, 1);
  return true;
}

// Per-tick weapon timers: cooldown, reload completion, bloom recovery, flash decay.
export function tickWeapon(a, dt) {
  a.cool = Math.max(0, a.cool - dt);
  a.switchT = Math.max(0, a.switchT - dt);
  a.flashT = Math.max(0, a.flashT - dt);
  a.bloom = Math.max(0, a.bloom - dt * 0.09);
  if (a.reloadT > 0) {
    a.reloadT -= dt;
    if (a.reloadT <= 0) {
      const w = curW(a);
      const take = Math.min(w.mag - a.mag[a.cur], a.reserve[a.cur]);
      a.mag[a.cur] += take; a.reserve[a.cur] -= take; a.reloadT = 0;
    }
  }
}

export const aimYawTo = (a, tx, tz) => yawTo(tx - a.x, tz - a.z);
