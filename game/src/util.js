// util.js: small maths helpers and the one seeded random source the simulation uses.
// Every gameplay roll goes through rand(), so a fixed seed replays the same round
// (the screenshot mode relies on that).

export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

let seedState = 1;
export function seedRandom(n) {
  seedState = n >>> 0 || 1;
}
// mulberry32
export function rand() {
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randRange = (a, b) => a + (b - a) * rand();
export const pick = (list) => list[Math.floor(rand() * list.length)];

// Shortest signed difference a - b, wrapped to (-PI, PI].
export function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return d;
}
// Yaw that faces along (dx, dz). Yaw 0 looks down -Z, like a three.js camera.
export const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
// Step `cur` toward `target` by at most `maxStep` radians.
export function turnToward(cur, target, maxStep) {
  const d = angleDiff(target, cur);
  return cur + clamp(d, -maxStep, maxStep);
}
export const fmtTime = (s) => {
  const t = Math.max(0, Math.ceil(s));
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
};
