// textures.js: every texture is painted at start-up on a 2D canvas (no image files, no network).
// Painting uses the seeded rand() so the look is identical on every load.
import * as THREE from 'three';
import { rand, randRange } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

// Random speckle so flat colour fills read as a surface.
function grain(g, w, h, count, dark, light) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = rand() < 0.5 ? dark : light;
    g.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }
}

function brick() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#d9cdb6'; // mortar
  g.fillRect(0, 0, 256, 256);
  const palette = ['#b5603f', '#a4553a', '#c37049', '#9a4f37', '#bb7a54'];
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 32 : 0;
    for (let col = -1; col < 4; col++) {
      g.fillStyle = palette[Math.floor(rand() * palette.length)];
      g.fillRect(col * 64 + off + 2, row * 32 + 2, 60, 28);
      g.fillStyle = '#ffffff14';
      g.fillRect(col * 64 + off + 2, row * 32 + 2, 60, 4);
    }
  }
  grain(g, 256, 256, 900, '#4a2418', '#e2a37c');
  return tex(c);
}

function concrete(base = '#aaa69c', seams = true) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? '60,55,50' : '230,225,215'},${randRange(0.03, 0.09)})`;
    g.fillRect(rand() * 256, rand() * 256, randRange(20, 90), randRange(10, 60));
  }
  grain(g, 256, 256, 1600, '#6d6a63', '#d6d2c8');
  if (seams) {
    g.strokeStyle = '#5f5c55';
    g.lineWidth = 2;
    g.strokeRect(1, 1, 254, 254);
    g.beginPath();
    g.moveTo(128, 0); g.lineTo(128, 256);
    g.stroke();
  }
  return tex(c);
}

// Wooden crate face: planks, frame, cross brace and a stencilled code.
function crate(base, code) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#00000016' : '#ffffff10';
    g.fillRect(i * 32, 0, 32, 256);
    g.fillStyle = '#3a22108a';
    g.fillRect(i * 32, 0, 2, 256);
  }
  for (let i = 0; i < 160; i++) {
    g.strokeStyle = 'rgba(70,40,15,0.25)';
    g.beginPath();
    const x = rand() * 256, y = rand() * 256;
    g.moveTo(x, y); g.lineTo(x + randRange(-2, 2), y + randRange(8, 30));
    g.stroke();
  }
  g.strokeStyle = '#5a3a1a';
  g.lineWidth = 16;
  g.strokeRect(8, 8, 240, 240);
  g.lineWidth = 12;
  g.beginPath(); g.moveTo(14, 14); g.lineTo(242, 242); g.moveTo(242, 14); g.lineTo(14, 242); g.stroke();
  g.fillStyle = '#e9e3cf';
  g.font = 'bold 30px monospace';
  g.textAlign = 'center';
  g.fillText(code, 128, 138);
  g.fillStyle = '#2b1a0c';
  for (const [x, y] of [[20, 20], [236, 20], [20, 236], [236, 236]]) g.fillRect(x - 3, y - 3, 6, 6);
  return tex(c);
}

// Shipping container side: ribs, a hazard-stripe band and a stencilled id.
function container(base, id) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    g.fillStyle = '#00000026'; g.fillRect(x, 0, 4, 256);
    g.fillStyle = '#ffffff1a'; g.fillRect(x + 6, 0, 3, 256);
  }
  grain(g, 256, 256, 700, '#00000055', '#ffffff30');
  // hazard band
  g.save();
  g.beginPath(); g.rect(0, 206, 256, 32); g.clip();
  g.fillStyle = '#f1c232'; g.fillRect(0, 206, 256, 32);
  g.fillStyle = '#1c1c1c';
  for (let x = -40; x < 300; x += 32) {
    g.beginPath(); g.moveTo(x, 238); g.lineTo(x + 16, 238); g.lineTo(x + 48, 206); g.lineTo(x + 32, 206); g.closePath(); g.fill();
  }
  g.restore();
  g.fillStyle = '#f2efe4';
  g.font = 'bold 22px monospace';
  g.textAlign = 'center';
  g.fillText(id, 128, 40);
  g.font = 'bold 14px monospace';
  g.fillText('VANTAGE FREIGHT', 128, 62);
  return tex(c);
}

// Floor paint for the bombsites: a rounded yellow plate with a big letter.
function sitePlate(letter) {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = '#f5c542';
  g.lineWidth = 14;
  g.strokeRect(14, 14, 228, 228);
  g.fillStyle = '#f5c542';
  g.font = 'bold 190px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 128, 140);
  grain(g, 256, 256, 500, '#0000', '#00000055');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Letter stencilled on a brick wall, transparent elsewhere.
function wallLetter(letter) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f2ead2';
  g.font = 'bold 210px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 128, 140);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 220; i++) g.fillRect(rand() * 256, rand() * 256, 2 + rand() * 4, 1 + rand() * 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft radial glow: sun, lamps, muzzle flash.
function glow(inner = '255,240,200', outer = '255,170,60') {
  const [c, g] = canvas(128, 128);
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, `rgba(${inner},1)`);
  r.addColorStop(0.25, `rgba(${outer},0.7)`);
  r.addColorStop(1, `rgba(${outer},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Smoke puff: grey blob with a ragged edge.
function puff() {
  const [c, g] = canvas(128, 128);
  for (let i = 0; i < 26; i++) {
    const x = 64 + randRange(-22, 22), y = 64 + randRange(-22, 22), rad = randRange(18, 38);
    const r = g.createRadialGradient(x, y, 0, x, y, rad);
    r.addColorStop(0, 'rgba(225,225,228,0.55)');
    r.addColorStop(1, 'rgba(225,225,228,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Dusk sky: deep blue overhead, rose, then a hot orange horizon. Painted top to bottom.
// A +-3/255 dither is added per pixel: without it an 8x512 ramp stretched over the dome bands.
function skyGradient() {
  const [c, g] = canvas(16, 512);
  const r = g.createLinearGradient(0, 0, 0, 512);
  r.addColorStop(0, '#3d5a9c');
  r.addColorStop(0.35, '#8f7fb8');
  r.addColorStop(0.55, '#f08fa0');
  r.addColorStop(0.7, '#ffbb7a');
  r.addColorStop(1, '#ffd9a0');
  g.fillStyle = r;
  g.fillRect(0, 0, 16, 512);
  const img = g.getImageData(0, 0, 16, 512), px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (rand() - 0.5) * 6;
    px[i] += n; px[i + 1] += n; px[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// Floating nametag: team-coloured text on a dark pill.
export function nameTagTexture(name, css) {
  const [c, g] = canvas(256, 64);
  g.fillStyle = '#000000a6';
  g.beginPath(); g.roundRect(4, 8, 248, 48, 14); g.fill();
  g.fillStyle = css;
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeTextures() {
  return {
    brick: brick(),
    concrete: concrete(),
    floor: concrete('#b3ab9b', true),
    crateA: crate('#c18f52', 'VT-07'),
    crateB: crate('#a97a45', 'FRAGILE'),
    crateC: crate('#7b8d62', 'MIL-12'),
    contRed: container('#a8452f', 'VFR 440912'),
    contTeal: container('#2f7f82', 'VFR 118305'),
    contBlue: container('#3c5f95', 'VFR 770231'),
    plateA: sitePlate('A'),
    plateB: sitePlate('B'),
    wallA: wallLetter('A'),
    wallB: wallLetter('B'),
    glow: glow(),
    flash: glow('255,255,235', '255,200,90'),
    puff: puff(),
    sky: skyGradient(),
  };
}
