/* ── MAC-Adressen: Format prüfen und Hersteller erkennen ───────────────────
   Die ersten Bytes einer MAC (OUI) vergibt die IEEE an Hersteller. Die Liste steckt als
   src/shared/data/oui.json in der App (erzeugt mit „npm run import-oui“), es wird nichts nachgeladen. */
import OUI from "./data/oui.json";

const HEX12 = /^[0-9a-f]{12}$/;

// Schreibweisen vereinheitlichen: 00:1D:C1:…, 00-1d-c1-…, 001d.c1xx.xxxx, 001dc1xxxxxx und
// einstellige Bytes aus der ARP-Tabelle von macOS (0:1d:c1:…). Ungültig → "".
export const normMac = (s) => {
  const t = String(s || "").trim().toLowerCase();
  if (!t) return "";
  let hex;
  if (/^[0-9a-f]{1,2}([:-][0-9a-f]{1,2}){5}$/.test(t)) hex = t.split(/[:-]/).map((x) => x.padStart(2, "0")).join("");
  else if (/^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/.test(t)) hex = t.replace(/\./g, "");
  else hex = t;
  if (!HEX12.test(hex)) return "";
  return hex.match(/../g).join(":");
};

export const istGueltigeMac = (s) => !!normMac(s);
const ersterByte = (mac) => parseInt(mac.slice(0, 2), 16);
// Bit 0 des ersten Bytes: Gruppenadresse (Multicast/Broadcast), kein einzelnes Gerät
export const istMulticastMac = (s) => { const m = normMac(s); return !!m && (ersterByte(m) & 1) === 1; };
// Bit 1 des ersten Bytes: lokal vergeben (z. B. „Private WLAN-Adresse“ bei iPhone/iPad, virtuelle Maschinen)
export const istLokaleMac = (s) => { const m = normMac(s); return !!m && (ersterByte(m) & 2) === 2; };

/* Hersteller zu einer MAC.
   art: "hersteller" (gefunden), "lokal" (zufällig/selbst vergeben), "multicast", "unbekannt", "ungueltig" */
export const macHersteller = (s) => {
  const m = normMac(s);
  if (!m) return { art: "ungueltig", name: "" };
  if (m === "ff:ff:ff:ff:ff:ff" || istMulticastMac(m)) return { art: "multicast", name: "" };
  if (istLokaleMac(m)) return { art: "lokal", name: "" };
  const hex = m.replace(/:/g, "").toUpperCase();
  // Kleine Blöcke (MA-S, 36 bit) vor mittleren (MA-M, 28 bit) vor großen (MA-L, 24 bit)
  const name = OUI[hex.slice(0, 9)] || OUI[hex.slice(0, 7)] || OUI[hex.slice(0, 6)] || "";
  return name ? { art: "hersteller", name } : { art: "unbekannt", name: "" };
};

// Kurztext für Tabellen und Editor
export const macHerstellerText = (s) => {
  const h = macHersteller(s);
  return h.art === "hersteller" ? h.name : h.art === "lokal" ? "privat/zufällig" : h.art === "multicast" ? "Multicast" : h.art === "ungueltig" ? "ungültig" : "";
};

/* Netzwerkchips, die viele Hersteller verbauen: Deren MAC sagt nichts über den Gerätehersteller.
   Audinate steckt in fast jedem Dante-Gerät (Brooklyn, Ultimo, Dante AVIO …). */
const CHIP_HERSTELLER = /audinate|intel|realtek|microchip|texas instruments|espressif|raspberry|silicon labs|wiznet|hon hai|foxconn|azurewave|murata|broadcom|qualcomm|marvell|lantronix|digi international|advantech|asix|smsc|standard microsystems/i;

// Wörter, die in Firmennamen nichts unterscheiden
const FUELL = new Set(["co", "ltd", "inc", "gmbh", "ag", "corp", "corporation", "company", "limited", "llc", "kg", "sa", "srl", "bv", "nv", "ab", "oy", "as", "plc", "pty", "the", "and", "&", "electronics", "technologies", "technology", "systems", "international", "group", "holding"]);
const woerter = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9äöüß]+/g, " ").split(" ").filter((w) => w.length > 1 && !FUELL.has(w));

/* Passt der Hersteller aus dem Plan zur MAC?
   true = passt, false = passt nicht, null = keine Aussage (kein Hersteller, unbekannte/lokale MAC, Chip-Hersteller) */
export const herstellerPasst = (planHersteller, mac) => {
  const plan = woerter(planHersteller);
  if (!plan.length) return null;
  const h = macHersteller(mac);
  if (h.art !== "hersteller" || CHIP_HERSTELLER.test(h.name)) return null;
  const oui = woerter(h.name);
  if (!oui.length) return null;
  // Ein gemeinsames Wort reicht („Yamaha“ ↔ „YAMAHA CORPORATION“, „MA Lighting“ ↔ „MA Lighting Technology GmbH“)
  return plan.some((w) => oui.includes(w) || oui.some((o) => o.startsWith(w) || w.startsWith(o)));
};
