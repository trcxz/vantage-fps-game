// map.js: the level as data (axis-aligned boxes + waypoint graph) and the queries on it:
// collision for walkers, line-of-sight and bullet rays, shortest paths for bots.
// Sector layout (metres, x east, z south). Attackers spawn south, defenders north.
//   Site A north-west, Site B north-east, three lanes (west, mid, east) joined by two connectors.
import { clamp } from './util.js';

// Box: x1,z1,x2,z2 footprint, h top height, m material key (see world.js).
const b = (x1, z1, x2, z2, h, m) => ({ x1, z1, x2, z2, h, m });

export const BOXES = [
  // outer walls
  b(-42, -42, 42, -40, 6, 'brick'), b(-42, 40, 42, 42, 6, 'brick'),
  b(-42, -40, -40, 40, 6, 'brick'), b(40, -40, 42, 40, 6, 'brick'),
  // lane dividers and mid
  b(-20, 0, -12, 22, 5, 'brick'), b(12, 0, 20, 22, 5, 'brick'),
  b(-3, -5, 3, 5, 2.6, 'contBlue'),
  b(-12, -13, -5, -11, 4, 'concrete'), b(5, -13, 12, -11, 4, 'concrete'),
  b(-9, 10, -6, 12, 1.1, 'concrete'), b(6, -9, 9, -7, 1.1, 'concrete'),
  // defender spawn walls
  b(-14, -36, -12, -24, 5, 'brick'), b(12, -36, 14, -24, 5, 'brick'),
  b(-2, -24, 2, -22, 1.3, 'crateC'),
  // site A
  b(-36, -21, -33, -18, 1.8, 'crateA'), b(-24, -27, -20, -24, 2.4, 'crateB'),
  b(-30, -34, -26, -31, 1.8, 'crateC'), b(-22, -14, -19, -11.5, 1.1, 'concrete'),
  b(-29, -12, -26, -10, 1.2, 'crateB'), b(-38, -8, -32, -5.6, 2.6, 'contTeal'),
  // site B
  b(33, -22, 37, -18, 2.4, 'crateB'), b(22, -28, 28, -25.6, 2.6, 'contRed'),
  b(18, -18, 21, -15, 1.8, 'crateA'), b(28, -34, 31, -31, 1.8, 'crateC'),
  b(26, -12, 29, -10, 1.2, 'crateB'), b(32, -8, 38, -5.6, 2.6, 'contBlue'),
  // lane and plaza cover
  b(-38, 10, -34, 13, 1.8, 'crateA'), b(-30, 18, -26, 21, 1.2, 'crateC'),
  b(34, 6, 38, 10, 1.8, 'crateB'), b(26, 16, 30, 19, 1.8, 'crateC'),
  b(-10, 26, -7, 29, 1.8, 'crateA'), b(7, 26, 10, 29, 1.8, 'crateB'),
  b(-2, 22, 2, 24, 1.1, 'concrete'),
];

export const SITES = {
  A: { x: -26, z: -16, r: 6, name: 'A' },
  B: { x: 26, z: -16, r: 6, name: 'B' },
};

// Waypoints. Edges are built automatically from clear walking lines.
export const NODES = [
  ['ts1', -6, 34], ['ts2', 0, 34], ['ts3', 6, 34], ['ts4', -3, 30], ['ts5', 3, 30], ['tw', -22, 31], ['te', 22, 31],
  ['wl1', -24, 25], ['wl2', -24, 12], ['wl3', -24, 2], ['wl4', -26, -5],
  ['m1', 0, 19], ['m2', 0, 10], ['m3', -8, 0], ['m3b', 8, 0], ['m4', 0, -10], ['m5', 0, -18],
  ['el1', 24, 25], ['el2', 24, 12], ['el3', 24, 2], ['el4', 26, -5],
  ['a1', -26, -16], ['a2', -32, -24], ['a3', -18, -26], ['a4', -33, -32], ['a5', -18, -17], ['a6', -31, -14],
  ['b1', 26, -16], ['b2', 32, -25], ['b3', 24, -23], ['b4', 34, -32], ['b5', 18, -22], ['b6', 31, -14],
  ['c1', -5, -32], ['c2', 5, -32], ['c3', 0, -28], ['c4', -7, -26], ['c5', 7, -26],
  ['ca', -11, -18], ['cb', 11, -18], ['pw', -8, 20], ['pe', 8, 20],
].map(([id, x, z], i) => ({ id, i, x, z, adj: [] }));
export const NODE = Object.fromEntries(NODES.map((n) => [n.id, n]));

export const SPAWN = {
  south: [[-6, 35], [-3, 35], [0, 35], [3, 35], [6, 35]],
  north: [[-6, -35], [-3, -35], [0, -35], [3, -35], [6, -35]],
};
export const BOMB_NODE = 'ts2';

// ---- collision for walkers (circle against boxes, per-axis slide) ----
function pushOut(p, r) {
  for (const o of BOXES) {
    if (o.h <= p.y + 0.3) continue; // standing on top of it: not a wall
    const cx = clamp(p.x, o.x1, o.x2), cz = clamp(p.z, o.z1, o.z2);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.z = cz + (dz / d) * r;
    } else { // centre inside the box: leave by the nearest face
      const l = p.x - o.x1, rr = o.x2 - p.x, t = p.z - o.z1, bt = o.z2 - p.z;
      const m = Math.min(l, rr, t, bt);
      if (m === l) p.x = o.x1 - r; else if (m === rr) p.x = o.x2 + r;
      else if (m === t) p.z = o.z1 - r; else p.z = o.z2 + r;
    }
  }
}
export function moveXZ(p, dx, dz, r) {
  p.x += dx; pushOut(p, r);
  p.z += dz; pushOut(p, r);
}
export function blockedAt(x, z, r) {
  for (const o of BOXES) {
    const cx = clamp(x, o.x1, o.x2), cz = clamp(z, o.z1, o.z2);
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
  }
  return false;
}

// ---- rays ----
// Slab test of a segment against one box in 3D. Returns entry fraction 0..1 or -1.
function segBox(o, ax, ay, az, dx, dy, dz) {
  let t0 = 0, t1 = 1;
  const lo = [o.x1, 0, o.z1], hi = [o.x2, o.h, o.z2], a = [ax, ay, az], d = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (a[i] < lo[i] || a[i] > hi[i]) return -1;
    } else {
      let ta = (lo[i] - a[i]) / d[i], tb = (hi[i] - a[i]) / d[i];
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return -1;
    }
  }
  return t0;
}
// Nearest wall hit as a fraction of the segment, or 1 when clear. Floor hit counts too.
export function rayWorld(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  let best = 1;
  for (const o of BOXES) {
    const t = segBox(o, ax, ay, az, dx, dy, dz);
    if (t >= 0 && t < best) best = t;
  }
  if (by < 0 && dy < 0) best = Math.min(best, ay / -dy);
  return best;
}
export const lineClear = (ax, ay, az, bx, by, bz) => rayWorld(ax, ay, az, bx, by, bz) >= 1;

// ---- pathing ----
function walkClear(a, c, r) {
  const steps = Math.ceil(Math.hypot(c.x - a.x, c.z - a.z) / 0.8);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    if (blockedAt(a.x + (c.x - a.x) * t, a.z + (c.z - a.z) * t, r)) return false;
  }
  return true;
}
for (const n of NODES) {
  for (const m of NODES) {
    if (n !== m && Math.hypot(n.x - m.x, n.z - m.z) < 20 && walkClear(n, m, 0.5)) n.adj.push(m.i);
  }
}

export function nearestNode(x, z) {
  let best = 0, bd = 1e9;
  for (const n of NODES) {
    const d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bd && walkClear({ x, z }, n, 0.3)) { bd = d; best = n.i; }
    else if (d < bd * 0.2) { bd = d; best = n.i; }
  }
  return best;
}

// Dijkstra over the graph. Returns node indices from `from` to `to`, inclusive.
const distBuf = new Float32Array(NODES.length), prevBuf = new Int16Array(NODES.length);
export function findPath(from, to) {
  distBuf.fill(1e9); prevBuf.fill(-1); distBuf[from] = 0;
  const open = [from], done = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (distBuf[open[i]] < distBuf[open[bi]]) bi = i;
    const u = open.splice(bi, 1)[0];
    if (u === to) break;
    if (done.has(u)) continue;
    done.add(u);
    for (const v of NODES[u].adj) {
      const nd = distBuf[u] + Math.hypot(NODES[u].x - NODES[v].x, NODES[u].z - NODES[v].z);
      if (nd < distBuf[v]) { distBuf[v] = nd; prevBuf[v] = u; open.push(v); }
    }
  }
  const path = [];
  for (let c = to; c !== -1; c = prevBuf[c]) { path.push(c); if (c === from) break; }
  return path.reverse();
}

export const siteAt = (x, z) => {
  for (const k in SITES) if (Math.hypot(x - SITES[k].x, z - SITES[k].z) < SITES[k].r) return k;
  return '';
};
// Callout name of the closest named area, used by radio lines.
const AREAS = [['A site', -26, -22], ['B site', 26, -22], ['mid', 0, 8], ['west lane', -26, 8], ['east lane', 26, 8],
  ['CT spawn', 0, -30], ['T spawn', 0, 32], ['A connector', -11, -18], ['B connector', 11, -18], ['top mid', 0, -16]];
export function callout(x, z) {
  let best = '', bd = 1e9;
  for (const [n, ax, az] of AREAS) { const d = (x - ax) ** 2 + (z - az) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}
