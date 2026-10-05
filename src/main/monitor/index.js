// Live-Monitore verwalten und per IPC an die Oberfläche anbinden.
// Jeder Monitor läuft im Hauptprozess; die Oberfläche bekommt gedrosselte Schnappschüsse (max. 4 pro Sekunde).
const { listInterfaces } = require('./util');
const mdns = require('./mdns');

const MODULES = {
  sacn: require('./sacn'),
  artnet: require('./artnet'),
  citp: require('./citp'),
  osc: require('./osc'),
  manet: require('./manet'),
  ptp: require('./ptp'),
  dante: { create: (o, c) => mdns.create({ ...o, services: mdns.SERVICES.dante }, c) },
  ndi: { create: (o, c) => mdns.create({ ...o, services: mdns.SERVICES.ndi }, c) },
  scan: require('./scan'),
  snmp: require('./snmp'),
};
// Werkzeuge ohne offenen Port starten automatisch bei der ersten Aktion
const TOOLS = new Set(['scan', 'snmp']);

function createManager(send) {
  const running = new Map(); // kind → { mon, opts, dirty, started }
  const letzte = new Map(); // kind → letzter Stand eines gestoppten Monitors; die Einträge bleiben stehen
  let lastTick = Date.now();

  const emit = (kind) => {
    const r = running.get(kind);
    if (!r) return;
    r.dirty = false;
    let snap;
    try { snap = r.mon.snapshot(); } catch (e) { snap = { err: e.message }; }
    send({ kind, running: true, opts: r.opts, started: r.started, snapshot: snap });
  };

  const flush = setInterval(() => { for (const [k, r] of running) if (r.dirty) emit(k); }, 250);
  const tick = setInterval(() => {
    const now = Date.now(), dt = now - lastTick;
    lastTick = now;
    for (const r of running.values()) { try { r.mon.tick(dt); } catch {} r.dirty = true; }
  }, 1000);

  const start = async (kind, opts = {}) => {
    if (!MODULES[kind]) return { ok: false, error: `Unbekannter Monitor: ${kind}` };
    await stop(kind);
    const entry = { opts, dirty: true, started: Date.now() };
    try {
      entry.mon = await MODULES[kind].create(opts, { dirty: () => { entry.dirty = true; } });
    } catch (e) {
      return { ok: false, error: e.message };
    }
    running.set(kind, entry);
    emit(kind);
    return { ok: true };
  };

  const stop = async (kind) => {
    const r = running.get(kind);
    if (!r) return true;
    running.delete(kind);
    let snap = null; try { snap = r.mon.snapshot(); } catch {}
    try { r.mon.stop(); } catch {}
    const msg = { kind, running: false, opts: r.opts, started: r.started, stopped: Date.now(), snapshot: snap };
    letzte.set(kind, msg);
    send(msg);
    return true;
  };

  const action = async (kind, name, args) => {
    // Stand eines gestoppten Monitors verwerfen
    if (name === 'verwerfen' && !running.has(kind)) { letzte.delete(kind); send({ kind, running: false }); return { ok: true }; }
    if (!running.has(kind) && TOOLS.has(kind)) await start(kind, {});
    const r = running.get(kind);
    if (!r) return { ok: false, error: 'Monitor läuft nicht.' };
    try { const result = await r.mon.action(name, args); r.dirty = true; return { ok: true, result }; }
    catch (e) { return { ok: false, error: e.message }; }
  };

  const state = () => ({
    ...Object.fromEntries(letzte),
    ...Object.fromEntries([...running.entries()].map(([k, r]) => {
      let snap = null; try { snap = r.mon.snapshot(); } catch {}
      return [k, { kind: k, running: true, opts: r.opts, started: r.started, snapshot: snap }];
    })),
  });

  const stopAll = () => { clearInterval(flush); clearInterval(tick); for (const k of [...running.keys()]) stop(k); };

  return { start, stop, action, state, stopAll };
}

function register(ipcMain, getWin) {
  const send = (msg) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('mon-event', msg); };
  const m = createManager(send);
  ipcMain.handle('mon-interfaces', () => listInterfaces());
  ipcMain.handle('mon-start', (_e, { kind, opts }) => m.start(kind, opts));
  ipcMain.handle('mon-stop', (_e, { kind }) => m.stop(kind));
  ipcMain.handle('mon-action', (_e, { kind, name, args }) => m.action(kind, name, args));
  ipcMain.handle('mon-state', () => m.state());
  return m;
}

module.exports = { register, createManager, MODULES };
