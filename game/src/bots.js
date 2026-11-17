// bots.js: bot brains. Each bot follows a goal list from its team's round plan along the waypoint
// graph, sees enemies by line-of-sight (field of view, range, smoke), reacts after a delay,
// turns at a limited speed, shoots with inaccuracy, hears gunfire and reports contact on the radio.
import { G, pushRadio } from './state.js';
import { clamp, rand, randRange, angleDiff, turnToward, yawTo } from './util.js';
import { NODES, nearestNode, findPath, lineClear, callout } from './map.js';
import { eyeY, fire, curW, startReload, selectWeapon, bestWeapon } from './actors.js';
import { moveActor } from './movement.js';
import { smokeBlocks, throwNade } from './grenades.js';

export function makeBrain(skill) {
  return {
    skill,                       // 0.6 .. 1.0: scales reaction time, turn speed and accuracy
    goals: [], path: [], pi: 0, holdT: 0, watch: 0,
    target: null, seenFor: 0, lastSeen: { x: 0, z: 0, t: -99 }, stuckT: 0, lastX: 0, lastZ: 0,
    strafeT: 0, strafeDir: 1, lookT: 0, lookYaw: 0, callT: 0, nadeT: 0, crouchT: 0,
  };
}

// Replace the route: a list of node ids to visit in order; the last one is held (looking at `watch` yaw).
export function setRoute(a, ids, watchYaw, delay = 0) {
  const b = a.bot;
  b.goals = ids.map((id) => NODES.findIndex((n) => n.id === id)).filter((i) => i >= 0);
  b.path = []; b.pi = 0; b.holdT = delay; b.watch = watchYaw;
}

function repath(a) {
  const b = a.bot;
  if (!b.goals.length) { b.path = []; return; }
  b.path = findPath(nearestNode(a.x, a.z), b.goals[0]);
  b.pi = 0;
}

// Pick the nearest visible enemy. Eye-to-chest ray, 140 degree field of view, smoke blocks.
function scan(a) {
  let best = null, bd = 1e9;
  const ey = eyeY(a);
  for (const o of G.actors) {
    if (!o.alive || o.team === a.team) continue;
    const dx = o.x - a.x, dz = o.z - a.z, d = Math.hypot(dx, dz);
    if (d > 42 || d >= bd) continue;
    if (Math.abs(angleDiff(yawTo(dx, dz), a.yaw)) > 1.25 && d > 3) continue;
    if (a.flashT > 0.6) continue;
    if (!lineClear(a.x, ey, a.z, o.x, o.y + 1.35, o.z) || smokeBlocks(a.x, a.z, o.x, o.z)) continue;
    best = o; bd = d;
  }
  return best;
}

// One brain tick. Returns nothing; writes input to the actor through moveActor / fire.
export function stepBot(a, dt) {
  const b = a.bot;
  if (!a.alive) return;
  const frozen = G.phase === 'freeze';
  const sk = b.skill;
  const ey = eyeY(a);
  a.use = false;

  // --- perception ---
  const seen = frozen ? null : scan(a);
  if (seen) {
    if (seen !== b.target) { b.target = seen; b.seenFor = 0; }
    b.seenFor += dt;
    b.lastSeen.x = seen.x; b.lastSeen.z = seen.z; b.lastSeen.t = G.time;
    if (b.callT < G.time) {
      b.callT = G.time + 6;
      pushRadio(a.team, a.name, `Contact, ${callout(seen.x, seen.z)}!`);
    }
  } else {
    b.target = null; b.seenFor = 0;
    // Hearing: turn toward the last enemy gunshot nearby.
    const nz = G.noise[1 - a.team];
    if (G.time - nz.t < 0.6 && Math.hypot(nz.x - a.x, nz.z - a.z) < 28 && b.lookT < G.time) {
      b.lookYaw = yawTo(nz.x - a.x, nz.z - a.z); b.lookT = G.time + 1.5;
    }
  }

  // --- movement intent ---
  let wx = 0, wz = 0, mul = 1, aimYaw = a.yaw, aimPitch = 0, shooting = false;
  const tgt = b.target;
  if (tgt) {
    const dx = tgt.x - a.x, dz = tgt.z - a.z, dist = Math.hypot(dx, dz);
    aimYaw = yawTo(dx, dz);
    aimPitch = Math.atan2(tgt.y + (tgt.crouch ? 1.0 : 1.4) - ey, dist);
    const w = curW(a);
    // Stop to shoot with accurate weapons; strafe a little with the SMG/shotgun.
    if (b.strafeT < G.time) { b.strafeT = G.time + randRange(0.5, 1.2); b.strafeDir = rand() < 0.5 ? -1 : 1; }
    if (w.melee) { wx = -Math.sin(aimYaw); wz = -Math.cos(aimYaw); }
    else if (w.moveSpread < 0.03 || dist < 9) { wx = Math.cos(a.yaw) * b.strafeDir; wz = -Math.sin(a.yaw) * b.strafeDir; mul = 0.6; }
    a.crouch = dist > 22 && w.moveSpread > 0.04;
    // Reaction delay then aim, then fire when the barrel is on target.
    const react = (0.55 - sk * 0.3) + (tgt.isPlayer ? 0.05 : 0);
    const err = Math.abs(angleDiff(aimYaw, a.yaw));
    if (b.seenFor > react && err < 0.12) shooting = true;
    if (shooting && curW(a).mag && a.mag[a.cur] <= 0 && a.reserve[a.cur] <= 0) selectWeapon(a, a.pistol === a.cur ? 'knife' : a.pistol);
  } else if (b.lookT > G.time) {
    aimYaw = b.lookYaw;
    a.crouch = false;
  } else {
    a.crouch = false;
    // follow the route
    if (b.holdT > 0 && !frozen) b.holdT -= dt;
    if (!b.path.length || b.pi >= b.path.length) { if (b.goals.length) repath(a); }
    const goalNode = b.goals.length ? NODES[b.goals[0]] : null;
    const atGoal = goalNode && Math.hypot(goalNode.x - a.x, goalNode.z - a.z) < 1.4;
    if (frozen || b.holdT > 0) {
      aimYaw = b.watch;
    } else if (atGoal) {
      if (b.goals.length > 1) { b.goals.shift(); b.path = []; }
      else { aimYaw = b.watch + Math.sin(G.time * 0.7 + a.id) * 0.5; mul = 0; if (G.time - b.lastSeen.t < 4) aimYaw = yawTo(b.lastSeen.x - a.x, b.lastSeen.z - a.z); }
      // the last goal is a hold position; plant happens in round.js using a.use
      if (b.goals.length === 1 && a.hasBomb) a.use = true;
    } else if (b.path.length) {
      const n = NODES[b.path[Math.min(b.pi, b.path.length - 1)]];
      const dx = n.x - a.x, dz = n.z - a.z, d = Math.hypot(dx, dz);
      if (d < 1.1) b.pi++;
      else { wx = dx / d; wz = dz / d; aimYaw = yawTo(dx, dz); }
    }
    // unstick: no progress while trying to move -> replan and sidestep
    if (Math.hypot(a.x - b.lastX, a.z - b.lastZ) < 0.03 && (wx || wz)) b.stuckT += dt; else { b.stuckT = 0; b.lastX = a.x; b.lastZ = a.z; }
    if (b.stuckT > 1.2) { b.stuckT = 0; b.path = []; const t = wx; wx = -wz; wz = t; }
  }

  // --- turning (limited speed) ---
  const turn = (3 + 5 * sk) * dt * (tgt ? 1.6 : 1);
  a.yaw = turnToward(a.yaw, aimYaw, turn);
  a.pitch = clamp(turnToward(a.pitch, aimPitch, 3 * dt), -1, 1);

  // --- weapons ---
  if (shooting) {
    // jitter shrinks with skill and when standing still
    const moving = Math.hypot(a.vx, a.vz) / 5;
    const e = (0.035 - 0.02 * sk) * (1 + moving * 1.6);
    fire(a, randRange(-e, e), randRange(-e, e) * 0.6);
  }
  const w = curW(a);
  if (!w.melee && a.mag[a.cur] < w.mag * 0.3 && !tgt) startReload(a);
  if (!tgt && !w.melee && a.mag[a.cur] <= 0) startReload(a);
  if (!tgt && a.cur !== bestWeapon(a) && a.mag[bestWeapon(a)] > 0) selectWeapon(a, bestWeapon(a));
  // grenades: smoke or frag toward a spotted site fight, thrown rarely
  if (tgt && b.nadeT < G.time && b.seenFor > 0.3 && a.nades.frag > 0 && Math.hypot(tgt.x - a.x, tgt.z - a.z) < 20 && rand() < dt * 0.5) {
    b.nadeT = G.time + 12;
    throwNade(a, 'frag', 13);
  }

  moveActor(a, wx, wz, mul * w.speed, false, dt);
}
