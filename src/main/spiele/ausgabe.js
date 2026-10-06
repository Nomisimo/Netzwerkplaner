// Ausgabe der Spiele an die LED-Matrizen: sACN (E1.31) und NDI.
// Die Oberfläche rendert das 48×24-Bild und schickt es je Bild per IPC hierher;
// der Hauptprozess verteilt es ins Netz. Kein Electron-Import, damit die Funktionen
// im Test unter reinem Node laufen.
const dgram = require('dgram');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const W = 48, H = 24, M = 24; // Leinwand und Kantenlänge einer Matrix

/* ── sACN: Leinwand → DMX ────────────────────────────────────────────────
   Je Matrix 24×24 px aus 36 Kacheln à 4×4, Kacheln spaltenweise nummeriert
   (tile = Spalte·6 + Reihe), Pixel in der Kachel zeilenweise. Wie sacn_output.py. */
function matrixDmx(px, xOffset) {
  const buf = new Uint8Array(M * M * 3);
  for (let mx = 0; mx < M; mx++) {
    for (let my = 0; my < M; my++) {
      const src = (my * W + xOffset + mx) * 3;
      const fixture = ((mx >> 2) * 6 + (my >> 2)) * 16 + (my % 4) * 4 + (mx % 4);
      buf[fixture * 3] = px[src]; buf[fixture * 3 + 1] = px[src + 1]; buf[fixture * 3 + 2] = px[src + 2];
    }
  }
  return buf;
}

// In Universes aufteilen: fpu Fixtures (RGB) je Universe
function universes(buf, fpu) {
  const cpu = Math.max(1, Math.min(170, fpu | 0)) * 3, out = [];
  for (let off = 0; off < buf.length; off += cpu) out.push(buf.subarray(off, off + cpu));
  return out;
}

const multicast = (u) => `239.255.${(u >> 8) & 255}.${u & 255}`;

function sacnPaket(universe, data, seq, cid, quelle) {
  const n = data.length, p = Buffer.alloc(126 + n);
  p.writeUInt16BE(0x0010, 0);
  p.write('ASC-E1.17\0\0\0', 4, 'latin1');
  p.writeUInt16BE(0x7000 | (110 + n), 16);
  p.writeUInt32BE(0x00000004, 18);
  cid.copy(p, 22);
  p.writeUInt16BE(0x7000 | (88 + n), 38);
  p.writeUInt32BE(0x00000002, 40);
  p.write(String(quelle).slice(0, 63), 44, 'utf8');
  p[108] = 100;                 // Priorität
  p[111] = seq & 255;
  p.writeUInt16BE(universe, 113);
  p.writeUInt16BE(0x7000 | (11 + n), 115);
  p[117] = 0x02; p[118] = 0xa1;
  p.writeUInt16BE(0x0001, 121);
  p.writeUInt16BE(n + 1, 123);
  Buffer.from(data.buffer, data.byteOffset, n).copy(p, 126);
  return p;
}

// NDI-Bild: Faktor-fach mit nächstem Nachbarn hochskaliert, BGRA (wie ndi_output.py: 480×240)
function ndiBild(px, f = 10, out = null) {
  const ow = W * f, oh = H * f;
  out = out || Buffer.alloc(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    const sy = (y / f) | 0;
    for (let x = 0; x < ow; x++) {
      const s = (sy * W + ((x / f) | 0)) * 3, d = (y * ow + x) * 4;
      out[d] = px[s + 2]; out[d + 1] = px[s + 1]; out[d + 2] = px[s]; out[d + 3] = 255;
    }
  }
  return out;
}

/* ── sACN-Sender ────────────────────────────────────────────────────────── */
function sacnSender({ iface, u1 = 1, u2 = 5, fpu = 144, quelle = 'Netzwerkplaner Spiele' }) {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  const cid = crypto.randomBytes(16), seq = new Map();
  const st = { on: true, err: '', pakete: 0, universes: [] };
  sock.on('error', (e) => { st.err = e.message; });
  sock.bind(0, () => {
    try { sock.setMulticastTTL(8); } catch {}
    if (iface) { try { sock.setMulticastInterface(iface); } catch (e) { st.err = `Netzwerkkarte ${iface}: ${e.message}`; } }
  });
  const send = (px) => {
    if (st.err) return;
    const list = [];
    [[0, u1], [M, u2]].forEach(([xo, start]) => {
      universes(matrixDmx(px, xo), fpu).forEach((chunk, i) => {
        const u = start + i;
        if (u < 1 || u > 63999) return;
        const s = ((seq.get(u) || 0) + 1) & 255;
        seq.set(u, s);
        list.push(u);
        sock.send(sacnPaket(u, chunk, s, cid, quelle), 5568, multicast(u), (e) => { if (e) st.err = e.message; else st.pakete++; });
      });
    });
    st.universes = list;
  };
  const stop = () => { st.on = false; try { sock.close(); } catch {} };
  return { send, stop, st };
}

/* ── NDI-Sender (NDI Runtime per koffi, wie ctypes im Python-Original) ─── */
function ndiPfade() {
  const p = [];
  for (const v of ['NDI_RUNTIME_DIR_V6', 'NDI_RUNTIME_DIR_V5', 'NDI_RUNTIME_DIR_V4']) {
    const d = process.env[v];
    if (!d) continue;
    p.push(path.join(d, process.arch === 'ia32' ? 'Processing.NDI.Lib.x86.dll' : 'Processing.NDI.Lib.x64.dll'), path.join(d, 'libndi.dylib'));
  }
  if (process.platform === 'win32') {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean))
      for (const v of ['6', '5']) p.push(path.join(base, 'NDI', `NDI ${v} Runtime`, 'v' + v, 'Processing.NDI.Lib.x64.dll'));
  }
  p.push('/Library/NDI SDK for Apple/lib/macOS/libndi.dylib', '/usr/local/lib/libndi.dylib', '/opt/homebrew/lib/libndi.dylib',
    '/usr/lib/libndi.so.6', '/usr/lib/libndi.so.5', '/usr/lib/x86_64-linux-gnu/libndi.so.6', '/usr/lib/x86_64-linux-gnu/libndi.so.5', '/usr/local/lib/libndi.so.6');
  return p;
}

let ndiLib = null; // einmal laden, Funktionen merken
function ladeNdi() {
  if (ndiLib) return ndiLib;
  let koffi;
  try { koffi = require('koffi'); } catch (e) { throw new Error('NDI-Anbindung (koffi) fehlt: ' + e.message); }
  const datei = ndiPfade().find((f) => { try { return fs.existsSync(f); } catch { return false; } });
  if (!datei) throw new Error('NDI Runtime nicht gefunden. Installieren: https://ndi.video/tools/');
  const lib = koffi.load(datei);
  const SendCreate = koffi.struct('NDIlib_send_create_t', { p_ndi_name: 'const char *', p_groups: 'const char *', clock_video: 'bool', clock_audio: 'bool' });
  const VideoFrame = koffi.struct('NDIlib_video_frame_v2_t', {
    xres: 'int', yres: 'int', FourCC: 'uint32', frame_rate_N: 'int', frame_rate_D: 'int', picture_aspect_ratio: 'float',
    frame_format_type: 'int', timecode: 'int64', p_data: 'void *', line_stride_in_bytes: 'int', p_metadata: 'const char *', timestamp: 'int64',
  });
  ndiLib = {
    koffi, datei, VideoFrame, SendCreate,
    initialize: lib.func('bool NDIlib_initialize()'),
    create: lib.func('void *NDIlib_send_create(const NDIlib_send_create_t *p)'),
    destroy: lib.func('void NDIlib_send_destroy(void *p)'),
    sendVideo: lib.func('void NDIlib_send_send_video_v2(void *p, const NDIlib_video_frame_v2_t *f)'),
    connections: lib.func('int NDIlib_send_get_no_connections(void *p, uint32_t timeout)'),
  };
  if (!ndiLib.initialize()) { ndiLib = null; throw new Error('NDIlib_initialize fehlgeschlagen (CPU nicht unterstützt?)'); }
  return ndiLib;
}

const FOURCC_BGRA = 0x41524742, TIMECODE_SYNTHESIZE = 9223372036854775807n;

function ndiSender({ name = 'Matrix Games', faktor = 10 }) {
  const n = ladeNdi();
  const handle = n.create({ p_ndi_name: name, p_groups: null, clock_video: false, clock_audio: false });
  if (!handle) throw new Error('NDIlib_send_create fehlgeschlagen');
  const ow = W * faktor, oh = H * faktor, size = ow * oh * 4;
  const puffer = Buffer.alloc(size);
  const mem = n.koffi.alloc('uint8_t', size);
  const frame = {
    xres: ow, yres: oh, FourCC: FOURCC_BGRA, frame_rate_N: 60, frame_rate_D: 1, picture_aspect_ratio: ow / oh,
    frame_format_type: 1, timecode: TIMECODE_SYNTHESIZE, p_data: mem, line_stride_in_bytes: ow * 4, p_metadata: null, timestamp: 0n,
  };
  const st = { on: true, err: '', name, verbindungen: 0, aufloesung: `${ow}×${oh}`, bilder: 0, lib: n.datei };
  let offen = true;
  const send = (px) => {
    if (!offen || st.err) return;
    try {
      ndiBild(px, faktor, puffer);
      n.koffi.encode(mem, 'uint8_t', puffer, size);
      n.sendVideo(handle, frame);
      st.bilder++;
    } catch (e) { st.err = e.message; }
  };
  const poll = () => { if (offen) { try { st.verbindungen = n.connections(handle, 0); } catch {} } };
  const stop = () => {
    if (!offen) return;
    offen = false; st.on = false;
    try { n.destroy(handle); } catch {}
    try { n.koffi.free(mem); } catch {}
  };
  return { send, stop, poll, st };
}

/* ── Verwaltung & IPC ───────────────────────────────────────────────────── */
function createAusgabe(onStatus = () => {}, onAktiv = () => {}) {
  let sacn = null, ndi = null, cfg = {}, ndiFehler = '';
  let bilder = 0, letzteRate = 0, letzteZeit = Date.now();

  const status = () => ({
    fps: letzteRate,
    sacn: sacn ? { ...sacn.st } : { on: false },
    ndi: ndi ? { ...ndi.st } : { on: false, err: ndiFehler },
  });

  const anwenden = (neu = {}) => {
    const s = neu.sacn || {}, n = neu.ndi || {};
    const alt = cfg;
    cfg = neu;
    // sACN neu aufbauen, wenn sich etwas geändert hat
    if (JSON.stringify(alt.sacn) !== JSON.stringify(s) || (s.on && !sacn)) {
      if (sacn) { sacn.stop(); sacn = null; }
      if (s.on) sacn = sacnSender({ iface: s.iface, u1: +s.u1 || 1, u2: +s.u2 || 5, fpu: +s.fpu || 144 });
    }
    if (JSON.stringify(alt.ndi) !== JSON.stringify(n) || (n.on && !ndi)) {
      if (ndi) { ndi.stop(); ndi = null; }
      ndiFehler = '';
      if (n.on) { try { ndi = ndiSender({ name: n.name || 'Matrix Games' }); } catch (e) { ndiFehler = e.message; } }
    }
    onAktiv(!!(sacn || ndi));
    return status();
  };

  const frame = (px) => {
    if (!px || px.length !== W * H * 3) return;
    bilder++;
    if (sacn) sacn.send(px);
    if (ndi) ndi.send(px);
  };

  const timer = setInterval(() => {
    const now = Date.now();
    letzteRate = Math.round((bilder * 1000) / Math.max(1, now - letzteZeit));
    bilder = 0; letzteZeit = now;
    if (ndi) ndi.poll();
    if (sacn || ndi || cfg.sacn?.on || cfg.ndi?.on) onStatus(status());
  }, 1000);
  if (timer.unref) timer.unref();

  const stopAll = () => { clearInterval(timer); if (sacn) sacn.stop(); if (ndi) ndi.stop(); sacn = ndi = null; };
  return { anwenden, frame, status, stopAll };
}

function register(ipcMain, getWin) {
  const win = () => { const w = getWin(); return w && !w.isDestroyed() ? w : null; };
  const a = createAusgabe(
    (st) => win()?.webContents.send('spiele-status', st),
    // Während der Ausgabe darf Chromium die Seite nicht drosseln, sonst stockt sACN/NDI bei minimiertem Fenster
    (aktiv) => { try { win()?.webContents.setBackgroundThrottling(!aktiv); } catch {} },
  );
  ipcMain.handle('spiele-ausgabe', (_e, cfg) => a.anwenden(cfg));
  ipcMain.handle('spiele-status', () => a.status());
  ipcMain.on('spiele-frame', (_e, px) => a.frame(px));
  return a;
}

module.exports = { register, createAusgabe, matrixDmx, universes, sacnPaket, multicast, ndiBild, sacnSender };
