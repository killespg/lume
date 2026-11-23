// Builds the desktop app: copies the game into the Electron shell with its fonts bundled,
// draws the icon, and packages dist/Lume-win32-x64/Lume.exe.
// Usage: node tools/build.js [--html-only] [--out=pasta]
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const bin = n => path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? n + '.cmd' : n);
const sh = (cmd, args) => execFileSync(`"${cmd}"`, args, { cwd: root, stdio: 'inherit', shell: true });

const src = fs.readFileSync(path.join(root, 'game', 'lume.html'), 'utf8');
const faces = `<style>
@font-face{font-family:'Fraunces';font-style:normal;font-weight:100 900;font-display:block;src:url(fonts/fraunces-normal.woff2) format('woff2')}
@font-face{font-family:'Fraunces';font-style:italic;font-weight:100 900;font-display:block;src:url(fonts/fraunces-italic.woff2) format('woff2')}
</style>`;
const a = src.indexOf('<!--FONTS-->'), b = src.indexOf('<!--/FONTS-->');
if (a < 0 || b < 0) throw new Error('marcadores de fonte não encontrados em game/lume.html');
const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:">`;
const html = '<!doctype html>\n<html lang="pt-BR">\n' + csp + '\n' + src.slice(0, a) + faces + src.slice(b + '<!--/FONTS-->'.length);
fs.writeFileSync(path.join(root, 'app', 'index.html'), html);
console.log('app/index.html gerado');
if (process.argv.includes('--html-only')) process.exit(0);

if (!fs.existsSync(path.join(root, 'app', 'icon.ico'))) sh(bin('electron'), ['tools/icon.js']);
const ev = require(path.join(root, 'node_modules', 'electron', 'package.json')).version;
const outArg = process.argv.find(v => v.startsWith('--out='));
const outDir = outArg ? outArg.slice(6) : 'dist';
sh(bin('electron-packager'), ['app', 'Lume', '--platform=win32', '--arch=x64', `--out="${outDir}"`, '--overwrite', '--asar',
  '--icon=app/icon.ico', `--electron-version=${ev}`, '--app-copyright=MIT', '--win32metadata.ProductName=Lume', '--win32metadata.FileDescription=Lume']);
// keep only the interface languages the game is likely to meet; Chromium falls back to en-US
const built = path.resolve(root, outDir, 'Lume-win32-x64'), keep = new Set(['pt-BR.pak', 'pt-PT.pak', 'en-US.pak']);
for (const f of fs.readdirSync(path.join(built, 'locales'))) if (!keep.has(f)) fs.rmSync(path.join(built, 'locales', f));
console.log(`pronto: ${path.join(built, 'Lume.exe')}`);
