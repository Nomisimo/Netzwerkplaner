// Übernimmt Hardwarekatalog und Protokollrecherche aus dem Projektordner
// in src/shared/data/katalog.json (wird beim Build in die App eingebettet).
//
// Aufruf:  node scripts/import-data.js [Projektordner]
// Standard-Projektordner: /mnt/project-files
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const SRC = process.argv[2] || process.env.NETZPLAN_DATA || "/mnt/project-files";
const OUT = path.join(__dirname, "..", "src", "shared", "data", "katalog.json");

const geraeteFile = path.join(SRC, "hardware", "geraete.json");
const protoFile   = path.join(SRC, "recherche", "netzwerkprotokolle_veranstaltungstechnik.xlsx");

const hw = JSON.parse(fs.readFileSync(geraeteFile, "utf8"));
const wb = XLSX.readFile(protoFile);
const sheet = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });

const trim = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.trim(), typeof v === "string" ? v.trim() : v]));

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
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`katalog.json: ${out.geraete.length} Geräte, ${out.hersteller.length} Hersteller, ${out.protokolle.length} Protokolle`);
