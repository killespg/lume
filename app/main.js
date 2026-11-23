const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Music starts on the title screen, before any click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const prefsFile = () => path.join(app.getPath('userData'), 'janela.json');
function readPrefs() { try { return JSON.parse(fs.readFileSync(prefsFile(), 'utf8')); } catch (e) { return {}; } }
function writePrefs(p) { try { fs.writeFileSync(prefsFile(), JSON.stringify(p)); } catch (e) { } }

// LUME_SMOKE=arquivo.png: start hidden, save one screenshot after a few seconds and quit (used to test the build).
const smoke = process.env.LUME_SMOKE || '';
let win = null;
function toggleFullscreen() {
  if (!win) return;
  const next = !win.isFullScreen();
  win.setFullScreen(next);
  writePrefs({ fullscreen: next });
}

function createWindow() {
  const prefs = readPrefs();
  win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 640, minHeight: 400,
    fullscreen: !smoke && prefs.fullscreen !== false,
    backgroundColor: '#1b1620',
    title: 'Lume',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: !!smoke },
  });
  if (smoke) {
    let frame = null;
    win.webContents.on('paint', (e, dirty, image) => { frame = image; });
    win.webContents.once('did-finish-load', () => setTimeout(() => {
      try { if (frame) fs.writeFileSync(smoke, frame.toPNG()); } catch (e) { console.error(e); }
      app.exit(frame ? 0 : 1);
    }, 3500));
  } else win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) { event.preventDefault(); toggleFullscreen(); }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    ipcMain.on('lume:quit', () => app.quit());
    ipcMain.on('lume:fullscreen', toggleFullscreen);
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
