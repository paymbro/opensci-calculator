// Electron main process: one frameless, transparent window that shows only the calculator.
const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const BODY_W = 909, BODY_H = 1913;        // proportions of the official front photo crop
const MIN_H = 420, DEFAULT_H = 860;

let win = null;
const statePath = () => path.join(app.getPath('userData'), 'window.json');

function loadState() {
  try { return JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch (e) { return null; }
}
function saveState() {
  if (!win) return;
  try { fs.writeFileSync(statePath(), JSON.stringify(win.getBounds())); } catch (e) { /* ignore */ }
}

function widthFor(h) { return Math.round((h * BODY_W) / BODY_H); }

function createWindow() {
  const st = loadState();
  const work = screen.getPrimaryDisplay().workAreaSize;
  let h = st ? st.height : Math.min(DEFAULT_H, work.height - 40);
  h = Math.max(MIN_H, Math.min(h, work.height));
  const w = widthFor(h);
  win = new BrowserWindow({
    width: w, height: h, x: st ? st.x : undefined, y: st ? st.y : undefined,
    frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false,
    hasShadow: false, backgroundColor: '#00000000', title: 'OpenSci Calculator', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('moved', saveState);
  win.on('closed', () => { win = null; if (shortcutsWin) shortcutsWin.close(); });
}

// Keyboard shortcuts list (SETTINGS > Get Started): an ordinary window, one at a time.
let shortcutsWin = null;
function openShortcuts() {
  if (shortcutsWin) { shortcutsWin.show(); shortcutsWin.focus(); return; }
  shortcutsWin = new BrowserWindow({
    width: 560, height: 720, minWidth: 400, minHeight: 300, title: 'Keyboard Shortcuts', show: false,
    autoHideMenuBar: true, backgroundColor: '#1f2225',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  shortcutsWin.setMenu(null);
  shortcutsWin.loadFile(path.join(__dirname, 'renderer', 'shortcuts.html'));
  shortcutsWin.once('ready-to-show', () => shortcutsWin.show());
  shortcutsWin.on('closed', () => { shortcutsWin = null; });
}
ipcMain.on('app:shortcuts', openShortcuts);
// test mode: open the shortcuts window, optionally run a script in it, and save pictures of it
ipcMain.handle('app:captureShortcuts', async (e, file, js) => {
  openShortcuts();
  await new Promise((r) => setTimeout(r, 1500));
  const wc = shortcutsWin.webContents;
  if (js) { await wc.executeJavaScript(js); await new Promise((r) => setTimeout(r, 300)); }
  fs.writeFileSync(file, (await wc.capturePage()).toPNG());
  for (let i = 1; i <= 4; i++) {   // further screenfuls: name_1.png ...
    await wc.executeJavaScript(`window.scrollTo(0, ${i} * (innerHeight - 40))`);
    await new Promise((r) => setTimeout(r, 200));
    fs.writeFileSync(file.replace(/\.png$/, `_${i}.png`), (await wc.capturePage()).toPNG());
  }
  const h = await shortcutsWin.webContents.executeJavaScript('document.documentElement.scrollHeight');
  fs.writeFileSync(file.replace(/\.png$/, '.txt'), String(h) + '\n' + await shortcutsWin.webContents.executeJavaScript('document.body.innerText'));
  return true;
});

// Scale the window keeping the calculator's aspect ratio (never distorting it).
ipcMain.on('win:scale', (e, { height, anchor }) => {
  if (!win) return;
  const work = screen.getDisplayMatching(win.getBounds()).workAreaSize;
  const h = Math.round(Math.max(MIN_H, Math.min(height, work.height + 200)));
  const b = win.getBounds();
  const w = widthFor(h);
  let x = b.x, y = b.y;
  if (anchor === 'center') { x = Math.round(b.x + (b.width - w) / 2); y = Math.round(b.y + (b.height - h) / 2); }
  win.setBounds({ x, y, width: w, height: h });
  saveState();
});
ipcMain.on('win:close', () => { if (win) win.close(); });
ipcMain.on('win:minimize', () => { if (win) win.minimize(); });
ipcMain.handle('win:height', () => (win ? win.getBounds().height : DEFAULT_H));
ipcMain.handle('app:testMode', () => process.argv.includes('--test-screens') ? process.argv[process.argv.indexOf('--test-screens') + 1] || '' : null);
ipcMain.handle('app:capture', async (e, file) => {
  if (!win) return false;
  const img = await win.webContents.capturePage();
  fs.writeFileSync(file, img.toPNG());
  return true;
});
ipcMain.on('app:quit', () => app.quit());

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
