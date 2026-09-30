const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { execFile } = require('child_process');

const root = app.getAppPath();
let mainWin = null;
let pendingOpen = null; // Datei, die vor dem Fensterstart per Doppelklick geöffnet wurde

/* ── Fenster ──────────────────────────────────────────────────────────── */
function createWindow() {
  const splash = new BrowserWindow({
    width: 380, height: 240, frame: false, resizable: false, center: true,
    alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#1c2127',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));

  const iconPath = path.join(root, 'assets', 'app-icon', 'icon.png');
  mainWin = new BrowserWindow({
    width: 1480, height: 960, minWidth: 1024, minHeight: 680,
    title: 'Netzwerkplaner', show: false, backgroundColor: '#15191e',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false,
      preload: path.join(root, 'src', 'preload', 'preload.js'),
    },
  });
  mainWin.setMenuBarVisibility(false);
  mainWin.loadFile(path.join(root, 'dist-app', 'index.html'));

  let appReady = false, minTimeUp = false, shown = false;
  const tryShow = () => {
    if (shown || !appReady || !minTimeUp) return;
    shown = true;
    splash.webContents.executeJavaScript('document.body.style.opacity="0"').catch(() => {});
    setTimeout(() => {
      mainWin.show(); mainWin.focus(); mainWin.webContents.focus();
      if (!splash.isDestroyed()) splash.close();
      if (pendingOpen) { sendOpenFile(pendingOpen); pendingOpen = null; }
    }, 250);
  };
  mainWin.once('ready-to-show', () => { appReady = true; tryShow(); });
  setTimeout(() => { minTimeUp = true; tryShow(); }, 1400);
  mainWin.on('focus', () => { if (!mainWin.isDestroyed()) mainWin.webContents.focus(); });

  // Links (Web-UIs, Doku) im Standardbrowser öffnen, PDF-Vorschau intern erlauben
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank') return { action: 'allow' };
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

const parentWin = () => BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.isVisible()) || mainWin;

/* ── Projektdateien & zuletzt geöffnet ─────────────────────────────────── */
const dataDir     = () => path.join(app.getPath('userData'), 'Projekte');
const libraryFile = () => path.join(app.getPath('userData'), 'Bibliothek.json');
const recentsFile = () => path.join(app.getPath('userData'), 'recents.json');
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const baseName = (p) => path.basename(p).replace(/\.netplan(\.json)?$|\.json$/i, '');

function loadRecents() {
  try { if (fs.existsSync(recentsFile())) return JSON.parse(fs.readFileSync(recentsFile(), 'utf8')); } catch {}
  return [];
}
function addRecent(filePath) {
  let list = loadRecents().filter((r) => r.filePath !== filePath);
  list.unshift({ filePath, name: baseName(filePath), date: new Date().toISOString() });
  list = list.slice(0, 10);
  try { fs.writeFileSync(recentsFile(), JSON.stringify(list, null, 2), 'utf8'); } catch {}
  return list;
}
function readProject(filePath) {
  return { data: fs.readFileSync(filePath, 'utf8'), filePath, name: baseName(filePath), recents: addRecent(filePath) };
}
function sendOpenFile(filePath) {
  try {
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('open-file', readProject(filePath));
  } catch (e) { console.error('open-file:', e); }
}

ipcMain.handle('app-version', () => app.getVersion());

// Neueste Releases von GitHub holen (für den Update-Hinweis). Ohne Netz: null.
const RELEASES_API = 'https://api.github.com/repos/Nomisimo/Netzwerkplaner/releases?per_page=20';
ipcMain.handle('fetch-releases', async () => {
  try {
    const { net: enet } = require('electron');
    const r = await enet.fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Netzwerkplaner' } });
    if (!r.ok) return null;
    const list = await r.json();
    return Array.isArray(list) ? list.map((x) => ({ tag_name: x.tag_name, name: x.name, html_url: x.html_url, prerelease: x.prerelease, draft: x.draft, published_at: x.published_at })) : null;
  } catch { return null; }
});

/* ── Updates wie im Stromplaner ──────────────────────────────────────────
   Windows: electron-updater lädt die neue Version im Hintergrund und installiert
   sie nach Bestätigung. macOS: die App ist nicht mit Apple-Developer-ID signiert,
   dort nur Hinweis und Download-Seite öffnen. */
const MANUAL_UPDATE = process.platform === 'darwin';
const RELEASES_URL = 'https://github.com/Nomisimo/Netzwerkplaner/releases';
let updaterAktiv = false, updateReady = false;
function setupAutoUpdater(win) {
  if (MANUAL_UPDATE || !app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { console.error('electron-updater fehlt:', e?.message); return; }
  updaterAktiv = true;
  const send = (type, payload) => { if (!win.isDestroyed()) win.webContents.send('update-status', { type, ...payload }); };
  autoUpdater.allowPrerelease = app.getVersion().includes('-'); // Betas bekommen auch Betas
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-not-available', () => send('up-to-date'));
  autoUpdater.on('error', (err) => { console.error('AutoUpdater:', err?.message || err); send('error', { message: err?.message || String(err) }); });
  autoUpdater.on('download-progress', (p) => send('downloading', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-available', (info) => send('available', { version: info.version }));
  let sofort = false; // „Jetzt installieren“ gedrückt, bevor der Download fertig war
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true; send('downloaded', { version: info.version });
    if (sofort) setTimeout(() => autoUpdater.quitAndInstall(false, true), 800);
  });
  ipcMain.removeHandler('check-for-updates');
  ipcMain.handle('check-for-updates', () => {
    if (updateReady) { send('downloaded'); return { auto: true }; }
    autoUpdater.checkForUpdates().catch((err) => send('error', { message: err?.message || String(err) }));
    return { auto: true };
  });
  ipcMain.removeHandler('install-update');
  ipcMain.handle('install-update', () => {
    // Fertig geladen: sofort neu starten und installieren, sonst laden und danach installieren
    if (updateReady) { autoUpdater.quitAndInstall(false, true); return { ok: true }; }
    sofort = true;
    send('installing-after-download');
    autoUpdater.checkForUpdates().catch((err) => { sofort = false; send('error', { message: err?.message || String(err) }); });
    return { ok: true };
  });
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
}
ipcMain.handle('check-for-updates', () => ({ auto: updaterAktiv }));
ipcMain.handle('install-update', (_e, url) => shell.openExternal(/^https:\/\/github\.com\/Nomisimo\/Netzwerkplaner\//.test(url || '') ? url : RELEASES_URL));

ipcMain.handle('get-recents', () => loadRecents());

ipcMain.handle('save-project', async (_e, { json, suggestedName, filePath }) => {
  let target = filePath && fs.existsSync(path.dirname(filePath)) ? filePath : null;
  if (!target) {
    ensureDir(dataDir());
    const r = await dialog.showSaveDialog(parentWin(), {
      title: 'Netzwerkplan speichern',
      defaultPath: path.join(dataDir(), `${suggestedName}.netplan`),
      filters: [{ name: 'Netzwerkplaner-Projekt', extensions: ['netplan'] }],
    });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  fs.writeFileSync(target, json, 'utf8');
  return { filePath: target, name: baseName(target), recents: addRecent(target) };
});

ipcMain.handle('open-project', async () => {
  ensureDir(dataDir());
  const r = await dialog.showOpenDialog(parentWin(), {
    title: 'Netzwerkplan öffnen', defaultPath: dataDir(),
    filters: [{ name: 'Netzwerkplaner-Projekt', extensions: ['netplan', 'json'] }], properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths.length) return null;
  return readProject(r.filePaths[0]);
});

ipcMain.handle('open-recent', async (_e, filePath) => {
  if (!fs.existsSync(filePath)) {
    const list = loadRecents().filter((r) => r.filePath !== filePath);
    try { fs.writeFileSync(recentsFile(), JSON.stringify(list, null, 2), 'utf8'); } catch {}
    return { error: 'not-found', recents: list };
  }
  return readProject(filePath);
});

ipcMain.handle('load-library', () => {
  try { if (fs.existsSync(libraryFile())) return JSON.parse(fs.readFileSync(libraryFile(), 'utf8')); } catch (e) { console.error('load-library:', e); }
  return null;
});
ipcMain.handle('save-library', (_e, data) => {
  try { ensureDir(path.dirname(libraryFile())); fs.writeFileSync(libraryFile(), JSON.stringify(data, null, 2), 'utf8'); } catch (e) { console.error('save-library:', e); }
});

// Allgemeiner Export (CSV, XLSX, SVG, PNG)
ipcMain.handle('save-file', async (_e, { data, name, filters, encoding }) => {
  const r = await dialog.showSaveDialog(parentWin(), { title: 'Exportieren', defaultPath: path.join(app.getPath('documents'), name), filters });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, encoding === 'base64' ? Buffer.from(data, 'base64') : data, encoding === 'base64' ? undefined : 'utf8');
  shell.showItemInFolder(r.filePath);
  return r.filePath;
});

ipcMain.handle('export-pdf', async (_e, { html, name }) => {
  const tmpPath = path.join(os.tmpdir(), `netzplan-${Date.now()}.html`);
  let win;
  try {
    const r = await dialog.showSaveDialog(parentWin(), {
      title: 'PDF speichern', defaultPath: path.join(app.getPath('documents'), `${name}.pdf`),
      filters: [{ name: 'PDF-Datei', extensions: ['pdf'] }],
    });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(tmpPath, html, 'utf8');
    win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    await win.loadFile(tmpPath);
    const pdf = await win.webContents.printToPDF({ pageSize: 'A4', landscape: true, printBackground: true, margins: { marginType: 'none' } });
    fs.writeFileSync(r.filePath, pdf);
    shell.showItemInFolder(r.filePath);
    return r.filePath;
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    if (mainWin && !mainWin.isDestroyed()) { mainWin.focus(); mainWin.webContents.focus(); }
  }
});

ipcMain.handle('open-external', (_e, url) => {
  if (typeof url === 'string' && /^(https?|ftp):\/\//i.test(url)) shell.openExternal(url);
});

/* ── Erreichbarkeit (TCP auf Web-UI-Port, sonst ICMP-Ping) ─────────────── */
const IP_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function tcpCheck(ip, port, timeout = 1500) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const sock = new net.Socket();
    const done = (ok) => { sock.destroy(); resolve({ ok, ms: Date.now() - t0, method: `TCP ${port}` }); };
    sock.setTimeout(timeout);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', (err) => done(err && err.code === 'ECONNREFUSED')); // Gerät antwortet, Port zu
    sock.connect(port, ip);
  });
}

function icmpPing(ip) {
  const args = process.platform === 'win32' ? ['-n', '1', '-w', '1000', ip]
    : process.platform === 'darwin' ? ['-c', '1', '-t', '1', ip]
    : ['-c', '1', '-W', '1', ip];
  return new Promise((resolve) => {
    const t0 = Date.now();
    execFile('ping', args, { timeout: 3000, windowsHide: true }, (err, stdout) => {
      const m = String(stdout || '').match(/(?:time|Zeit)[=<]\s*([\d.,]+)\s*ms/i);
      // Windows meldet „Zielhost nicht erreichbar“ mit Exitcode 0 → auf TTL prüfen
      const ok = !err && /ttl=/i.test(String(stdout));
      resolve({ ok, ms: m ? Math.round(parseFloat(m[1].replace(',', '.'))) : Date.now() - t0, method: 'Ping' });
    });
  });
}

ipcMain.handle('check-reachability', async (_e, targets) => {
  const out = {};
  const list = (targets || []).filter((t) => IP_RE.test(t.ip || '')).slice(0, 512);
  let i = 0;
  const worker = async () => {
    while (i < list.length) {
      const t = list[i++];
      let r = t.port ? await tcpCheck(t.ip, +t.port) : null;
      if (!r || !r.ok) {
        const p = await icmpPing(t.ip);
        if (p.ok || !r) r = p;
      }
      out[t.id] = { ...r, t: Date.now() };
    }
  };
  await Promise.all(Array.from({ length: 16 }, worker));
  return out;
});

/* ── Live-Monitore (sACN, Art-Net, Dante, Scan, SNMP …) ────────────────── */
const monitors = require('./monitor').register(ipcMain, () => mainWin);
app.on('before-quit', () => monitors.stopAll());

/* ── Start, Dateiverknüpfung, Einzelinstanz ────────────────────────────── */
const fileArg = (argv) => argv.slice(1).find((a) => /\.netplan$|\.json$/i.test(a) && fs.existsSync(a));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const f = fileArg(argv);
    if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); }
    if (f) sendOpenFile(f);
  });
  app.on('open-file', (e, filePath) => {
    e.preventDefault();
    if (mainWin && mainWin.isVisible()) sendOpenFile(filePath); else pendingOpen = filePath;
  });
  app.whenReady().then(() => {
    const f = fileArg(process.argv);
    if (f) pendingOpen = f;
    createWindow();
    setupAutoUpdater(mainWin);
  });
  app.on('window-all-closed', () => app.quit());
}
