// audio.js: all sound is synthesised with WebAudio (noise bursts and oscillators). No files.
// The context starts suspended until the first key/click (browser autoplay rule); calls before that are silent.
let ctx = null, master = null, noiseBuf = null;

export function initAudio() {
  const resume = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  };
  for (const ev of ['keydown', 'mousedown', 'pointerdown']) addEventListener(ev, resume);
}

// Filtered noise burst: the body of gunshots, steps and explosions. pan -1..1, vol 0..1.
function noise(dur, freq, q, vol, pan = 0, type = 'lowpass', slide = 0) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  src.connect(f); f.connect(g); g.connect(p); p.connect(master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
function tone(freq, dur, vol, type = 'square', slide = 0, pan = 0) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  o.connect(g); g.connect(p); p.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

// `tone` is the per-weapon pitch factor from config (higher = snappier). `dist` softens far shots.
export function sfxShot(id, tonef, dist, pan) {
  const v = Math.max(0.05, 1 - dist / 70);
  if (id === 'knife') { noise(0.12, 3000, 1, 0.3 * v, pan, 'highpass'); return; }
  const base = 900 * tonef;
  noise(0.22, base, 0.8, 0.8 * v, pan, 'lowpass', 0.3);
  tone(110 * tonef, 0.12, 0.35 * v, 'sawtooth', 0.4, pan);
  if (id === 'longsight') noise(0.7, 500, 0.5, 0.5 * v, pan, 'lowpass', 0.2);
}
export const sfxReload = () => { noise(0.05, 2500, 3, 0.4, 0, 'bandpass'); setTimeout(() => noise(0.06, 1800, 3, 0.45, 0, 'bandpass'), 450); setTimeout(() => tone(260, 0.06, 0.2), 1000); };
export const sfxEmpty = () => tone(1400, 0.04, 0.25, 'square');
export const sfxHit = (head) => { tone(head ? 1900 : 1200, 0.07, 0.3, 'triangle'); if (head) tone(2600, 0.1, 0.2, 'triangle'); };
export const sfxHurt = () => { noise(0.18, 400, 1, 0.5, 0, 'lowpass'); tone(90, 0.2, 0.4, 'sine', 0.5); };
export const sfxStep = (vol, pan) => noise(0.06, 500, 1, vol, pan, 'lowpass');
export const sfxBoom = (big) => { noise(big ? 1.6 : 0.9, 420, 0.6, 1, 0, 'lowpass', 0.15); tone(55, big ? 1.2 : 0.6, 0.8, 'sine', 0.4); };
export const sfxFlash = () => { tone(3200, 0.8, 0.25, 'sine', 0.8); noise(0.2, 4000, 1, 0.4, 0, 'highpass'); };
export const sfxSmoke = () => noise(0.7, 1200, 0.5, 0.35, 0, 'lowpass');
export const sfxBeep = (hi) => tone(hi ? 1500 : 1000, 0.09, 0.3, 'square');
export const sfxBuy = () => { tone(700, 0.06, 0.25, 'square'); setTimeout(() => tone(1100, 0.08, 0.25, 'square'), 60); };
export const sfxRound = (win) => { [0, 120, 240].forEach((d, i) => setTimeout(() => tone((win ? [520, 660, 880] : [420, 330, 250])[i], 0.25, 0.3, 'triangle'), d)); };
export const sfxThrow = () => noise(0.12, 900, 1, 0.3, 0, 'bandpass');
