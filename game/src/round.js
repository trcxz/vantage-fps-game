// round.js: the match rules. Round phases (freeze/live/planted/over), team plans, bot buying,
// bomb plant/defuse, economy, half-time side swap, match end. Runs inside the fixed step.
import { G, setBanner, pushRadio } from './state.js';
import { TEAMS, ECON, ROUND, WEAPONS, NADES } from './config.js';
import { rand, randRange, pick, yawTo, clamp } from './util.js';
import { SPAWN, NODES, nearestNode, siteAt } from './map.js';
import { makeActor, resetLoadout, giveWeapon, selectWeapon, bestWeapon } from './actors.js';
import { makeBrain, setRoute } from './bots.js';

export const roundHooks = { planted: () => {}, defused: () => {}, exploded: () => {}, over: () => {}, begin: () => {} };
const WINS_NEEDED = 7;
const HALF_AT = 6; // rounds played before sides swap

function createActors() {
  G.actors = [];
  for (let t = 0; t < 2; t++) for (let s = 0; s < 5; s++) {
    const a = makeActor(t, s, t === 0 && s === 0);
    if (!a.isPlayer) a.bot = makeBrain(randRange(0.62, 0.95));
    G.actors.push(a);
  }
  G.player = G.actors[0];
}
const teamOf = (t) => G.actors.filter((a) => a.team === t);

// ---- buying ----
// Returns '' on success or the reason it failed (shown in the buy menu).
export function buyItem(a, item) {
  if (G.phase !== 'freeze' && !(G.phase === 'live' && G.elapsed < 8)) return 'Buy time is over';
  const price = item.kind === 'weapon' ? WEAPONS[item.id].price : item.kind === 'nade' ? NADES[item.id].price : item.price;
  if (a.money < price) return 'Not enough money';
  if (item.kind === 'weapon') {
    const w = WEAPONS[item.id];
    if ((w.slot === 'primary' ? a.primary : a.pistol) === item.id) return 'Already owned';
    a.money -= price; giveWeapon(a, item.id); selectWeapon(a, bestWeapon(a));
  } else if (item.kind === 'armor') {
    if (a.armor >= 100) return 'Already armoured';
    a.money -= price; a.armor = 100;
  } else if (item.kind === 'nade') {
    if (a.nades[item.id] >= 2) return 'Carrying the maximum';
    a.money -= price; a.nades[item.id]++; a.nadeSel = item.id;
  } else {
    if (a.kit) return 'Already owned';
    if (a.team === G.atk) return 'Defenders only';
    a.money -= price; a.kit = true;
  }
  return '';
}

// Bots spend what they have: armour first on a half-way budget, then the best affordable gun.
function botBuy(a) {
  const m = a.money;
  const full = m >= 4000;
  if (m >= 4600 && rand() < 0.4) buyItem(a, { kind: 'weapon', id: 'longsight' });
  else if (m >= 2900 + 650) { buyItem(a, { kind: 'weapon', id: 'halberd' }); buyItem(a, { kind: 'armor', price: 650 }); }
  else if (m >= 1300) buyItem(a, { kind: 'weapon', id: rand() < 0.5 ? 'wasp' : 'bulwark' });
  else if (m >= 700 && rand() < 0.5) buyItem(a, { kind: 'weapon', id: 'anvil' });
  if (a.money >= 650 + 300 && !a.armor) buyItem(a, { kind: 'armor', price: 650 });
  if (a.money >= 300 && rand() < (full ? 0.9 : 0.4)) buyItem(a, { kind: 'nade', id: pick(['frag', 'flash', 'smoke']) });
  if (a.team !== G.atk && a.money >= 400 && rand() < 0.6) buyItem(a, { kind: 'kit', price: 400 });
}

// ---- plans ----
// Attacker plans: rush A, rush B, split, default (slow mid then commit). Defender plans: stack A, stack B, default, aggressive.
const A_ROUTES = {
  A: ['ts2', 'pw', 'm2', 'm3', 'ca', 'a5', 'a1'],
  Awest: ['ts1', 'tw', 'wl1', 'wl2', 'wl3', 'wl4', 'a6', 'a1'],
  B: ['ts2', 'pe', 'm2', 'm3b', 'cb', 'b5', 'b1'],
  Beast: ['ts3', 'te', 'el1', 'el2', 'el3', 'el4', 'b6', 'b1'],
};
const D_HOLD = {
  A: [['a2', 0.4], ['a3', -1.2], ['a4', 0.8], ['a5', 1.0], ['a6', 2.4]],
  B: [['b2', -0.4], ['b3', 1.2], ['b4', -0.8], ['b5', -1.0], ['b6', -2.4]],
  M: [['m4', 3.1], ['c3', 3.1], ['ca', 1.4], ['cb', -1.4], ['c4', 3.1]],
};

function assignPlans() {
  const atkPlan = pick(['rush A', 'rush B', 'split', 'default']);
  const defPlan = pick(['stack A', 'stack B', 'default', 'aggressive']);
  G.plan[G.atk] = atkPlan; G.plan[1 - G.atk] = defPlan;
  G.planSite = atkPlan === 'rush B' ? 'B' : atkPlan === 'rush A' ? 'A' : rand() < 0.5 ? 'A' : 'B';
  const atk = teamOf(G.atk).filter((a) => !a.isPlayer), def = teamOf(1 - G.atk).filter((a) => !a.isPlayer);
  atk.forEach((a, i) => {
    let key;
    if (atkPlan === 'split') key = i % 2 ? 'Beast' : 'Awest';
    else if (atkPlan === 'default') key = i < 2 ? G.planSite + (G.planSite === 'A' ? 'west' : 'east') : G.planSite;
    else key = atkPlan === 'rush A' ? (i === 0 ? 'Awest' : 'A') : i === 0 ? 'Beast' : 'B';
    key = key === 'Bwest' ? 'B' : key === 'Aeast' ? 'A' : key;
    const delay = atkPlan === 'default' ? 8 + i * 2 : i * 0.4;
    const route = A_ROUTES[key] || A_ROUTES.A;
    setRoute(a, route, yawTo(0, -1), delay);
  });
  def.forEach((a, i) => {
    const mix = defPlan === 'stack A' ? ['A', 'A', 'A', 'B', 'M'] : defPlan === 'stack B' ? ['B', 'B', 'B', 'A', 'M'] : defPlan === 'aggressive' ? ['M', 'M', 'A', 'B', 'M'] : ['A', 'A', 'B', 'B', 'M'];
    const hold = D_HOLD[mix[i % 5]], [id, yaw] = hold[i % hold.length];
    setRoute(a, ['c3', id], yaw, defPlan === 'aggressive' ? 3 : 0);
  });
  // Bot teammates of the player get their routes from the same plan; the player picks his own.
}

// Bots reposition after bomb events: attackers on the site guard the bomb; defenders retake.
function retakePlan() {
  const site = G.bomb.site;
  const route = site === 'A' ? ['c3', 'c4', 'ca', 'a5', 'a1'] : ['c3', 'c5', 'cb', 'b5', 'b1'];
  for (const a of G.actors) {
    if (!a.bot || !a.alive) continue;
    if (a.team === G.atk) setRoute(a, [site === 'A' ? 'a5' : 'b5', site === 'A' ? 'a2' : 'b2'], site === 'A' ? 0.5 : -0.5, 0);
    else setRoute(a, route, yawTo(0, -1), 0);
  }
  G.plan[1 - G.atk] = 'retake';
  pushRadio(1 - G.atk, 'Comms', `Bomb planted ${site}. Retake!`);
}

// ---- round lifecycle ----
function startRound() {
  G.phase = 'freeze'; G.phaseT = ROUND.freeze; G.elapsed = 0;
  G.grenades.length = 0; G.smokes.length = 0;
  G.bomb = { state: 'carried', carrier: null, x: 0, z: 0, site: '', timer: 0, plantP: 0, defuseP: 0, user: null };
  const spots = { [G.atk]: SPAWN.south, [1 - G.atk]: SPAWN.north };
  for (const t of [0, 1]) teamOf(t).forEach((a, i) => {
    const keep = a.alive && G.round > 1 && G.round !== HALF_AT + 1 && a.keepGear;
    if (!keep) resetLoadout(a);
    a.alive = true; a.hp = 100; a.roundKills = 0;
    const [x, z] = spots[t][i];
    a.x = x; a.z = z; a.y = 0; a.vx = a.vy = a.vz = 0; a.crouch = false; a.reloadT = 0; a.cool = 0.3; a.flashT = 0; a.bloom = 0;
    a.yaw = t === G.atk ? 0 : Math.PI; a.pitch = 0; a.cur = bestWeapon(a); a.keepGear = false;
    if (a.bot) { a.bot.target = null; a.bot.lastSeen.t = -99; a.bot.lookT = 0; }
    if (a.mag[a.cur] === undefined) a.cur = 'pike';
  });
  for (const a of G.actors) {
    a.money = clamp(a.money, 0, ECON.max);
    if (a.bot) botBuy(a);
  }
  const carrier = teamOf(G.atk).filter((a) => !a.isPlayer)[Math.floor(rand() * 4)];
  carrier.hasBomb = true; G.bomb.carrier = carrier;
  assignPlans();
  // The plan order is spoken by the team leader.
  pushRadio(G.atk, 'Comms', `Plan: ${G.plan[G.atk]}.`);
  setBanner(`ROUND ${G.round}`, `${TEAMS[G.player.team].name} ${G.player.team === G.atk ? 'attack' : 'defend'}`, G.player.team, 3);
  G.ui.buy = G.phase === 'freeze' && !G.frozen;
  roundHooks.begin();
}

function endRound(winner, reason) {
  if (G.phase === 'over' || G.phase === 'match') return;
  G.phase = 'over'; G.phaseT = ROUND.over;
  G.score[winner]++;
  const lossTeam = 1 - winner;
  G.lossStreak[lossTeam] = Math.min(4, G.lossStreak[lossTeam] + 1); G.lossStreak[winner] = 0;
  for (const a of G.actors) {
    const bonus = a.team === winner ? ECON.win : Math.min(ECON.loseMax, ECON.lose + ECON.loseStep * (G.lossStreak[a.team] - 1));
    a.money = Math.min(ECON.max, a.money + bonus);
    a.keepGear = a.alive;
  }
  if (G.bomb.state === 'defused') for (const a of teamOf(1 - G.atk)) a.money = Math.min(ECON.max, a.money + ECON.defuse);
  if (G.bomb.state === 'exploded' || G.bomb.state === 'planted') for (const a of teamOf(G.atk)) a.money = Math.min(ECON.max, a.money + ECON.plant);
  setBanner(winner === G.player.team ? 'ROUND WON' : 'ROUND LOST', reason, winner, ROUND.over - 0.5);
  roundHooks.over(winner);
  if (G.score[winner] >= WINS_NEEDED) {
    G.phase = 'match'; G.phaseT = ROUND.matchOver;
    setBanner(winner === G.player.team ? 'MATCH WON' : 'MATCH LOST', `${G.score[0]} - ${G.score[1]}`, winner, ROUND.matchOver);
  }
}

function nextRound() {
  if (G.phase === 'match') { G.round = 0; G.score = [0, 0]; G.lossStreak = [0, 0]; G.atk = 0; for (const a of G.actors) { a.money = ECON.start; a.keepGear = false; a.kills = a.deaths = 0; } }
  G.round++;
  if (G.round === HALF_AT + 1) { // half time: swap sides, reset money
    G.atk = 1 - G.atk;
    for (const a of G.actors) { a.money = ECON.start; a.keepGear = false; }
    G.lossStreak = [0, 0];
  }
  startRound();
}

// Living members of team t (counted in place: this runs every step).
function alive(t) {
  let n = 0;
  for (const a of G.actors) if (a.team === t && a.alive) n++;
  return n;
}

// ---- bomb ----
function stepBomb(dt) {
  const B = G.bomb;
  if (B.state === 'carried') {
    const c = B.carrier;
    if (!c || !c.alive) { // drop at the carrier's feet, anyone on the attack side can pick up
      B.state = 'dropped'; B.x = c ? c.x : 0; B.z = c ? c.z : 0; B.carrier = null;
      return;
    }
    B.x = c.x; B.z = c.z;
    const site = siteAt(c.x, c.z);
    const planting = site && c.use && G.phase === 'live' && c.alive && Math.hypot(c.vx, c.vz) < 0.8;
    if (planting) {
      B.plantP += dt / ROUND.plant; B.site = site; B.user = c;
      if (B.plantP >= 1) {
        B.state = 'planted'; B.timer = ROUND.fuse; c.hasBomb = false; B.carrier = null; B.plantP = 0;
        G.phase = 'planted'; G.phaseT = ROUND.fuse; B.x = c.x; B.z = c.z;
        roundHooks.planted(site);
        pushRadio(G.atk, c.name, `Bomb is down at ${site}.`);
        retakePlan();
      }
    } else B.plantP = Math.max(0, B.plantP - dt * 2);
  } else if (B.state === 'dropped') {
    for (const a of G.actors) if (a.team === G.atk && a.alive && Math.hypot(a.x - B.x, a.z - B.z) < 1.2) { B.state = 'carried'; B.carrier = a; a.hasBomb = true; pushRadio(a.team, a.name, 'Got the bomb.'); break; }
    if (B.state === 'dropped' && G.phase === 'live') {
      // a living attacking bot goes to fetch it
      const f = G.actors.find((a) => a.team === G.atk && a.bot && a.alive && !a.fetch);
      if (f) { f.fetch = true; const n = NODES[nearestNode(B.x, B.z)]; setRoute(f, [n.id], 0, 0); }
    }
  } else if (B.state === 'planted') {
    B.timer -= dt;
    // defuse: nearest defender with `use` pressed within 1.6 m
    const d = G.actors.find((a) => a.team !== G.atk && a.alive && a.use && Math.hypot(a.x - B.x, a.z - B.z) < 1.8 && Math.hypot(a.vx, a.vz) < 0.8);
    if (d) {
      B.user = d; B.defuseP += dt / (d.kit ? ROUND.defuseKit : ROUND.defuse);
      if (B.defuseP >= 1) { B.state = 'defused'; G.phase = 'planted'; roundHooks.defused(); endRound(1 - G.atk, 'Bomb defused'); }
    } else { B.defuseP = Math.max(0, B.defuseP - dt * 0.5); B.user = null; }
    if (B.timer <= 0 && B.state === 'planted') { B.state = 'exploded'; roundHooks.exploded(B.x, B.z); endRound(G.atk, 'Bomb detonated'); }
  }
}

// Bots use the bomb: a defender bot on retake walks to the bomb and defuses when close.
function botObjectives() {
  const B = G.bomb;
  if (B.state !== 'planted') return;
  for (const a of G.actors) {
    if (a.team === G.atk || !a.bot || !a.alive) continue;
    const d = Math.hypot(a.x - B.x, a.z - B.z);
    // only commit once the site looks safe (no enemy seen for 1.5 s) or time is short
    const safe = !a.bot.target && G.time - a.bot.lastSeen.t > 1.5;
    a.use = d < 1.7 && (safe || B.timer < 9);
    if (d < 1.7 && a.use) { a.bot.goals = []; a.bot.path = []; }
  }
}

export function stepRound(dt) {
  G.time += dt;
  if (G.phase === 'freeze') {
    G.phaseT -= dt;
    if (G.phaseT <= 0) { G.phase = 'live'; G.phaseT = ROUND.live; G.ui.buy = false; setBanner('GO', '', G.player.team, 1.2); }
    return;
  }
  if (G.phase === 'over' || G.phase === 'match') {
    G.phaseT -= dt;
    if (G.phaseT <= 0) nextRound();
    return;
  }
  G.elapsed += dt;
  stepBomb(dt);
  botObjectives();
  if (G.phase === 'live') {
    G.phaseT -= dt;
    if (G.phaseT <= 0) { endRound(1 - G.atk, 'Time ran out'); return; }
  } else if (G.phase === 'planted') G.phaseT = Math.max(0, G.bomb.timer);
  const aA = alive(G.atk), aD = alive(1 - G.atk);
  if (G.phase === 'planted' && G.bomb.state === 'planted') { if (aD === 0) endRound(G.atk, 'Defenders eliminated'); }
  else if (G.phase === 'live') {
    if (aD === 0) endRound(G.atk, 'Defenders eliminated');
    else if (aA === 0) endRound(1 - G.atk, 'Attackers eliminated');
  }
}

export function initMatch() {
  createActors();
  G.round = 1; G.score = [0, 0]; G.atk = 0;
  for (const a of G.actors) a.money = ECON.start;
  startRound();
}
