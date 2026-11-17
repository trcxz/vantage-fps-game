// shots.js: deterministic screenshot scenes (?shot=cover|buy|plant|wide). Each one poses the real
// match state (actors, bomb, smoke, HUD data) and main.js then renders it through the normal code
// path with the simulation frozen. Nothing here draws anything itself.
import { G, pushFeed, pushRadio, setBanner } from './state.js';
import { yawTo } from './util.js';
import { giveWeapon, selectWeapon } from './actors.js';
import { seedRandom } from './util.js';

// Place actor i at (x,z) looking at (lx,lz).
function pose(i, x, z, lx, lz, cur, opts = {}) {
  const a = G.actors[i];
  a.x = x; a.z = z; a.y = 0; a.vx = a.vz = 0; a.alive = true; a.hp = opts.hp || 100;
  a.yaw = yawTo(lx - x, lz - z); a.pitch = opts.pitch || 0; a.crouch = !!opts.crouch;
  if (cur) { if (WEAPON_SLOT[cur] === 'primary') giveWeapon(a, cur); a.cur = cur; }
  if (a.bot) { a.bot.goals = []; a.bot.path = []; }
  return a;
}
const WEAPON_SLOT = { halberd: 'primary', wasp: 'primary', bulwark: 'primary', longsight: 'primary' };

function liveRound(t) {
  G.phase = 'live'; G.phaseT = t; G.elapsed = 20; G.ui.buy = false;
  G.banner.until = -1;
}

export function applyShot(name) {
  seedRandom(1234);
  const p = G.player;
  p.money = 2650;
  G.radio.length = 0; G.feed.length = 0; G.banner.until = -1;
  if (name === 'cover') {
    liveRound(78);
    G.score = [3, 2]; G.round = 6;
    giveWeapon(p, 'halberd'); p.armor = 100; p.cur = 'halberd'; p.mag.halberd = 24; p.reserve.halberd = 90;
    p.nades.smoke = 1; p.nades.frag = 1; p.nadeSel = 'frag';
    pose(0, -21, -4.5, -27, -16, 'halberd');
    p.hp = 82; p.flashShow = 0.05; p.mag.halberd = 24;
    pose(1, -24.6, -8.8, -29, -17, 'wasp', { crouch: false });
    pose(2, -17.5, -9.5, -28, -17, 'halberd');
    pose(3, -4, 14, 0, -10, 'wasp'); pose(4, 3, 20, 0, -10, 'halberd');
    pose(5, -28.2, -15.2, -22, -3, 'halberd');
    G.actors[5].flashShow = 0.05;
    pose(6, -24.5, -22.5, -22, -4, 'wasp');
    pose(7, 22, -20, 20, 0, 'halberd'); pose(8, 28, -18, 22, -4, 'wasp'); pose(9, 6, -30, 0, 0, 'wasp');
    G.actors[1].spotted = 9; G.actors[5].spotted = 9; G.actors[6].spotted = 9;
    G.ui.hitT = G.time - 0.05; G.ui.hitHead = false;
    G.ui.dmg[0].t = G.time - 0.3; G.ui.dmg[0].ang = 0.5;
    pushFeed(G.actors[2], G.actors[8], 'Halberd AR', true);
    pushFeed(G.actors[7], G.actors[3], 'Wasp MP', false);
    pushRadio(0, 'Brask', 'Contact, A site!');
    pushRadio(0, 'Odile', 'Two on A, long.');
    pushRadio(0, 'Comms', 'Plan: rush A.');
  } else if (name === 'buy') {
    G.phase = 'freeze'; G.phaseT = 11; G.elapsed = 0; G.ui.buy = true; G.round = 2; G.score = [1, 0];
    p.money = 3400; p.pistol = 'pike';
    p.x = 0; p.z = 35; p.yaw = 0; p.pitch = 0.04;
    pose(1, -2.2, 31.5, 0, 20, 'wasp'); pose(2, 2.4, 30, 0, 20, 'bulwark');
    pose(3, -5.5, 29, 0, 20, 'halberd'); pose(4, 6, 32, 0, 20, 'wasp');
    for (let i = 5; i < 10; i++) pose(i, -6 + (i - 5) * 3, -35, 0, 0, 'wasp');
        pushRadio(0, 'Comms', 'Plan: split.');
  } else if (name === 'plant') {
    liveRound(51);
    G.score = [4, 3]; G.round = 8;
    const B = G.bomb;
    p.hasBomb = true; B.carrier = p; B.state = 'carried'; B.plantP = 0.58; B.user = p; B.site = 'B';
    p.use = true; p.nades.frag = 1; p.nades.smoke = 1; p.nadeSel = 'smoke';
    giveWeapon(p, 'wasp'); p.cur = 'wasp'; p.armor = 60; p.hp = 100; p.crouch = true;
    p.mag.wasp = 19; p.flashShow = 0;
    pose(0, 26.5, -15, 24, -24, 'wasp', { crouch: true });
    p.crouch = true;
    G.smokes.push({ x: 20.5, y: 1.4, z: -22, r: 4.2, until: G.time + 12 });
    G.smokes.push({ x: 31, y: 1.4, z: -22.5, r: 4.2, until: G.time + 12 });
    pose(1, 22, -12, 21, -22, 'halberd', { crouch: true }); pose(2, 30, -11, 30, -22, 'wasp');
    pose(3, 25, -6, 25, -20, 'halberd'); pose(4, 33, -13, 29, -25, 'wasp');
    pose(5, 28.5, -24, 26.5, -15, 'halberd'); pose(6, 36, -29, 27, -17, 'wasp');
    pose(7, 18, -26.5, 25, -17, 'bulwark'); pose(8, 24, -30, 26, -17, 'halberd'); pose(9, 31.5, -34, 28, -20, 'wasp');
    G.actors[5].spotted = 9; G.actors[1].spotted = 9;
    G.ui.dmg[1].t = G.time - 0.5; G.ui.dmg[1].ang = -0.8;
    pushRadio(0, 'Odile', 'Covering you, plant it!');
    pushRadio(0, 'Verro', 'Smoke is up at B.');
    pushFeed(G.actors[1], G.actors[9], 'Halberd AR', false);
  } else {
    // wide: free camera over the whole map, bots spread along their routes
    liveRound(64);
    G.score = [2, 2]; G.round = 5;
    G.ui.free = { x: 0, y: 40, z: 33, pitch: -1.05, yaw: 0, fov: 60 };
    const spots = [[-22, 22], [-8, 14], [0, 3], [8, 12], [22, 20], [-25, -8], [-12, -14], [26, -8], [6, -28], [-3, -25]];
    spots.forEach(([x, z], i) => pose(i, x, z, i < 5 ? x * 0.5 : 0, i < 5 ? -30 : 20, i % 3 ? 'wasp' : 'halberd'));
    G.actors[0].alive = true;
    G.smokes.push({ x: -26, y: 1.4, z: -22, r: 4.2, until: G.time + 12 });
    G.actors[3].alive = true;
    pushRadio(0, 'Comms', 'Plan: split.');
    pushFeed(G.actors[2], G.actors[7], 'Wasp MP', false);
  }
}
