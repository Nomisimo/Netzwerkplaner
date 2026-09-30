/* ── Gerätebestand als CSV ────────────────────────────────────────────────
   Austausch zwischen Netzwerkplaner-Installationen und Import aus eigenen
   Listen (Excel → CSV). Eine Zeile je Gerät, bis zu drei IP-Ports. */
import { bestandSchluessel } from "./bestandschluessel.js";
import { KATALOG_GERAETE, createDevice, snapshotDevice, newPort, ipPorts, uid } from "./catalog.js";
import { TYPEN } from "./constants.js";
import { feldSpalten } from "./felder.js";

export const CSV_SPALTEN = ["Name", "Netzwerkname", "Hersteller", "Modell", "Typ", "Bereich", "Standort",
  "IP1", "VLAN1", "MAC1", "IP2", "VLAN2", "MAC2", "IP3", "VLAN3", "MAC3",
  "Notiz", "Katalog-ID"];
// Danach folgt je eigenem Feld eine Spalte mit dem Feldnamen

const zelle = (v) => {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const bestandZuCsv = (bestand, feldDefs = []) => {
  const felder = feldSpalten(bestand.map((b) => b.geraet), feldDefs).filter((f) => !CSV_SPALTEN.includes(f.name));
  const spalten = [...CSV_SPALTEN, ...felder.map((f) => f.name)];
  const zeilen = [spalten.join(";")];
  for (const b of bestand) {
    const g = b.geraet;
    const ifs = ipPorts(g).slice(0, 3);
    const r = { Name: b.name || g.name, Netzwerkname: g.netzname || "", Hersteller: g.hersteller || "", Modell: g.modell || "", Typ: g.typ || "", Bereich: g.kategorie || "", Standort: g.bereich || "",
      Notiz: g.notizen || "", "Katalog-ID": g.katalogId || "" };
    ifs.forEach((i, n) => {
      r[`IP${n + 1}`] = i.dhcp ? "DHCP" : i.ip ? `${i.ip}/${i.prefix || 24}` : "";
      r[`VLAN${n + 1}`] = i.vid ?? "";
      r[`MAC${n + 1}`] = i.mac || "";
    });
    for (const f of felder) r[f.name] = (g.felder || []).find((x) => x.id === f.id)?.wert || "";
    zeilen.push(spalten.map((k) => zelle(r[k])).join(";"));
  }
  return "﻿" + zeilen.join("\r\n") + "\r\n";
};

// CSV lesen: Trenner ; , oder Tab, Anführungszeichen nach RFC 4180
export const parseCsv = (text) => {
  const t = String(text).replace(/^﻿/, "");
  const erste = t.split(/\r?\n/)[0] || "";
  const sep = [";", "\t", ","].sort((a, b) => erste.split(b).length - erste.split(a).length)[0];
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const kopf = (rows.shift() || []).map((h) => h.trim());
  return rows.filter((r) => r.some((c) => c.trim())).map((r) => Object.fromEntries(kopf.map((h, i) => [h, (r[i] ?? "").trim()])));
};

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const findeModell = (r) => {
  if (r["Katalog-ID"]) { const k = KATALOG_GERAETE.find((g) => g.id === r["Katalog-ID"]); if (k) return k; }
  if (!r.Modell) return null;
  const m = norm(r.Modell), h = norm(r.Hersteller);
  return KATALOG_GERAETE.find((g) => norm(g.modell) === m && (!h || norm(g.hersteller) === h))
    || KATALOG_GERAETE.find((g) => norm(g.modell) === m) || null;
};
const findeTyp = (s) => {
  if (!s) return null;
  if (TYPEN[s]) return s;
  const n = norm(s);
  return Object.keys(TYPEN).find((k) => norm(TYPEN[k].label) === n) || null;
};

const STANDARD_SPALTE = new Set(CSV_SPALTEN.map(norm));
const IFACE_SPALTE = /^(ip|vlan|mac)\d+$/;
// Bekannte Feldnamen (auch die früheren festen Inventarspalten) auf ihre Feld-ID abbilden
const ALIAS = { inventarnr: "inventar-nr", inventarnummer: "inventar-nr", seriennummer: "seriennummer", sn: "seriennummer", case: "case", caselagerort: "case" };

// Zeilen → Bestandseinträge ({ id, name, geraet, angelegt, geaendert }); vlans = VLANs des offenen Projekts.
// Unbekannte Spalten werden eigene Felder; feldDefs = Felder aus dem Katalog (Zuordnung über den Namen)
export const csvZuBestand = (text, vlans = [], feldDefs = []) => {
  const zeilen = parseCsv(text);
  const feldId = new Map(feldDefs.map((f) => [norm(f.name), f.id]));
  const idFuer = (spalte) => {
    const n = norm(spalte);
    if (!feldId.has(n)) feldId.set(n, ALIAS[n] && ![...feldId.values()].includes(ALIAS[n]) ? ALIAS[n] : uid());
    return feldId.get(n);
  };
  const out = [], fehler = [];
  zeilen.forEach((r, n) => {
    const name = r.Name || r.Netzwerkname;
    if (!name) { fehler.push(`Zeile ${n + 2}: kein Name`); return; }
    const k = findeModell(r);
    const dev = createDevice({ katalogId: k?.id, typ: k ? null : findeTyp(r.Typ) || "sonstiges", vlans, name });
    if (!k) { if (r.Hersteller) dev.hersteller = r.Hersteller; if (r.Modell) dev.modell = r.Modell; }
    if (r.Netzwerkname) dev.netzname = r.Netzwerkname;
    if (r.Bereich) dev.kategorie = r.Bereich;
    if (r.Standort) dev.bereich = r.Standort;
    dev.felder = Object.keys(r).filter((k) => k && r[k] && !STANDARD_SPALTE.has(norm(k)) && !IFACE_SPALTE.test(norm(k)))
      .map((k) => ({ id: idFuer(k), name: k, wert: r[k] }));
    if (r.Notiz) dev.notizen = r.Notiz;
    const vids = {};
    const ziele = ipPorts(dev);
    for (let i = 1; i <= 3; i++) {
      const ip = r[`IP${i}`], vid = r[`VLAN${i}`], mac = r[`MAC${i}`];
      if (!ip && !mac && !vid) continue;
      let ifc = ziele[i - 1];
      if (!ifc) { ifc = newPort({ name: `ETH${i}`, virtuell: !!dev.isSwitch }); dev.ports.push(ifc); ziele[i - 1] = ifc; }
      if (/^dhcp$/i.test(ip || "")) { ifc.dhcp = true; ifc.ip = ""; }
      else if (ip) {
        const [a, p] = ip.split("/");
        ifc.ip = a.trim(); ifc.dhcp = false;
        if (p) ifc.prefix = +p;
      }
      if (mac) ifc.mac = mac;
      if (vid && !Number.isNaN(+vid)) vids[ifc.id] = +vid;
    }
    const g = snapshotDevice(dev, vlans);
    g.ports.forEach((p) => { if (vids[p.id] != null) p.vid = vids[p.id]; });
    const now = new Date().toISOString();
    // Fester Schlüssel statt Zufalls-ID: derselbe Bestand auf zwei Rechnern ergibt dieselben IDs
    const key = bestandSchluessel(g);
    const id = key && !out.some((b) => b.id === key) ? key : uid();
    out.push({ id, name, geraet: g, angelegt: now, geaendert: now });
  });
  return { bestand: out, fehler };
};
