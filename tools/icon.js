// Draws the app icon (a lit paper lantern at dusk) and writes app/icon.ico.
// Run with: electron tools/icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');

const page = `<!doctype html><body style="margin:0;background:transparent"><canvas id="c" width="256" height="256"></canvas><script>
const c = document.getElementById('c'), g = c.getContext('2d');
function box(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
box(8, 8, 240, 240, 54); g.save(); g.clip();
let s = g.createLinearGradient(0, 0, 0, 256); s.addColorStop(0, '#232552'); s.addColorStop(.55, '#8c4c6c'); s.addColorStop(1, '#f39262'); g.fillStyle = s; g.fillRect(0, 0, 256, 256);
g.fillStyle = '#5a3558'; g.beginPath(); g.moveTo(0, 190); g.lineTo(46, 150); g.lineTo(84, 182); g.lineTo(132, 138); g.lineTo(186, 186); g.lineTo(224, 158); g.lineTo(256, 184); g.lineTo(256, 256); g.lineTo(0, 256); g.fill();
g.fillStyle = '#2a1a33'; g.beginPath(); g.moveTo(0, 222); g.quadraticCurveTo(64, 196, 128, 220); g.quadraticCurveTo(196, 244, 256, 214); g.lineTo(256, 256); g.lineTo(0, 256); g.fill();
let h = g.createRadialGradient(128, 112, 4, 128, 112, 120); h.addColorStop(0, 'rgba(255,190,110,.75)'); h.addColorStop(1, 'rgba(255,170,90,0)');
g.globalCompositeOperation = 'lighter'; g.fillStyle = h; g.fillRect(0, 0, 256, 256); g.globalCompositeOperation = 'source-over';
g.strokeStyle = '#1b1620'; g.lineWidth = 3; g.beginPath(); g.moveTo(128, 24); g.lineTo(128, 56); g.stroke();
g.beginPath(); g.moveTo(104, 62); g.bezierCurveTo(60, 84, 60, 142, 104, 164); g.lineTo(152, 164); g.bezierCurveTo(196, 142, 196, 84, 152, 62); g.closePath();
let p = g.createRadialGradient(128, 118, 4, 128, 112, 62); p.addColorStop(0, '#fff0b4'); p.addColorStop(.55, '#ffb85e'); p.addColorStop(1, '#d9642f'); g.fillStyle = p; g.fill();
g.strokeStyle = 'rgba(27,22,32,.28)'; g.lineWidth = 2; g.beginPath(); g.moveTo(128, 62); g.lineTo(128, 164); g.moveTo(112, 62); g.quadraticCurveTo(84, 113, 112, 164); g.moveTo(144, 62); g.quadraticCurveTo(172, 113, 144, 164); g.stroke();
g.fillStyle = '#1b1620'; g.fillRect(100, 52, 56, 12); g.fillRect(100, 162, 56, 11);
g.strokeStyle = '#c4392a'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(128, 173); g.quadraticCurveTo(120, 196, 134, 214); g.stroke();
g.restore();
<\/script></body>`;

app.whenReady().then(async () => {
  process.on('unhandledRejection', e => { console.error(e); app.exit(1); });
  const win = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  const tmp = path.join(require('os').tmpdir(), 'lume-icon.html');
  fs.writeFileSync(tmp, page);
  await win.loadFile(tmp);
  await new Promise(r => setTimeout(r, 400));
  const dataUrl = await win.webContents.executeJavaScript(`document.getElementById('c').toDataURL('image/png')`);
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  const out = path.join(__dirname, '..', 'app');
  fs.writeFileSync(path.join(out, 'icon.png'), png);
  // an .ico may carry a PNG directly (Windows Vista and later)
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
  head.writeUInt8(0, 6); head.writeUInt8(0, 7); head.writeUInt8(0, 8); head.writeUInt8(0, 9);
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(out, 'icon.ico'), Buffer.concat([head, png]));
  console.log('app/icon.ico gerado');
  app.quit();
});
