// grenades.js: thrown frag / flash / smoke. Projectiles bounce off the map boxes, then detonate.
// Pure simulation: visuals read G.grenades and G.smokes (see effects.js).
import { G } from './state.js';
import { NADES } from './config.js';
import { BOXES, lineClear } from './map.js';
import { applyDamage, eyeY, hooks } from './actors.js';
import { angleDiff, yawTo } from './util.js';

export const nadeHooks = { boom: () => {} };

function inBox(x, y, z) {
  for (const o of BOXES) if (x > o.x1 && x < o.x2 && z > o.z1 && z < o.z2 && y < o.h) return true;
  return false;
}

// Throw from the actor's eye along its view. Returns false when it has none of that kind.
export function throwNade(a, kind, power = 15) {
  if (a.nades[kind] <= 0 || !a.alive) return false;
  a.nades[kind]--;
  const c = Math.cos(a.pitch + 0.12);
  G.grenades.push({
    kind, owner: a, x: a.x, y: eyeY(a) - 0.15, z: a.z,
    vx: -Math.sin(a.yaw) * c * power + a.vx * 0.5, vy: Math.sin(a.pitch + 0.12) * power + 2,
    vz: -Math.cos(a.yaw) * c * power + a.vz * 0.5, t: NADES[kind].fuse, spin: 0,
  });
  return true;
}

export function stepGrenades(dt) {
  for (let i = G.grenades.length - 1; i >= 0; i--) {
    const n = G.grenades[i];
    n.t -= dt;
    n.vy -= 17 * dt;
    n.spin += dt * 8;
    // Per axis so a hit on one face keeps sliding along the others.
    let nx = n.x + n.vx * dt;
    if (inBox(nx, n.y, n.z) || Math.abs(nx) > 41) { n.vx *= -0.45; nx = n.x; }
    let nz = n.z + n.vz * dt;
    if (inBox(nx, n.y, nz) || Math.abs(nz) > 41) { n.vz *= -0.45; nz = n.z; }
    let ny = n.y + n.vy * dt;
    if (ny < 0.12) { ny = 0.12; n.vy *= -0.4; n.vx *= 0.7; n.vz *= 0.7; }
    else if (inBox(nx, ny, nz)) { n.vy = Math.abs(n.vy) * 0.3 * (n.vy < 0 ? 1 : -1); ny = n.y; if (n.vy < 0) n.vy = 0; }
    n.x = nx; n.y = ny; n.z = nz;
    if (n.t <= 0) { detonate(n); G.grenades.splice(i, 1); }
  }
  for (let i = G.smokes.length - 1; i >= 0; i--) if (G.smokes[i].until < G.time) G.smokes.splice(i, 1);
}

function detonate(n) {
  const def = NADES[n.kind];
  nadeHooks.boom(n.kind, n.x, n.y, n.z);
  if (n.kind === 'smoke') { G.smokes.push({ x: n.x, y: 1.4, z: n.z, r: def.radius, until: G.time + def.life }); return; }
  for (const a of G.actors) {
    if (!a.alive) continue;
    const ey = eyeY(a);
    const d = Math.hypot(a.x - n.x, ey - n.y, a.z - n.z);
    if (d > def.radius || !lineClear(n.x, n.y + 0.2, n.z, a.x, ey - 0.4, a.z)) continue;
    if (n.kind === 'frag') {
      const dmg = def.dmg * (1 - d / def.radius) ** 1.3;
      if (dmg >= 1) applyDamage(a, n.owner, dmg, false, 'knife', n.x, n.z);
    } else {
      // Flash: stronger the more the victim is looking at it.
      const facing = Math.abs(angleDiff(yawTo(n.x - a.x, n.z - a.z), a.yaw));
      const k = facing < 1.1 ? 1 : facing < 2.2 ? 0.4 : 0.12;
      a.flashT = Math.max(a.flashT, def.blind * k * (1 - d / def.radius * 0.5));
    }
  }
}

// Does a smoke cloud sit on the segment A->B (xz, eye height)? Used by bot vision and by bullets' sight.
export function smokeBlocks(ax, az, bx, bz) {
  for (const s of G.smokes) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.z - az) * dz) / l2));
    const px = ax + dx * t - s.x, pz = az + dz * t - s.z;
    if (px * px + pz * pz < s.r * s.r * 0.8) return true;
  }
  return false;
}
