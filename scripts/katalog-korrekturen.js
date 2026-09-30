// Legt die geprüften Werte aus src/shared/data/katalog-korrekturen.json über
// die Katalogdaten. import-data.js ruft das nach jedem Import auf; direkt
// aufgerufen (npm run korrekturen) wird katalog.json ohne Import aktualisiert.
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "src", "shared", "data");
const KORR = path.join(DATA, "katalog-korrekturen.json");

const anwenden = (katalog, { korrekturen, stand } = JSON.parse(fs.readFileSync(KORR, "utf8"))) => {
  const monat = stand ? `${stand.slice(5, 7)}/${stand.slice(0, 4)}` : "";
  const fehlend = [];
  for (const k of korrekturen) {
    const g = katalog.geraete.find((x) => x.Hersteller === k.Hersteller && x.Modell === k.Modell);
    if (!g) { fehlend.push(`${k.Hersteller} ${k.Modell}`); continue; }
    Object.assign(g, k.felder, { Quelle: k.Quelle, Datenstand: k.Datenstand || `Herstellerdoku geprüft ${monat}` });
  }
  if (fehlend.length) console.warn(`Korrekturen ohne Katalogeintrag: ${fehlend.join("; ")}`);
  return korrekturen.length - fehlend.length;
};

module.exports = { anwenden };

if (require.main === module) {
  const out = path.join(DATA, "katalog.json");
  const katalog = JSON.parse(fs.readFileSync(out, "utf8"));
  const n = anwenden(katalog);
  fs.writeFileSync(out, JSON.stringify(katalog, null, 1));
  console.log(`katalog.json: ${n} Korrekturen angewendet`);
}
