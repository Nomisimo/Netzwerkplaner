// Stellt die Mac-Konfiguration in package.json auf Signieren mit Developer-ID-Zertifikat
// und Beglaubigung (Notarisierung) bei Apple um. Läuft nur im Release-Workflow, wenn die
// Secrets gesetzt sind; ohne sie bleibt die App wie bisher ad-hoc signiert.
// Zertifikat und Passwort liest electron-builder aus CSC_LINK und CSC_KEY_PASSWORD,
// die Beglaubigung nutzt APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD und APPLE_TEAM_ID.
const fs = require("fs");
const path = require("path");

const datei = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(datei, "utf8"));
const fehlt = ["CSC_LINK", "CSC_KEY_PASSWORD", "APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"].filter((k) => !process.env[k]);
if (fehlt.length) {
  console.error(`Für die Mac-Signierung fehlen: ${fehlt.join(", ")}`);
  process.exit(1);
}
const mac = { ...pkg.build.mac };
delete mac.identity; // Zertifikat aus CSC_LINK statt ad-hoc
Object.assign(mac, {
  hardenedRuntime: true,
  gatekeeperAssess: false,
  entitlements: "build/entitlements.mac.plist",
  entitlementsInherit: "build/entitlements.mac.plist",
  notarize: true,
});
pkg.build.mac = mac;
fs.writeFileSync(datei, JSON.stringify(pkg, null, 2) + "\n");
console.log("Mac-Build wird signiert und bei Apple beglaubigt.");
