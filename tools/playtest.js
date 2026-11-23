// Loads the desktop page in an offscreen window, plays it with a bot in real time, and saves screenshots.
// Run with: electron tools/playtest.js [outDir]
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');

const outArg = process.argv.slice(1).filter(v => !v.startsWith('--') && !v.endsWith('.js'))[0];
const out = path.resolve(outArg || path.join(__dirname, '..', 'shots'));
fs.mkdirSync(out, { recursive: true });
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const W = +(process.env.SHOT_W || 1280), H = +(process.env.SHOT_H || 720);

const BOT = `(() => {
  const L = window.__lume; let down = false, t0 = 0, att = 0;
  window.__fps = { n: 0, t: performance.now(), v: 0 };
  (function f() { const F = window.__fps; F.n++; const now = performance.now(); if (now - F.t > 1000) { F.v = F.n * 1000 / (now - F.t); F.n = 0; F.t = now; } requestAnimationFrame(f); })();
  window.__botOn = true;
  setInterval(() => {
    if (!window.__botOn) return;
    const p = L.player, now = performance.now();
    if (L.state === 'title' || L.state === 'over') { L.release('b'); L.press('b'); down = true; return; }
    if (L.state !== 'play') return;
    const ang = Math.atan2(-p.vy, p.vx) * 180 / Math.PI, sp = Math.hypot(p.vx, p.vy);
    att = p.att ? att + 1 : 0;
    if (down && p.att && p.vx > 150 && p.vy < 0 && ang > 36 && (sp > 520 || att > 150)) { L.release('b'); down = false; t0 = now; }
    else if (!down && now - t0 > 190) { L.press('b'); down = true; }
  }, 8);
})()`;
const wait = ms => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  process.on('unhandledRejection', e => { console.error(e); app.exit(1); });
  const win = new BrowserWindow({
    width: W, height: H, show: false, useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false, preload: path.join(__dirname, '..', 'app', 'preload.js'), contextIsolation: true }
  });
  win.webContents.setFrameRate(60);
  const logs = [];
  win.webContents.on('console-message', (e, level, message) => {
    const lvl = typeof level === 'number' ? level : (e && e.level), msg = message || (e && e.message) || '';
    if (lvl === 'error' || lvl === 'warning' || lvl >= 2) logs.push(lvl + ': ' + msg);
  });
  await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'), { search: 'debug' });
  const js = c => win.webContents.executeJavaScript(c);
  const shot = async name => { const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(out, name + '.png'), img.toPNG()); };
  await wait(2500); await shot('1-titulo');
  await js(BOT);
  await wait(7000); await shot('2-tarde');
  const info = [];
  const stage = async (m, name, secs) => {
    await js(`window.__lume.m = Math.max(window.__lume.m, ${m})`); await wait(secs * 1000); await shot(name);
    info.push(await js(`JSON.stringify({ at: '${name}', m: Math.round(window.__lume.m), state: window.__lume.state, fps: Math.round(window.__fps.v), streak: window.__lume.streak })`));
  };
  await stage(700, '3-entardecer', 5);
  await stage(1300, '4-noite', 6);
  await stage(2000, '5-aurora', 6);
  await js(`window.__botOn = false; window.__lume.release('b')`);
  await wait(5200); await shot('6-fim');
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))`); await wait(500); await shot('7-pausa');
  console.log(info.join('\n'));
  console.log(logs.length ? 'console:\n' + logs.join('\n') : 'console: sem erros');
  app.quit();
});
