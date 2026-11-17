import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const game = join(root, 'game');

// Source files = .html/.js/.css/.json under game/, skipping vendor/ and *.min.js.
const src = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== 'vendor') walk(p); }
    else if (/\.(html|js|css|json)$/.test(n) && !/\.min\./.test(n)) src.push(p);
  }
})(game);

assert.ok(existsSync(join(game, 'index.html')), 'game/index.html missing');
assert.ok(existsSync(join(game, 'src/main.js')), 'game/src/main.js missing');
assert.ok(!existsSync(join(game, 'tactical.js')), 'old tactical.js still present');
assert.ok(readFileSync(join(game, 'index.html'), 'utf8').includes('./src/main.js'), 'index.html must load src/main.js');

// No network URL in code, comments excluded.
for (const f of src) {
  const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/https?:\/\//.test(code), `network URL in ${f}`);
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(code), `network API in ${f}`);
}

const total = src.reduce((n, f) => n + statSync(f).size, 0);
assert.ok(total < 150000, `source bytes ${total} over budget`);

const shots = readdirSync(join(root, 'screenshots')).filter((n) => !n.startsWith('.'));
assert.equal(shots.length, 4, 'need exactly 4 screenshots');
for (const n of shots) {
  const b = readFileSync(join(root, 'screenshots', n));
  assert.ok(b.length <= 262144, `${n} too big`);
  let w, h;
  if (b[0] === 0x89) { w = b.readUInt32BE(16); h = b.readUInt32BE(20); }
  else { // JPEG: walk markers to the SOF segment
    let i = 2;
    while (i < b.length) {
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xc3) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; }
      i += 2 + len;
    }
  }
  assert.ok(Math.max(w, h) <= 1280 && Math.min(w, h) >= 480, `${n} dimensions ${w}x${h}`);
  console.log(n, `${w}x${h}`, b.length);
}
console.log('contract OK, source bytes', total);
