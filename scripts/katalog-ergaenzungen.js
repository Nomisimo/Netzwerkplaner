// Hängt die recherchierten Zusatzgeräte aus src/shared/data/katalog-ergaenzungen.json
// (z. B. Aussteller der LEaT con) an die Katalogdaten an. Jeder Eintrag hat eine
// Quelle und einen Datenblatt-Link bzw. die Markierung „Datenblatt vorhanden: Nein“.
// import-data.js ruft das nach jedem Import auf; direkt aufgerufen
// (npm run ergaenzungen) wird katalog.json ohne Import aktualisiert.
// Gleiches Hersteller + Modell wird ersetzt, damit ein zweiter Lauf nichts doppelt.
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "src", "shared", "data");
const ERG = path.join(DATA, "katalog-ergaenzungen.json");

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const anwenden = (katalog, erg = JSON.parse(fs.readFileSync(ERG, "utf8"))) => {
  const hIdx = new Map(katalog.hersteller.map((h, i) => [norm(h.Hersteller), i]));
  for (const h of erg.hersteller || []) {
    const i = hIdx.get(norm(h.Hersteller));
    if (i == null) { hIdx.set(norm(h.Hersteller), katalog.hersteller.length); katalog.hersteller.push({ ...h }); }
    else katalog.hersteller[i] = { ...katalog.hersteller[i], ...Object.fromEntries(Object.entries(h).filter(([k]) => !(k in katalog.hersteller[i]))) };
  }
  const key = (g) => norm(g.Hersteller) + "|" + norm(g.Modell);
  const gIdx = new Map(katalog.geraete.map((g, i) => [key(g), i]));
  let neu = 0, ersetzt = 0;
  for (const g of erg.geraete || []) {
    const i = gIdx.get(key(g));
    if (i == null) { gIdx.set(key(g), katalog.geraete.length); katalog.geraete.push({ ...g }); neu++; }
    else { katalog.geraete[i] = { ...g }; ersetzt++; }
  }
  katalog.quelle = { ...katalog.quelle, ergaenzungen: "src/shared/data/katalog-ergaenzungen.json" };
  return { neu, ersetzt };
};

module.exports = { anwenden };

if (require.main === module) {
  const out = path.join(DATA, "katalog.json");
  const katalog = JSON.parse(fs.readFileSync(out, "utf8"));
  const { neu, ersetzt } = anwenden(katalog);
  fs.writeFileSync(out, JSON.stringify(katalog, null, 1));
  console.log(`katalog.json: ${neu} Geräte ergänzt, ${ersetzt} ersetzt`);
}
