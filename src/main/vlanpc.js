// VLANs am eigenen Rechner (nur macOS): getaggte VLAN-Schnittstellen per networksetup anlegen und entfernen,
// damit der Rechner am Trunk-Port alle geplanten VLANs sieht. Anlegen und Entfernen laufen als ein Skript
// mit einer einzigen Admin-Abfrage. Die App fasst nur VLANs an, deren Name mit PREFIX beginnt.
// Die Parser und Skript-Bauer sind rein, damit sie unter Node getestet werden können.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PREFIX = 'NP VLAN ';
const IP_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const DEV_RE = /^en\d{1,3}$/;

const ip2int = (s) => s.split('.').reduce((a, o) => ((a << 8) >>> 0) + (+o), 0) >>> 0;
const gueltigeMaske = (m) => IP_RE.test(m) && /^1+0*$/.test(ip2int(m).toString(2).padStart(32, '0')) && m !== '255.255.255.255';
const vlanName = (vid) => `${PREFIX}${vid}`;
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

const bloecke = (text) => String(text || '').split(/\n\s*\n/).map((b) => Object.fromEntries(
  b.split('\n').map((z) => { const i = z.indexOf(':'); return i < 0 ? null : [z.slice(0, i).trim(), z.slice(i + 1).trim()]; }).filter(Boolean),
)).filter((o) => Object.keys(o).length);

// networksetup -listallhardwareports → [{ port, device, mac }]; nur kabelgebundene Karten (enX, kein WLAN)
function parseHardwarePorts(text) {
  return bloecke(text)
    .map((o) => ({ port: o['Hardware Port'] || '', device: o.Device || '', mac: o['Ethernet Address'] || '' }))
    .filter((p) => DEV_RE.test(p.device) && !/wi-?fi|airport|wlan/i.test(p.port));
}

// networksetup -listVLANs → [{ name, parent, device, tag, eigen }]
function parseVlans(text) {
  return bloecke(text)
    .filter((o) => o['VLAN User Defined Name'] !== undefined)
    .map((o) => {
      const name = o['VLAN User Defined Name'];
      const device = Object.entries(o).find(([k]) => /^Device/.test(k))?.[1] || '';
      return { name, parent: o['Parent Device'] || '', device, tag: +o.Tag || 0, eigen: name.startsWith(PREFIX) };
    });
}

// Einträge prüfen: [{ vid, dhcp, ip, mask }] → { ok, fehler, eintraege }
function pruefen(parent, eintraege) {
  if (!DEV_RE.test(parent || '')) return { ok: false, fehler: 'Ungültige Netzwerkkarte.' };
  if (!Array.isArray(eintraege) || !eintraege.length) return { ok: false, fehler: 'Kein VLAN ausgewählt.' };
  const out = [], vids = new Set();
  for (const e of eintraege) {
    const vid = +e.vid;
    if (!Number.isInteger(vid) || vid < 1 || vid > 4094) return { ok: false, fehler: `Ungültige VLAN-ID: ${e.vid}` };
    if (vids.has(vid)) return { ok: false, fehler: `VLAN ${vid} ist doppelt ausgewählt.` };
    vids.add(vid);
    if (e.dhcp) { out.push({ vid, dhcp: true }); continue; }
    if (!IP_RE.test(e.ip || '')) return { ok: false, fehler: `VLAN ${vid}: ungültige IP „${e.ip || ''}“.` };
    if (!gueltigeMaske(e.mask || '')) return { ok: false, fehler: `VLAN ${vid}: ungültige Subnetzmaske „${e.mask || ''}“.` };
    out.push({ vid, dhcp: false, ip: e.ip, mask: e.mask });
  }
  return { ok: true, eintraege: out };
}

// networksetup meldet Fehler oft nur als Text mit Exit-Code 0; ns() wertet beides aus
const KOPF = [
  '#!/bin/sh',
  'PATH=/usr/sbin:/usr/bin:/bin:/sbin',
  'ns() { out=$(networksetup "$@" 2>&1); r=$?; case "$out" in *rror*|*"not a recognized"*|*annot*|*"not found"*) return 1;; esac; return $r; }',
];
const hatVlan = (name) => `networksetup -listVLANs 2>/dev/null | grep -qxF ${q(`VLAN User Defined Name: ${name}`)}`;

// Shell-Snippet: eigene VLAN entfernen (samt Netzwerkdienst, falls er stehen bleibt)
const entfernenZeilen = (v) => [
  `ns -deleteVLAN ${q(v.name)} ${q(v.parent)} ${+v.tag}; ${hatVlan(v.name)} && echo ${q(`FEHLER entfernen ${v.name}`)} || echo ${q(`OK entfernt ${v.name}`)}`,
  `networksetup -listallnetworkservices 2>/dev/null | sed 's/^\\*//' | grep -qxF ${q(v.name)} && ns -removenetworkservice ${q(v.name)}`,
];

// Skript zum Anlegen. Vorhandene eigene VLANs mit derselben ID werden vorher entfernt, sodass erneutes
// Anlegen die Einstellungen ersetzt. Kein Router/Gateway: die Standardroute bleibt beim Hauptanschluss.
function anlegenSkript(parent, eintraege, vorhanden = []) {
  const z = [...KOPF];
  for (const e of eintraege) {
    const name = vlanName(e.vid);
    for (const v of vorhanden.filter((x) => x.eigen && (x.tag === e.vid || x.name === name))) z.push(...entfernenZeilen(v));
    z.push(
      `ns -createVLAN ${q(name)} ${q(parent)} ${e.vid}`,
      `if ${hatVlan(name)}; then`,
      // Manche macOS-Versionen legen den Netzwerkdienst nicht selbst an
      `  if ! networksetup -listallnetworkservices 2>/dev/null | sed 's/^\\*//' | grep -qxF ${q(name)}; then`,
      `    DEV=$(networksetup -listVLANs | awk -v n=${q(name)} '/^VLAN User Defined Name:/{c=(substr($0,index($0,":")+2)==n)} c&&/^Device/{print $NF;exit}')`,
      `    ns -createnetworkservice ${q(name)} ${q(name)} || ns -createnetworkservice ${q(name)} "$DEV"`,
      '  fi',
      e.dhcp
        ? `  ns -setdhcp ${q(name)} && echo ${q(`OK ${name} DHCP`)} || echo ${q(`FEHLER ${name} DHCP`)}`
        : `  ns -setmanual ${q(name)} ${e.ip} ${e.mask} && echo ${q(`OK ${name} ${e.ip}`)} || echo ${q(`FEHLER ${name} IP`)}`,
      'else',
      `  echo ${q(`FEHLER anlegen ${name}: `)}"$(echo "$out" | head -n 1)"`,
      'fi',
    );
  }
  return z.join('\n') + '\n';
}

function entfernenSkript(vorhanden) {
  const z = [...KOPF];
  for (const v of vorhanden.filter((x) => x.eigen)) z.push(...entfernenZeilen(v));
  return z.join('\n') + '\n';
}

// Ausgabe des Skripts → { ok, meldungen: [{ ok, text }] }
function auswerten(out) {
  const meldungen = String(out || '').split('\n').map((s) => s.trim()).filter((s) => /^(OK|FEHLER) /.test(s))
    .map((s) => ({ ok: s.startsWith('OK '), text: s.replace(/^(OK|FEHLER) /, '') }));
  return { ok: meldungen.every((m) => m.ok), meldungen };
}

/* ── Ausführen (nur macOS) ─────────────────────────────────────────────── */
const run = (cmd, args, timeout = 15000) => new Promise((resolve) => {
  execFile(cmd, args, { timeout }, (err, stdout, stderr) => resolve({ err, stdout: String(stdout || ''), stderr: String(stderr || '') }));
});

async function status() {
  if (process.platform !== 'darwin') return { unterstuetzt: false, ports: [], vlans: [] };
  const [hw, vl] = await Promise.all([run('networksetup', ['-listallhardwareports']), run('networksetup', ['-listVLANs'])]);
  if (hw.err) return { unterstuetzt: true, ports: [], vlans: [], fehler: hw.stderr || hw.err.message };
  return { unterstuetzt: true, ports: parseHardwarePorts(hw.stdout), vlans: parseVlans(vl.stdout) };
}

// Skript in eine Datei schreiben und mit einer Admin-Abfrage (macOS-Passwortdialog) ausführen
async function alsAdmin(skript) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'np-vlan-'));
  const datei = path.join(dir, 'vlan.sh');
  fs.writeFileSync(datei, skript, { mode: 0o600 });
  try {
    const r = await run('osascript', ['-e', `do shell script "/bin/sh ${datei}" with administrator privileges`], 120000);
    if (r.err && /-128|abgebrochen|cancel/i.test(r.stderr)) return { ok: false, abgebrochen: true, meldungen: [] };
    if (r.err && !r.stdout) return { ok: false, fehler: r.stderr.trim() || r.err.message, meldungen: [] };
    return auswerten(r.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function anlegen({ parent, eintraege }) {
  if (process.platform !== 'darwin') return { ok: false, fehler: 'Nur unter macOS.' };
  const p = pruefen(parent, eintraege);
  if (!p.ok) return p;
  const s = await status();
  if (!s.ports.some((x) => x.device === parent)) return { ok: false, fehler: `Netzwerkkarte ${parent} nicht gefunden.` };
  return alsAdmin(anlegenSkript(parent, p.eintraege, s.vlans));
}

async function entfernen() {
  if (process.platform !== 'darwin') return { ok: false, fehler: 'Nur unter macOS.' };
  const s = await status();
  if (!s.vlans.some((v) => v.eigen)) return { ok: true, meldungen: [] };
  return alsAdmin(entfernenSkript(s.vlans));
}

function register(ipcMain) {
  ipcMain.handle('vlanpc-status', () => status());
  ipcMain.handle('vlanpc-anlegen', (_e, args) => anlegen(args || {}));
  ipcMain.handle('vlanpc-entfernen', () => entfernen());
}

module.exports = { register, PREFIX, vlanName, parseHardwarePorts, parseVlans, pruefen, anlegenSkript, entfernenSkript, auswerten };
