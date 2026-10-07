// Erzeugt src/shared/data/oui.json aus der IEEE-Herstellerliste (Paket „oui-data“, BSD-2-Clause,
// Daten von standards-oui.ieee.org). Präfix (6, 7 oder 9 Hex-Zeichen: MA-L, MA-M, MA-S) → Herstellername.
// Aufruf: npm run import-oui (danach oui.json einchecken; die App lädt nichts aus dem Internet)
const fs = require("fs");
const path = require("path");

const src = require("oui-data");
const out = {};
for (const [prefix, text] of Object.entries(src)) {
  const name = String(text).split("\n")[0].replace(/\s+/g, " ").trim();
  // Sammelblöcke der IEEE (MA-M/MA-S-Bereiche) sagen nichts über das Gerät; die Unterblöcke stehen einzeln drin
  if (!name || /^IEEE Registration Authority$/i.test(name)) continue;
  out[prefix.toUpperCase()] = name;
}
const ziel = path.join(__dirname, "..", "src", "shared", "data", "oui.json");
fs.writeFileSync(ziel, JSON.stringify(out));
const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules", "oui-data", "package.json"), "utf8")).version;
console.log(`${Object.keys(out).length} Präfixe aus oui-data ${version} → ${path.relative(process.cwd(), ziel)} (${Math.round(fs.statSync(ziel).size / 1024)} KB)`);
