// movement.js: one walker model for player and bots. Quake-style: ground friction, acceleration
// toward a wish direction, weak air control, jump, crouch, collision slide against map boxes.
import { MOVE, WEAPONS } from './config.js';
import { moveXZ, BOXES } from './map.js';
import { clamp } from './util.js';

// Height of the floor under (x,z) for an actor of radius r: top of any box it is standing over
// and low enough to step on or already above; else 0. Boxes taller than stepUp block (moveXZ).
function floorAt(a) {
  let h = 0;
  for (const o of BOXES) {
    if (a.x > o.x1 - 0.2 && a.x < o.x2 + 0.2 && a.z > o.z1 - 0.2 && a.z < o.z2 + 0.2 && o.h <= a.y + MOVE.stepUp + 0.05 && o.h > h) h = o.h;
  }
  return h;
}

// wx,wz: wish direction (unit or zero). speedMul: weapon + walk/crouch factor.
export function moveActor(a, wx, wz, speedMul, wantJump, dt) {
  const max = MOVE.run * speedMul * (a.crouch ? MOVE.crouchMul : 1) * (a.walk ? MOVE.walkMul : 1);
  // friction on the ground
  if (a.onGround) {
    const sp = Math.hypot(a.vx, a.vz);
    if (sp > 0.01) {
      const drop = Math.max(sp, MOVE.stopSpeed) * MOVE.friction * dt;
      const k = Math.max(0, sp - drop) / sp;
      a.vx *= k; a.vz *= k;
    } else { a.vx = a.vz = 0; }
  }
  // accelerate toward the wish speed along the wish direction
  if (wx || wz) {
    const acc = a.onGround ? MOVE.accel : MOVE.airAccel;
    const cur = a.vx * wx + a.vz * wz;
    const add = clamp(max - cur, 0, acc * max * dt);
    a.vx += wx * add; a.vz += wz * add;
  }
  if (wantJump && a.onGround && !a.crouch) { a.vy = MOVE.jump; a.onGround = false; }
  // vertical
  a.vy -= MOVE.gravity * dt;
  a.y += a.vy * dt;
  moveXZ(a, a.vx * dt, a.vz * dt, MOVE.radius);
  const fl = floorAt(a);
  if (a.y <= fl) { a.y = fl; a.vy = 0; a.onGround = true; } else if (a.y > fl + 0.02) a.onGround = false;
}

// Keyboard state -> wish direction in world space for a yaw (0 faces -Z). Writes the shared `wish`.
const wish = [0, 0];
function wishFromKeys(keys, yaw) {
  const f = (keys.w ? 1 : 0) - (keys.s ? 1 : 0), r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  wish[0] = wish[1] = 0;
  if (!f && !r) return;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const x = -sin * f + cos * r, z = -cos * f - sin * r;
  const l = Math.hypot(x, z);
  wish[0] = x / l; wish[1] = z / l;
}

// Player update from input: look, recoil recovery, movement. Frozen during the buy countdown
// only for the bomb timer, not movement, so the player can walk in the spawn.
export function stepPlayer(p, keys, dt) {
  p.crouch = !!keys.ctrl;
  p.walk = !!keys.shift;
  p.yaw += ((keys.left ? 1 : 0) - (keys.right ? 1 : 0)) * 2.2 * dt;
  p.pitch = clamp(p.pitch + ((keys.up ? 1 : 0) - (keys.down ? 1 : 0)) * 1.6 * dt, -1.45, 1.45);
  // recoil kick drains into the view slowly (the player has to pull down)
  const k = Math.min(1, dt * 14);
  p.pitch = clamp(p.pitch + p.kickP * k, -1.45, 1.45);
  p.yaw += p.kickY * k;
  p.kickP -= p.kickP * k; p.kickY -= p.kickY * k;
  wishFromKeys(keys, p.yaw);
  const w = WEAPONS[p.cur].speed * (p.scope ? 0.6 : 1);
  moveActor(p, p.alive ? wish[0] : 0, p.alive ? wish[1] : 0, w, p.alive && keys.space, dt);
}
