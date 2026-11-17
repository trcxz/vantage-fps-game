// hud.js: DOM + 2D canvas overlay. Creates every element once, then updateHud() only changes
// text/styles. Reads G; never writes gameplay state (buying goes through the onBuy callback).
import { G } from './state.js';
import { TEAMS, SHOP, WEAPONS, NADES } from './config.js';
import { BOXES, SITES } from './map.js';
import { fmtTime } from './util.js';
import { curW } from './actors.js';

const $ = {};   // element cache by key
const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent.appendChild(e);
  return e;
};
let mapCtx = null, buyCb = null, buySig = '';
const FEED_SEC = 7, RADIO_SEC = 8;

export function buildHud(root, onBuy) {
  buyCb = onBuy;
  $.top = el('div', 'top panel', root);
  $.s0 = el('div', 's c0', $.top, '0');
  $.t = el('div', 't', $.top, '');
  $.s1 = el('div', 's c1', $.top, '0');
  $.bomb = el('div', 'bomb panel', root);
  $.hp = el('div', 'hp panel', root,
    '<div class="row"><div><div class="lbl">HEALTH</div><div class="big" id="hpv">100</div></div><div><div class="lbl">ARMOUR</div><div class="big" id="arv">0</div></div></div><div class="bar"><i id="hpb"></i></div><div class="money" id="mon"></div>');
  $.ammo = el('div', 'ammo panel', root,
    '<div class="gun" id="gun"></div><div class="big"><span id="mag"></span> <b id="res"></b></div><div class="slots" id="slots"></div>');
  $.help = el('div', 'help', root,
    'WASD move · mouse look · arrows turn · click fire · R reload<br>1-5 weapons · G throw grenade · F cycle grenade · E plant/defuse<br>shift walk · ctrl crouch · space jump · B buy · Tab scores');
  $.cmap = el('canvas', '', root);
  $.cmap.id = 'cmap'; $.cmap.width = 172; $.cmap.height = 172;
  mapCtx = $.cmap.getContext('2d');
  $.feed = el('div', 'feed', root);
  $.radio = el('div', 'radio', root);
  $.vig = el('div', 'vig', root);
  $.dmg = el('div', 'dmg', root);
  $.dmgI = [0, 1, 2].map(() => el('i', '', $.dmg));
  $.scope = el('div', 'scope', root); $.scope.hidden = true;
  const c = el('div', 'cross', root);
  $.cross = [['h', -11, 0], ['h', 4, 0], ['v', 0, -11], ['v', 0, 4]].map(([k, x, y]) => {
    const i = el('i', k, c); i.dataset.x = x; i.dataset.y = y; return i;
  });
  $.hitm = el('div', 'hitm', root);
  $.flashw = el('div', 'flashw', root);
  $.banner = el('div', 'banner', root, '<h1></h1><p></p>');
  $.note = el('div', 'note', root);
  $.prog = el('div', 'prog panel', root, '<div class="lbl" id="plbl"></div><div class="bar"><i id="pbar"></i></div>');
  $.buy = el('div', 'buy panel', root);
  $.score = el('div', 'score panel', root);
  $.buy.hidden = $.score.hidden = $.prog.hidden = true;
}

// Weapon label with the key used to select it.
const slotText = (a) => {
  const s = [];
  const mk = (k, id) => id && s.push(a.cur === id ? `<u>${k}:${WEAPONS[id].name}</u>` : `${k}:${WEAPONS[id].name}`);
  mk(1, a.primary); mk(2, a.pistol); mk(3, 'knife');
  const n = Object.keys(a.nades).filter((k) => a.nades[k] > 0).map((k) => `${NADES[k].name}${a.nades[k] > 1 ? 'x' + a.nades[k] : ''}${a.nadeSel === k ? '*' : ''}`);
  return s.join(' ') + (n.length ? '<br>' + n.join(' ') : '');
};

// Buy menu: rebuilt only when what it shows changes (signature), so clicks are never lost mid-frame.
function drawBuy(p) {
  const sig = [p.money, p.primary, p.pistol, p.armor, p.kit, G.ui.note, p.nades.frag, p.nades.flash, p.nades.smoke, G.atk].join('|');
  if (sig === buySig) return;
  buySig = sig;
  let h = `<h2>ARMOURY<span>$${p.money}</span></h2><div class="g">`;
  for (const it of SHOP) {
    const w = it.kind === 'weapon' ? WEAPONS[it.id] : null;
    const price = w ? w.price : it.kind === 'nade' ? NADES[it.id].price : it.price;
    const name = w ? w.name : it.kind === 'nade' ? NADES[it.id].name : it.name;
    const own = (w && (p.primary === it.id || p.pistol === it.id)) || (it.kind === 'armor' && p.armor >= 100) || (it.kind === 'kit' && p.kit);
    h += `<div class="it${price > p.money ? ' no' : ''}${own ? ' own' : ''}" data-k="${it.key}"><span class="k">${it.key}</span><div><div class="n">${name}</div><div class="d">${it.note}</div></div><span class="p">$${price}</span></div>`;
  }
  h += `</div><div class="foot">Press the number key or click. Enter / B closes. ${G.ui.note ? `<span class="err">${G.ui.note}</span>` : ''}</div>`;
  $.buy.innerHTML = h;
  for (const n of $.buy.querySelectorAll('.it')) n.onclick = () => buyCb(SHOP.find((s) => s.key === n.dataset.k));
}

function drawScore() {
  let h = '<table><tr><th>PLAYER</th><th>MONEY</th><th>K</th><th>D</th><th>DMG</th></tr>';
  for (const t of [0, 1]) {
    h += `<tr><td colspan="5" style="color:${TEAMS[t].css};letter-spacing:3px">${TEAMS[t].name} ${t === G.atk ? '(attack)' : '(defend)'} · ${G.score[t]}</td></tr>`;
    for (const a of G.actors.filter((x) => x.team === t)) {
      h += `<tr class="${a.isPlayer ? 'me' : ''}${a.alive ? '' : ' dead'}"><td>${a.name}</td><td>$${a.money}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.dmgDealt}</td></tr>`;
    }
  }
  $.score.innerHTML = h + '</table>';
}

// ---- minimap: static walls drawn from BOXES each update (cheap: ~40 rects), actors as dots ----
const MS = 172 / 90, mx = (x) => (x + 45) * MS, mz = (z) => (z + 45) * MS;
function drawMap(p) {
  const g = mapCtx;
  g.clearRect(0, 0, 172, 172);
  g.fillStyle = '#8f7f98';
  for (const o of BOXES) g.fillRect(mx(o.x1), mz(o.z1), (o.x2 - o.x1) * MS, (o.z2 - o.z1) * MS);
  g.fillStyle = '#ffd166'; g.font = 'bold 14px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const k in SITES) g.fillText(k, mx(SITES[k].x), mz(SITES[k].z));
  for (const a of G.actors) {
    if (!a.alive) continue;
    if (a.team !== p.team && !(a.spotted > G.time)) continue;
    g.fillStyle = TEAMS[a.team].css;
    g.beginPath(); g.arc(mx(a.x), mz(a.z), a === p ? 4 : 3, 0, 6.3); g.fill();
    if (a === p) {
      g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(mx(a.x), mz(a.z));
      g.lineTo(mx(a.x - Math.sin(a.yaw) * 7), mz(a.z - Math.cos(a.yaw) * 7)); g.stroke();
    }
  }
  const B = G.bomb;
  if (B.state === 'planted' || B.state === 'dropped') { g.fillStyle = B.state === 'planted' ? '#ff4a3a' : '#fff'; g.fillRect(mx(B.x) - 3, mz(B.z) - 3, 6, 6); }
}

const fmtCrossGap = (spread) => Math.min(60, 4 + spread * 520);

export function updateHud(p, spread) {
  const w = curW(p);
  $.s0.textContent = G.score[p.team];
  $.s1.textContent = G.score[1 - p.team];
  $.s0.className = 's c' + p.team; $.s1.className = 's c' + (1 - p.team);
  const tm = G.phase === 'planted' ? Math.max(0, G.bomb.timer) : G.phaseT;
  $.t.innerHTML = `${fmtTime(tm)}<small>ROUND ${G.round} · ${G.phase === 'freeze' ? 'BUY TIME' : G.phase === 'planted' ? 'BOMB' : TEAMS[G.atk].name + ' ATK'}</small>`;
  $.bomb.hidden = G.bomb.state !== 'planted';
  if (!$.bomb.hidden) $.bomb.textContent = `BOMB PLANTED ${G.bomb.site} · ${G.bomb.timer.toFixed(1)}`;
  const hpEl = document.getElementById('hpv');
  hpEl.textContent = Math.max(0, Math.ceil(p.hp));
  document.getElementById('arv').textContent = Math.ceil(p.armor);
  const hb = document.getElementById('hpb');
  hb.style.width = Math.max(0, p.hp) + '%'; hb.style.background = p.hp > 50 ? '#7be87b' : p.hp > 25 ? '#ffd166' : '#ff5a4a';
  document.getElementById('mon').textContent = '$' + p.money;
  document.getElementById('gun').textContent = w.name.toUpperCase() + (p.reloadT > 0 ? ' · RELOADING' : '');
  document.getElementById('mag').textContent = w.melee ? '-' : p.mag[p.cur];
  document.getElementById('res').textContent = w.melee ? '' : '/ ' + p.reserve[p.cur];
  document.getElementById('slots').innerHTML = slotText(p);
  drawMap(p);
  $.help.hidden = G.frozen || G.time > 25;

  // feed and radio fade out by age
  $.feed.innerHTML = G.feed.filter((f) => G.time - f.t < FEED_SEC).map((f) =>
    `<div class="panel"><b style="color:${TEAMS[f.kt].css}">${f.k}</b> [${f.w}${f.head ? ' HS' : ''}] <b style="color:${TEAMS[f.vt].css}">${f.v}</b></div>`).join('');
  $.radio.innerHTML = G.radio.filter((r) => G.time - r.t < RADIO_SEC && r.team === p.team).map((r) =>
    `<div><b style="color:${TEAMS[r.team].css}">${r.who}</b> (radio): ${r.text}</div>`).join('');

  // crosshair opens with spread
  const gap = fmtCrossGap(spread);
  for (const i of $.cross) i.style.transform = `translate(${Math.sign(+i.dataset.x) * gap}px,${Math.sign(+i.dataset.y) * gap}px)`;
  $.cross.forEach((i) => { i.style.display = p.alive && !p.scope ? '' : 'none'; });
  $.scope.hidden = !p.scope;
  const ht = G.time - G.ui.hitT;
  $.hitm.style.opacity = ht < 0.25 ? 1 : 0;
  $.hitm.className = 'hitm' + (G.ui.hitHead ? ' head' : '');
  for (let k = 0; k < 3; k++) {
    const d = G.ui.dmg[k], age = G.time - d.t, i = $.dmgI[k];
    i.style.opacity = age < 1.2 ? 1 - age / 1.2 : 0;
    i.style.transform = `rotate(${d.ang}rad) translateY(0)`;
    i.style.transformOrigin = '90px 170px';
  }
  $.vig.style.boxShadow = `inset 0 0 ${120 + (p.hp < 40 ? 60 : 0)}px ${p.hp < 40 ? '#d40000aa' : G.time - G.ui.hurtT < 0.3 ? '#d4000066' : '#d4000000'}`;
  $.flashw.style.opacity = Math.min(1, p.flashT / 1.2);

  const b = G.banner;
  $.banner.hidden = G.time > b.until;
  $.banner.firstChild.textContent = b.text; $.banner.firstChild.style.color = TEAMS[b.team].css;
  $.banner.lastChild.textContent = b.sub;
  $.note.textContent = G.time - G.ui.noteT < 2 && G.ui.note ? G.ui.note : '';

  // plant / defuse progress
  const B = G.bomb;
  const planting = B.state === 'carried' && B.plantP > 0 && B.user === p;
  const defusing = B.state === 'planted' && B.defuseP > 0 && B.user === p;
  $.prog.hidden = !(planting || defusing);
  if (!$.prog.hidden) {
    document.getElementById('plbl').textContent = planting ? 'PLANTING' : 'DEFUSING';
    document.getElementById('pbar').style.width = (planting ? B.plantP : B.defuseP) * 100 + '%';
  }

  $.buy.hidden = !G.ui.buy;
  if (G.ui.buy) drawBuy(p);
  $.score.hidden = !G.ui.scores;
  if (G.ui.scores) drawScore();
}
