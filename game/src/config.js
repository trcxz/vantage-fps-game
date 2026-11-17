// config.js: every tunable number and table of VANTAGE lives here, so balance is one file.
// Nothing in this module has behaviour; it is data only.

export const CELL = 2.4;          // metres per map cell
export const STEP = 1 / 60;       // fixed simulation step (seconds)

// Two squads with a fixed identity; which one attacks swaps at half time (see round.js).
export const TEAMS = [
  { name: 'CORSAIRS', css: '#f39242', cloth: 0xd9772b, dark: 0x3d2a20, skin: 0xc99a76 },
  { name: 'WARDENS', css: '#45cfc6', cloth: 0x2b9d99, dark: 0x22343c, skin: 0xb98a68 },
];
export const NAMES = [
  ['You', 'Brask', 'Odile', 'Tamsin', 'Verro'],
  ['Halloran', 'Quill', 'Sorrel', 'Maddox', 'Ines'],
];

// Movement (Quake-style acceleration and friction, see movement.js).
export const MOVE = {
  run: 5.2, walkMul: 0.5, crouchMul: 0.4,
  accel: 9, airAccel: 1.2, friction: 7, stopSpeed: 1.6,
  jump: 5.6, gravity: 15, radius: 0.36,
  eye: 1.62, eyeCrouch: 1.06, stepUp: 0.3,
};

// Weapons. spread/bloom/kick are radians. `pen` is the share of damage that goes through armour.
// `moveSpread` is added at full run speed: this is what makes stopping to aim pay.
export const WEAPONS = {
  knife: {
    id: 'knife', name: 'Gutting Knife', slot: 'knife', price: 0, melee: true,
    dmg: 50, head: 1.6, pen: 0.9, interval: 0.55, mag: 1, reserve: 0, reload: 0, auto: true,
    pellets: 1, spread: 0, moveSpread: 0, bloom: 0, bloomMax: 0, kickV: 0.02, kickH: 0,
    range: 2.2, falloff: 99, speed: 1.08, reward: 1500, tone: 0,
  },
  pike: {
    id: 'pike', name: 'Pike-9', slot: 'pistol', price: 0,
    dmg: 27, head: 4, pen: 0.5, interval: 0.16, mag: 12, reserve: 48, reload: 1.9, auto: false,
    pellets: 1, spread: 0.007, moveSpread: 0.03, bloom: 0.012, bloomMax: 0.05, kickV: 0.016, kickH: 0.004,
    range: 90, falloff: 22, speed: 1, reward: 300, tone: 1.25,
  },
  anvil: {
    id: 'anvil', name: 'Anvil .44', slot: 'pistol', price: 700,
    dmg: 56, head: 3.4, pen: 0.85, interval: 0.34, mag: 7, reserve: 28, reload: 2.2, auto: false,
    pellets: 1, spread: 0.005, moveSpread: 0.05, bloom: 0.03, bloomMax: 0.08, kickV: 0.045, kickH: 0.008,
    range: 90, falloff: 30, speed: 0.98, reward: 300, tone: 0.8,
  },
  wasp: {
    id: 'wasp', name: 'Wasp MP', slot: 'primary', price: 1250,
    dmg: 24, head: 3.6, pen: 0.55, interval: 0.075, mag: 30, reserve: 90, reload: 2.2, auto: true,
    pellets: 1, spread: 0.011, moveSpread: 0.016, bloom: 0.004, bloomMax: 0.045, kickV: 0.009, kickH: 0.006,
    range: 80, falloff: 16, speed: 0.97, reward: 600, tone: 1.45,
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark 12', slot: 'primary', price: 1300,
    dmg: 17, head: 1.8, pen: 0.6, interval: 0.85, mag: 6, reserve: 24, reload: 2.8, auto: false,
    pellets: 8, spread: 0.055, moveSpread: 0.012, bloom: 0, bloomMax: 0, kickV: 0.07, kickH: 0.01,
    range: 40, falloff: 7, speed: 0.93, reward: 900, tone: 0.55,
  },
  halberd: {
    id: 'halberd', name: 'Halberd AR', slot: 'primary', price: 2900,
    dmg: 33, head: 4, pen: 0.8, interval: 0.1, mag: 30, reserve: 90, reload: 2.4, auto: true,
    pellets: 1, spread: 0.0035, moveSpread: 0.065, bloom: 0.0045, bloomMax: 0.05, kickV: 0.013, kickH: 0.007,
    range: 120, falloff: 40, speed: 0.9, reward: 300, tone: 1,
  },
  longsight: {
    id: 'longsight', name: 'Longsight', slot: 'primary', price: 4600, zoom: 24,
    dmg: 105, head: 2.6, pen: 0.95, interval: 1.4, mag: 5, reserve: 20, reload: 3.4, auto: false,
    pellets: 1, spread: 0.0006, moveSpread: 0.12, bloom: 0, bloomMax: 0, kickV: 0.09, kickH: 0.01,
    range: 160, falloff: 999, speed: 0.82, reward: 100, tone: 0.42,
  },
};

// Grenades: fuse in seconds, radius in metres.
export const NADES = {
  frag: { name: 'Frag', price: 300, fuse: 1.7, radius: 7.5, dmg: 105 },
  flash: { name: 'Flash', price: 200, fuse: 1.4, radius: 26, blind: 3.2 },
  smoke: { name: 'Smoke', price: 300, fuse: 1.6, radius: 4.2, life: 14 },
};
export const NADE_ORDER = ['frag', 'flash', 'smoke'];

// The buy menu, in the order it is drawn. `key` is the keyboard shortcut while the menu is open.
export const SHOP = [
  { key: '1', kind: 'weapon', id: 'anvil', note: 'Heavy pistol. Two to the chest.' },
  { key: '2', kind: 'weapon', id: 'wasp', note: 'SMG. Accurate on the move.' },
  { key: '3', kind: 'weapon', id: 'bulwark', note: 'Shotgun. Owns doorways.' },
  { key: '4', kind: 'weapon', id: 'halberd', note: 'Rifle. Stop, then tap heads.' },
  { key: '5', kind: 'weapon', id: 'longsight', note: 'Sniper. Right mouse to scope.' },
  { key: '6', kind: 'armor', id: 'armor', name: 'Plate Vest', price: 650, note: 'Absorbs body and head damage.' },
  { key: '7', kind: 'nade', id: 'frag', note: 'Clears a corner.' },
  { key: '8', kind: 'nade', id: 'flash', note: 'Blinds whoever looks at it.' },
  { key: '9', kind: 'nade', id: 'smoke', note: 'Blocks a sightline for 14 s.' },
  { key: '0', kind: 'kit', id: 'kit', name: 'Defuse Kit', price: 400, note: 'Halves the defuse time.' },
];

export const ECON = {
  start: 800, max: 12000, win: 3000, lose: 1400, loseStep: 500, loseMax: 2900,
  plant: 300, defuse: 300, buyWindow: 18,
};

export const ROUND = {
  freeze: 7, live: 105, fuse: 40, plant: 3.2, defuse: 10, defuseKit: 5, over: 5,
  half: 6, win: 7, matchOver: 9,
};
