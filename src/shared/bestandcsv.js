/* ── Gerätebestand als CSV ────────────────────────────────────────────────
   Austausch zwischen Netzwerkplaner-Installationen und Import aus eigenen
   Listen (Excel → CSV). Eine Zeile je Gerät, bis zu drei Interfaces. */
import { KATALOG_GERAETE, createDevice, snapshotDevice, newIface, newPort, uid } from "./catalog.js";
import { TYPEN } from "./constants.js";

export const CSV_SPALTEN = ["Name", "Netzwerkname", "Hersteller", "Modell", "Typ", "Bereich", "Standort",
  "IP1", "VLAN1", "MAC1", "IP2", "VLAN2", "MAC2", "IP3", "VLAN3", "MAC3",
  "Inventar-Nr.", "Seriennummer", "Case", "Notiz", "Katalog-ID"];

const zelle = (v) => {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const bestandZuCsv = (bestand) => {
  const zeilen = [CSV_SPALTEN.join(";")];
  for (const b of bestand) {
    const g = b.geraet;
    const ifs = (g.interfaces || []).slice(0, 3);
    const r = { Name: b.name || g.name, Netzwerkname: g.netzname || "", Hersteller: g.hersteller || "", Modell: g.modell || "", Typ: g.typ || "", Bereich: g.kategorie || "", Standort: g.bereich || "",
      "Inventar-Nr.": g.inventar?.nr || "", Seriennummer: g.inventar?.sn || "", Case: g.inventar?.case || "", Notiz: g.notizen || "", "Katalog-ID": g.katalogId || "" };
    ifs.forEach((i, n) => {
      r[`IP${n + 1}`] = i.dhcp ? "DHCP" : i.ip ? `${i.ip}/${i.prefix || 24}` : "";
      r[`VLAN${n + 1}`] = i.vid ?? "";
      r[`MAC${n + 1}`] = i.mac || "";
    });
    zeilen.push(CSV_SPALTEN.map((k) => zelle(r[k])).join(";"));
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

// Zeilen → Bestandseinträge ({ id, name, geraet, angelegt, geaendert }); vlans = VLANs des offenen Projekts
export const csvZuBestand = (text, vlans = []) => {
  const zeilen = parseCsv(text);
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
    dev.inventar = { nr: r["Inventar-Nr."] || "", sn: r.Seriennummer || "", case: r.Case || "" };
    if (r.Notiz) dev.notizen = r.Notiz;
    const vids = [];
    for (let i = 1; i <= 3; i++) {
      const ip = r[`IP${i}`], vid = r[`VLAN${i}`], mac = r[`MAC${i}`];
      if (!ip && !mac && !vid) continue;
      let ifc = dev.interfaces[i - 1];
      if (!ifc) {
        ifc = newIface({ name: `ETH${i}` });
        dev.interfaces.push(ifc);
        const frei = dev.ports.find((p) => !p.iface && !p.p2p);
        if (frei) frei.iface = ifc.id;
        else if (!dev.isSwitch) dev.ports.push(newPort({ name: `ETH${i}`, iface: ifc.id }));
      }
      if (/^dhcp$/i.test(ip || "")) { ifc.dhcp = true; ifc.ip = ""; }
      else if (ip) {
        const [a, p] = ip.split("/");
        ifc.ip = a.trim(); ifc.dhcp = false;
        if (p) ifc.prefix = +p;
      }
      if (mac) ifc.mac = mac;
      vids[i - 1] = vid ? +vid : null;
    }
    const g = snapshotDevice(dev, vlans);
    g.interfaces.forEach((ifc, i) => { if (vids[i] != null && !Number.isNaN(vids[i])) ifc.vid = vids[i]; });
    const now = new Date().toISOString();
    out.push({ id: uid(), name, geraet: g, angelegt: now, geaendert: now });
  });
  return { bestand: out, fehler };
};
