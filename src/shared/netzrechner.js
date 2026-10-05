/* ── Netzrechner: IPv4- und IPv6-Adressen auswerten ─────────────────────────
   Reine Funktionen für den Rechner im Wissen-Tab. IPv4 rechnet mit den
   Hilfsfunktionen aus net.js, IPv6 mit BigInt (128 Bit). */
import { ip2int, int2ip, parsePrefix, prefixToMask, DEFAULT_RANGES } from "./net.js";

/* Besondere IPv4-Bereiche, spezifischste zuerst (RFC 6890 und Veranstaltungs-Defaults) */
export const V4_BEREICHE = [
  { cidr: "0.0.0.0/8", name: "„Dieses Netz“ (0.0.0.0 = unbestimmt)", art: "reserviert" },
  { cidr: "10.0.0.0/8", name: "Privat (RFC 1918)", art: "privat" },
  { cidr: "100.64.0.0/10", name: "Carrier-Grade NAT (RFC 6598)", art: "reserviert" },
  { cidr: "127.0.0.0/8", name: "Loopback (127.0.0.1 = localhost)", art: "loopback" },
  { cidr: "169.254.0.0/16", name: "Link-Local / APIPA (Dante ohne DHCP)", art: "linklocal" },
  { cidr: "172.31.0.0/16", name: "Privat (RFC 1918), Dante-Secondary-Default", art: "privat" },
  { cidr: "172.16.0.0/12", name: "Privat (RFC 1918)", art: "privat" },
  { cidr: "192.0.2.0/24", name: "Dokumentation (TEST-NET-1)", art: "reserviert" },
  { cidr: "192.168.0.0/16", name: "Privat (RFC 1918)", art: "privat" },
  { cidr: "198.18.0.0/15", name: "Benchmark-Tests (RFC 2544)", art: "reserviert" },
  { cidr: "198.51.100.0/24", name: "Dokumentation (TEST-NET-2)", art: "reserviert" },
  { cidr: "203.0.113.0/24", name: "Dokumentation (TEST-NET-3)", art: "reserviert" },
  { cidr: "2.0.0.0/8", name: "Öffentlich, von Art-Net als Primärnetz benutzt", art: "oeffentlich" },
  { cidr: "224.0.0.0/24", name: "Multicast, Link-Local (wird nicht geroutet, z. B. mDNS 224.0.0.251)", art: "multicast" },
  { cidr: "239.0.0.0/8", name: "Multicast, organisationsintern (sACN, Dante, MA-Net3)", art: "multicast" },
  { cidr: "224.0.0.0/4", name: "Multicast (Klasse D)", art: "multicast" },
  { cidr: "255.255.255.255/32", name: "Limitierter Broadcast", art: "broadcast" },
  { cidr: "240.0.0.0/4", name: "Reserviert (Klasse E)", art: "reserviert" },
];

const inCidr = (n, cidr) => {
  const [a, p] = cidr.split("/");
  const m = prefixToMask(+p);
  return ((n & m) >>> 0) === ((ip2int(a) & m) >>> 0);
};

// Historische Adressklasse nach dem ersten Oktett
export const v4Klasse = (n) => {
  const o = n >>> 24;
  if (o < 128) return { k: "A", std: 8, bereich: "0–127" };
  if (o < 192) return { k: "B", std: 16, bereich: "128–191" };
  if (o < 224) return { k: "C", std: 24, bereich: "192–223" };
  if (o < 240) return { k: "D", std: null, bereich: "224–239 (Multicast)" };
  return { k: "E", std: null, bereich: "240–255 (reserviert)" };
};

export const v4Bereich = (n) => V4_BEREICHE.find((b) => inCidr(n, b.cidr)) || { cidr: "", name: "Öffentlich (im Internet routbar)", art: "oeffentlich" };

const bin = (n) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, "0")).join(".");

/* „192.168.1.10/24“, „192.168.1.10 255.255.255.0“ oder „192.168.1.10“ (+ maske separat).
   Ohne Präfix gilt die Klassen-Maske, bei Klasse D/E /32. */
export const ipv4Rechnen = (eingabe, maske) => {
  const s = String(eingabe || "").trim();
  const m = s.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?:\s*\/\s*(\S+)|\s+(\S+))?$/);
  if (!m) return null;
  const n = ip2int(m[1]);
  if (n === null) return null;
  const pRoh = m[2] ?? m[3] ?? (maske ? String(maske).trim() : "");
  const kl = v4Klasse(n);
  const prefix = pRoh === "" ? kl.std ?? 32 : parsePrefix(pRoh);
  if (prefix === null) return { fehler: "Maske ungültig. Erlaubt: /0 bis /32 oder eine zusammenhängende Maske wie 255.255.255.0." };
  const mask = prefixToMask(prefix);
  const net = (n & mask) >>> 0;
  const bcast = (net | (~mask >>> 0)) >>> 0;
  const size = 2 ** (32 - prefix);
  const first = prefix >= 31 ? net : net + 1;
  const last = prefix >= 31 ? bcast : bcast - 1;
  const hosts = prefix === 32 ? 1 : prefix === 31 ? 2 : size - 2;
  const b = v4Bereich(n);
  const vorgabe = DEFAULT_RANGES.find((r) => inCidr(n, r.cidr));
  return {
    ip: m[1], n, prefix, ohnePraefix: pRoh === "",
    maske: int2ip(mask), wildcard: int2ip(~mask >>> 0),
    netz: int2ip(net), broadcast: prefix >= 31 ? null : int2ip(bcast),
    erste: int2ip(first), letzte: int2ip(last), hosts, groesse: size,
    cidr: `${int2ip(net)}/${prefix}`, istNetz: n === net && prefix < 31, istBroadcast: n === bcast && prefix < 31,
    klasse: kl, bereich: b, vorgabe: vorgabe?.name || null,
    binaer: { ip: bin(n), maske: bin(mask), netz: bin(net) },
    hex: "0x" + n.toString(16).padStart(8, "0").toUpperCase(),
  };
};

/* Netz in gleich große Teilnetze mit neuem Präfix aufteilen (höchstens max Einträge) */
export const v4Aufteilen = (cidr, neuPrefix, max = 256) => {
  const r = ipv4Rechnen(cidr);
  if (!r || r.fehler || neuPrefix < r.prefix || neuPrefix > 32) return null;
  const net = ip2int(r.netz);
  const anzahl = 2 ** (neuPrefix - r.prefix);
  const groesse = 2 ** (32 - neuPrefix);
  const netze = [];
  for (let i = 0; i < Math.min(anzahl, max); i++) {
    const a = net + i * groesse, e = a + groesse - 1;
    netze.push({ cidr: `${int2ip(a)}/${neuPrefix}`, erste: int2ip(neuPrefix >= 31 ? a : a + 1), letzte: int2ip(neuPrefix >= 31 ? e : e - 1), broadcast: neuPrefix >= 31 ? null : int2ip(e) });
  }
  return { anzahl, hostsJe: neuPrefix === 32 ? 1 : neuPrefix === 31 ? 2 : groesse - 2, netze, gekuerzt: anzahl > max };
};

/* ── IPv6 ─────────────────────────────────────────────────────────────── */
const V6MAX = (1n << 128n) - 1n;

// Text → BigInt (oder null). Versteht „::“, eingebettetes IPv4 und %Zone.
export const v6zuZahl = (s) => {
  let t = String(s || "").trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (!t || !/^[0-9a-f:.]+$/.test(t)) return null;
  const v4 = t.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const n = ip2int(v4[1]);
    if (n === null) return null;
    t = t.slice(0, -v4[1].length) + ((n >>> 16).toString(16)) + ":" + ((n & 0xffff).toString(16));
  }
  const teile = t.split("::");
  if (teile.length > 2) return null;
  const links = teile[0] ? teile[0].split(":") : [];
  const rechts = teile.length === 2 && teile[1] ? teile[1].split(":") : [];
  if ([...links, ...rechts].some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  const fehlt = 8 - links.length - rechts.length;
  if (teile.length === 1 ? fehlt !== 0 : fehlt < 1) return null;
  const gruppen = [...links, ...Array(teile.length === 2 ? fehlt : 0).fill("0"), ...rechts];
  return gruppen.reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n);
};

const gruppenVon = (n) => Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(112 - i * 16)) & 0xffffn));

// Volle Schreibweise mit 8 × 4 Hex-Ziffern
export const v6Voll = (n) => gruppenVon(n).map((g) => g.toString(16).padStart(4, "0")).join(":");

// Kurzform nach RFC 5952: führende Nullen weg, längste Nullfolge (≥ 2 Gruppen) wird „::“
export const v6Kurz = (n) => {
  const g = gruppenVon(n);
  let best = -1, bestLen = 0;
  for (let i = 0; i < 8;) {
    if (g[i] !== 0) { i++; continue; }
    let j = i; while (j < 8 && g[j] === 0) j++;
    if (j - i > bestLen && j - i >= 2) { best = i; bestLen = j - i; }
    i = j;
  }
  const hex = g.map((x) => x.toString(16));
  if (best < 0) return hex.join(":");
  return hex.slice(0, best).join(":") + "::" + hex.slice(best + bestLen).join(":");
};

export const V6_BEREICHE = [
  { cidr: "::/128", name: "Unbestimmte Adresse (::)", art: "reserviert" },
  { cidr: "::1/128", name: "Loopback (::1)", art: "loopback" },
  { cidr: "::ffff:0:0/96", name: "IPv4-gemappt (::ffff:a.b.c.d)", art: "reserviert" },
  { cidr: "64:ff9b::/96", name: "NAT64 (IPv4 über IPv6)", art: "reserviert" },
  { cidr: "2001:db8::/32", name: "Dokumentation (nur für Beispiele)", art: "reserviert" },
  { cidr: "2002::/16", name: "6to4 (veraltet)", art: "oeffentlich" },
  { cidr: "2000::/3", name: "Global Unicast (öffentlich routbar)", art: "oeffentlich" },
  { cidr: "fd00::/8", name: "Unique Local Address, ULA (privat, wie RFC 1918)", art: "privat" },
  { cidr: "fc00::/7", name: "Unique Local Address, ULA (fc00::/8 nicht vergeben)", art: "privat" },
  { cidr: "fe80::/10", name: "Link-Local (fe80::, jede Schnittstelle hat eine)", art: "linklocal" },
  { cidr: "ff02::/16", name: "Multicast, Link-Local (z. B. ff02::1 alle Knoten, ff02::fb mDNS)", art: "multicast" },
  { cidr: "ff00::/8", name: "Multicast", art: "multicast" },
];

const v6Maske = (p) => (p === 0 ? 0n : (V6MAX << BigInt(128 - p)) & V6MAX);
const v6In = (n, cidr) => {
  const [a, p] = cidr.split("/");
  const m = v6Maske(+p);
  return (n & m) === (v6zuZahl(a) & m);
};

// 2^k als lesbare Zahl
export const zweiHoch = (k) => {
  if (k <= 53) return (2 ** k).toLocaleString("de-DE");
  const z = (2n ** BigInt(k)).toString();
  return `2^${k} ≈ ${z[0]},${z.slice(1, 3)} × 10^${z.length - 1}`;
};

export const ipv6Rechnen = (eingabe) => {
  const s = String(eingabe || "").trim();
  const [aRoh, pRoh] = s.split("/");
  const n = v6zuZahl(aRoh);
  if (n === null) return null;
  const prefix = pRoh === undefined || pRoh.trim() === "" ? 64 : /^\d{1,3}$/.test(pRoh.trim()) && +pRoh <= 128 ? +pRoh : null;
  if (prefix === null) return { fehler: "Präfix ungültig. Erlaubt: /0 bis /128." };
  const m = v6Maske(prefix);
  const net = n & m;
  const last = net | (~m & V6MAX);
  const b = V6_BEREICHE.find((x) => v6In(n, x.cidr)) || { name: "Nicht zugewiesen / reserviert", art: "reserviert" };
  const iid = n & ((1n << 64n) - 1n);
  const ig = gruppenVon(iid).slice(4);
  // EUI-64: ff:fe in der Mitte der Interface-ID, MAC daraus zurückrechnen (U/L-Bit kippen)
  const eui = (ig[1] & 0xff) === 0xff && (ig[2] >> 8) === 0xfe;
  const mac = eui ? [ig[0] >> 8 ^ 2, ig[0] & 255, ig[1] >> 8, ig[2] & 255, ig[3] >> 8, ig[3] & 255].map((x) => x.toString(16).padStart(2, "0")).join(":") : null;
  const v4 = b.cidr === "::ffff:0:0/96" || b.cidr === "64:ff9b::/96" ? int2ip(Number(n & 0xffffffffn)) : null;
  return {
    prefix, ohnePraefix: pRoh === undefined || pRoh.trim() === "",
    kurz: v6Kurz(n), voll: v6Voll(n),
    netz: `${v6Kurz(net)}/${prefix}`, erste: v6Kurz(net), letzte: v6Kurz(last),
    anzahl: zweiHoch(128 - prefix), subnetze64: prefix <= 64 ? zweiHoch(64 - prefix) : null,
    bereich: b, interfaceId: prefix <= 64 ? gruppenVon(iid).slice(4).map((x) => x.toString(16)).join(":") : null,
    mac, v4,
    reverse: v6Voll(n).replace(/:/g, "").split("").reverse().join(".") + ".ip6.arpa",
  };
};

// MAC → Link-Local-Adresse nach EUI-64 (wie SLAAC sie bildet)
export const macZuLinkLocal = (mac) => {
  const b = String(mac || "").trim().split(/[:-]/).map((x) => parseInt(x, 16));
  if (b.length !== 6 || b.some((x) => Number.isNaN(x) || x > 255)) return null;
  const e = [b[0] ^ 2, b[1], b[2], 0xff, 0xfe, b[3], b[4], b[5]];
  const g = [0xfe80, 0, 0, 0, (e[0] << 8) | e[1], (e[2] << 8) | e[3], (e[4] << 8) | e[5], (e[6] << 8) | e[7]];
  return v6Kurz(g.reduce((acc, x) => (acc << 16n) | BigInt(x), 0n));
};

// Eingabe automatisch erkennen
export const netzRechnen = (eingabe, maske) => (String(eingabe || "").includes(":") ? { v: 6, r: ipv6Rechnen(eingabe) } : { v: 4, r: ipv4Rechnen(eingabe, maske) });
