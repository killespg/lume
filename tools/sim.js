// Plays the real game code headlessly with imperfect bots, to check the difficulty curve.
// Usage: node tools/sim.js [runs-per-profile]
const fs = require('fs'), path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../game/lume.html'), 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

// A stand-in for the DOM and canvas: every property is a callable that returns itself.
const noop = new Proxy(function () { }, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : noop),
  apply: () => noop, construct: () => noop, set: () => true
});
function boot() {
  const win = {};
  const doc = { querySelector: () => noop, createElement: () => noop, addEventListener() { }, body: noop, hidden: false, fonts: null };
  const ls = { getItem: () => null, setItem() { } };
  const fn = new Function('window', 'document', 'localStorage', 'matchMedia', 'addEventListener', 'requestAnimationFrame',
    'innerWidth', 'innerHeight', 'devicePixelRatio', 'location', 'navigator', 'setTimeout', 'clearTimeout', 'setInterval', js);
  fn(win, doc, ls, () => ({ matches: false }), () => { }, () => 0, 1280, 720, 1, { search: '?debug' }, {}, () => 0, () => { }, () => 0);
  return win.__lume;
}

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// aim: release angle the player goes for; sd: how far off they land; react: delay before holding again;
// pBad: chance of letting go at a random moment; aware: chance they bail off a burning lantern in time.
const PROFILES = {
  novato:      { aim: 34, sd: 21, react: .40, reactSd: .16, pBad: .13, aware: .3, minSp: 300 },
  mediano:     { aim: 40, sd: 12, react: .27, reactSd: .09, pBad: .045, aware: .7, minSp: 450 },
  bom:         { aim: 42, sd: 7,  react: .20, reactSd: .05, pBad: .012, aware: .95, minSp: 540 },
  especialista:{ aim: 43, sd: 3,  react: .16, reactSd: .03, pBad: 0,    aware: 1, minSp: 560 },
};

function makeBot(L, prof, rand) {
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rand(); return (u - 3) / Math.sqrt(.5); };
  let down = true, sinceRel = 0, pressDelay = 0, relAngle = null, attT = 0, panic = -1, bail = false;
  return () => {
    const p = L.player; if (L.state !== 'play') return;
    if (p.att) {
      attT += 1 / 60;
      if (relAngle === null) { relAngle = prof.aim + gauss() * prof.sd; panic = rand() < prof.pBad ? .25 + rand() * .9 : -1; bail = rand() < prof.aware; }
      const ang = Math.atan2(-p.vy, p.vx) * 180 / Math.PI;
      let rel = false;
      if (panic > 0 && attT > panic) rel = true;
      else if (p.vx > 120 && p.vy < 0 && ang >= relAngle && (Math.hypot(p.vx, p.vy) > prof.minSp || attT > 2.6)) rel = true;
      else if (attT > 4 && p.vx > 100 && p.vy < 0) rel = true;
      else if (bail && p.att.burning && p.vx > 150 && p.vy < 0 && (ang > 22 || p.att.burn > p.att.burnMax * .75)) rel = true;
      if (down && rel) { L.release('b'); down = false; sinceRel = 0; pressDelay = Math.max(.07, prof.react + gauss() * prof.reactSd); relAngle = null; attT = 0; }
    } else {
      attT = 0; relAngle = null;
      if (!down) { sinceRel += 1 / 60; if (sinceRel >= pressDelay) { L.press('b'); down = true; } }
    }
  };
}

function run(L, prof, seed, maxSec) {
  const rand = mulberry32(seed);
  L.release('b');
  if (L.state === 'title') L.press('b'); else { L.restart(); L.press('b'); }
  const bot = makeBot(L, prof, rand);
  let t = 0, bad = null;
  while (L.state === 'play' && t < maxSec) {
    bot(); L.tickSim(1 / 60); t += 1 / 60;
    const p = L.player;
    if (!bad && !(isFinite(p.x) && isFinite(p.y) && isFinite(p.vx) && isFinite(p.vy))) bad = 'NaN at ' + t.toFixed(1);
  }
  const alive = L.state === 'play';
  for (let i = 0; i < 90 && L.state !== 'over' && !alive; i++) L.tickSim(1 / 60);
  return { m: L.m, t, alive, flies: L.flies, streak: L.streak, bad, cause: alive ? 'vivo' : L.cause };
}

module.exports = { boot, PROFILES, makeBot, mulberry32, run };
if (require.main !== module) return;

const N = +process.argv[2] || 120;
const only = process.argv[3];
const L = boot();
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
console.log(`${N} partidas por perfil (limite de 15 min cada)\n`);
console.log('perfil         p10    mediana   p90     média   <100m  >1080m(noite)  vivo  tempo-med  sequência');
for (const [name, prof] of Object.entries(PROFILES)) {
  if (only && only !== name) continue;
  const n = name === 'especialista' ? Math.max(20, N >> 2) : name === 'bom' ? Math.max(30, N >> 1) : N;
  const ms = [], ts = [], causes = {}; let alive = 0, bad = 0, st = 0;
  for (let i = 0; i < n; i++) {
    const r = run(L, prof, 1000 + i * 7919, 900);
    ms.push(r.m); ts.push(r.t); if (r.alive) alive++; if (r.bad) { bad++; console.log('  !', name, r.bad); } st += r.streak; causes[r.cause] = (causes[r.cause] || 0) + 1;
  }
  ms.sort((a, b) => a - b); ts.sort((a, b) => a - b);
  const mean = ms.reduce((a, b) => a + b, 0) / n;
  const f = v => String(Math.round(v)).padStart(6);
  console.log(name.padEnd(12), f(q(ms, .1)), f(q(ms, .5)), '  ', f(q(ms, .9)), ' ', f(mean), '  ',
    String(Math.round(ms.filter(v => v < 100).length / n * 100) + '%').padStart(4), '  ',
    String(Math.round(ms.filter(v => v > 1080).length / n * 100) + '%').padStart(8), '     ',
    String(alive).padStart(3), ' ', (q(ts, .5)).toFixed(0).padStart(6) + 's', '   ', (st / n).toFixed(1));
  console.log('              causas:', Object.entries(causes).map(([k, v]) => `${k} ${Math.round(v / n * 100)}%`).join(', '));
  if (bad) console.log('  ', bad, 'partidas com valores inválidos');
}
