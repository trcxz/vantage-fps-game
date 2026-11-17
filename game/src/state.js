// state.js: the single place the match state lives. Every other module reads and writes G;
// none keeps gameplay state of its own. The HUD only reads it.

export const G = {
  time: 0,            // simulation clock, seconds; frozen in screenshot mode
  frozen: false,      // true: the fixed-step loop stops stepping (screenshot mode)
  shot: '',           // name of the screenshot scene, '' in normal play

  phase: 'freeze',    // freeze | live | planted | over | match
  phaseT: 0,          // seconds left in the current phase
  elapsed: 0,         // seconds since the round went live
  round: 1,
  score: [0, 0],      // rounds won, by team index
  lossStreak: [0, 0],
  atk: 0,             // team index that attacks this half
  plan: ['', ''],     // each team's plan name this round
  planSite: 'A',      // site the attackers are heading for

  actors: [],         // player first, then bots (see round.js makeActor)
  player: null,

  bomb: {
    state: 'carried', // carried | dropped | planted | defused | exploded
    carrier: null, x: 0, z: 0, site: '',
    timer: 0, plantP: 0, defuseP: 0, user: null,
  },
  grenades: [],       // live projectiles (pooled in grenades.js)
  smokes: [],         // active smoke volumes {x, y, z, r, until}
  noise: [{ x: 0, z: 0, t: -99 }, { x: 0, z: 0, t: -99 }],   // last gunshot per team

  feed: [],           // killfeed entries {k, kt, v, vt, w, head, t}
  radio: [],          // radio lines {team, who, text, t}
  banner: { text: '', sub: '', until: -1, team: 0 },

  // What only the local player's screen needs.
  ui: {
    buy: false, scores: false, hitT: -9, hitHead: false,
    dmg: [{ ang: 0, t: -9 }, { ang: 0, t: -9 }, { ang: 0, t: -9 }], dmgI: 0,
    hurtT: -9, note: '', noteT: -9,
    free: null,       // free camera {x, y, z, pitch, yaw, fov} for the overview scene, else null
  },
};

// Plant or defuse progress (0..1) of actor `a`; 0 when it is not the one using the bomb.
export function bombProgress(a) {
  const B = G.bomb;
  if (B.user !== a) return 0;
  return B.state === 'carried' ? B.plantP : B.state === 'planted' ? B.defuseP : 0;
}

export function pushFeed(killer, victim, weapon, head) {
  G.feed.push({ k: killer.name, kt: killer.team, v: victim.name, vt: victim.team, w: weapon, head, t: G.time });
  if (G.feed.length > 6) G.feed.shift();
}

export function pushRadio(team, who, text) {
  G.radio.push({ team, who, text, t: G.time });
  if (G.radio.length > 8) G.radio.shift();
}

export function setBanner(text, sub, team, seconds) {
  G.banner.text = text;
  G.banner.sub = sub;
  G.banner.team = team;
  G.banner.until = G.time + seconds;
}

export function note(text) {
  G.ui.note = text;
  G.ui.noteT = G.time;
}
