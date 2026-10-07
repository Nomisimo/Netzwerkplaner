// Übernimmt Hardwarekatalog und Protokollrecherche aus dem Projektordner
// in src/shared/data/katalog.json (wird beim Build in die App eingebettet).
//
// Aufruf:  node scripts/import-data.js [Projektordner]
// Standard-Projektordner: /mnt/project-files
//
// Liegt hardware/fokus/fokus_katalog.json vor, ergänzt bzw. ersetzt sie die
// Einträge der Fokus-Hersteller (gleiches Modell = Fokus-Daten gewinnen) und
// bringt die Tiefenrecherche der Kernprotokolle und die Switch-Empfehlungen mit.
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const SRC = process.argv[2] || process.env.NETZPLAN_DATA || "/mnt/project-files";
const OUT = path.join(__dirname, "..", "src", "shared", "data", "katalog.json");

const geraeteFile = path.join(SRC, "hardware", "geraete.json");
const fokusFile   = path.join(SRC, "hardware", "fokus", "fokus_katalog.json");
const protoFile   = path.join(SRC, "recherche", "netzwerkprotokolle_veranstaltungstechnik.xlsx");

const hw = JSON.parse(fs.readFileSync(geraeteFile, "utf8"));
const wb = XLSX.readFile(protoFile);
const sheet = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });

const trim = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.trim(), typeof v === "string" ? v.trim() : v]));
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const out = {
  stand: hw.stand,
  quelle: {
    geraete: "hardware/geraete.json",
    protokolle: "recherche/netzwerkprotokolle_veranstaltungstechnik.xlsx",
  },
  hersteller: hw.hersteller.map(trim),
  geraete: hw.geraete.map(trim),
  protokolle: sheet("Protokolle").map(trim),
  mdns: sheet("mDNS-Dienste").map(trim),
  qos: sheet("QoS-DSCP").map(trim),
  infrastruktur: sheet("Infrastruktur").map(trim),
  fokus: [],
  kernprotokolle: [],
  switch_empfehlungen: [],
};

// Namen der Fokus-Recherche, die in der Protokollliste anders heißen
const PROTO_ALIAS = {
  "sACN (ANSI E1.31)": "sACN (Streaming ACN)",
  "NDI (NDI 5/6, High Bandwidth, HX2/HX3)": "NDI (NDI 5/6, HX)",
};

if (fs.existsSync(fokusFile)) {
  const fk = JSON.parse(fs.readFileSync(fokusFile, "utf8"));
  out.quelle.fokus = "hardware/fokus/fokus_katalog.json";
  out.fokus = fk.fokus || [];
  const fokusNorm = new Set(out.fokus.map((h) => norm(h.replace(/\s*\(.*\)/, ""))));

  // Hersteller ergänzen
  const hNames = new Map(out.hersteller.map((h, i) => [norm(h.Hersteller), i]));
  for (const h of fk.hersteller || []) {
    const i = hNames.get(norm(h.Hersteller));
    if (i == null) out.hersteller.push({ Hersteller: h.Hersteller, Website: h.Website || "", Notiz: h.Notiz || "", Fokus: "Ja" });
    else out.hersteller[i] = { ...out.hersteller[i], Fokus: "Ja" };
  }

  // Alte Einträge der Fokus-Hersteller entfernen, wenn die Fokus-Recherche dasselbe
  // Modell (auch in anderer Schreibweise, z. B. als Einzelvariante) enthält
  const fkBy = new Map();
  for (const g of fk.geraete || []) { const h = norm(g.Hersteller); if (!fkBy.has(h)) fkBy.set(h, []); fkBy.get(h).push(norm(g.Modell)); }
  const vorher = out.geraete.length;
  out.geraete = out.geraete.filter((g) => {
    const list = fkBy.get(norm(g.Hersteller));
    if (!list) return true;
    const base = norm(g.Modell.split(/\s\/\s|\(/)[0]);
    return !list.some((m) => m === norm(g.Modell) || (base.length > 4 && m.includes(base)));
  });
  const entfernt = vorher - out.geraete.length;

  // Geräte: gleiches Modell wird ersetzt, neue werden angehängt
  const key = (g) => norm(g.Hersteller) + "|" + norm(g.Modell);
  const idx = new Map(out.geraete.map((g, i) => [key(g), i]));
  let ersetzt = 0, neu = 0;
  for (const g0 of fk.geraete || []) {
    const g = { ...trim(g0), Fokus: "Ja" };
    const i = idx.get(key(g));
    if (i != null) { out.geraete[i] = g; ersetzt++; } else { idx.set(key(g), out.geraete.length); out.geraete.push(g); neu++; }
  }
  // Geräte anderer Quellen, deren Hersteller zum Fokus gehört, ebenfalls markieren
  for (const g of out.geraete) if (!g.Fokus && [...fokusNorm].some((f) => norm(g.Hersteller).startsWith(f))) g.Fokus = "Ja";

  // Protokolle: gleicher Name (bzw. Alias) wird ersetzt, der Name der Liste bleibt
  const pIdx = new Map(out.protokolle.map((p, i) => [norm(p.Protokoll), i]));
  let pErs = 0, pNeu = 0;
  for (const p0 of fk.protokolle || []) {
    const p = trim(p0);
    const name = PROTO_ALIAS[p.Protokoll] || p.Protokoll;
    const i = pIdx.get(norm(name));
    if (i != null) { out.protokolle[i] = { ...p, Protokoll: out.protokolle[i].Protokoll, Fokus: "Ja" }; pErs++; }
    else { pIdx.set(norm(name), out.protokolle.length); out.protokolle.push({ ...p, Fokus: "Ja" }); pNeu++; }
  }
  out.kernprotokolle = (fk.kernprotokolle || []).map(trim);
  out.switch_empfehlungen = (fk.switch_empfehlungen || []).map(trim);
  console.log(`Fokus-Katalog: ${entfernt} alte Einträge durch Fokus-Daten ersetzt, ${ersetzt + neu} Fokus-Geräte; ${pErs} Protokolle ersetzt, ${pNeu} neu; ${out.kernprotokolle.length} Kernprotokolle, ${out.switch_empfehlungen.length} Switch-Empfehlungen`);
}

// Recherchierte Zusatzgeräte (katalog-ergaenzungen.json, je Gerät mit Quelle und Datenblatt)
const erg = require("./katalog-ergaenzungen.js").anwenden(out);
console.log(`${erg.neu} Zusatzgeräte ergänzt, ${erg.ersetzt} ersetzt`);

// Geprüfte Werte aus katalog-korrekturen.json gewinnen gegen die Rohdaten
const nKorr = require("./katalog-korrekturen.js").anwenden(out);
console.log(`${nKorr} geprüfte Korrekturen angewendet`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`katalog.json: ${out.geraete.length} Geräte, ${out.hersteller.length} Hersteller, ${out.protokolle.length} Protokolle`);
