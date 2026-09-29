/* ── Versionen & Änderungen ────────────────────────────────────────────────
   Die Versionsnummer steht in package.json (SemVer, Betas als 0.x.y-beta.n).
   Hier stehen die Änderungen je Version für „Was ist neu?“ in der App. */
export const REPO = "Nomisimo/Netzwerkplaner";
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export const CHANGELOG = {
  "0.2.0-beta.1": [
    "Erste Beta. Versionsnummer in der Kopfzeile, Hinweis beim Start, wenn eine neuere Version auf GitHub liegt",
    "Kernprotokolle Dante, MA-Net 1–3, Art-Net, sACN, NDI, OSC und CITP mit Bandbreitenmodellen und Anforderungen",
    "Datenströme je Gerät; Analyse-Tab mit Leitungslast, Multicast je VLAN, Dante-Hops, Bandbreiten- und Laufzeitrechner, Analyse-Werkzeugen",
    "Wissen-Tab: IGMP, QoS/DSCP, Bandbreite, Latenz, PTP, EEE, STP, VLANs, Adressen, Redundanz, Switch-Einstellungen je Hersteller",
    "Fokus-Katalog: MA, Luminex, Cisco, Yamaha, Schnick-Schnack-Systems, Dante (201 recherchierte Modelle)",
    "Gerätebestand: eigene Geräte mit Name, IPs, MACs und Inventardaten speichern und direkt einfügen",
    "Netzwerkname, Inventar-Nr., Seriennummer und Case je Gerät",
    "Topologie zeigt Switch-Port und VLAN an jeder Leitung; Rechtsklick auf ein Gerät öffnet eine Infokarte",
    "Akzentfarbe mattes Rot",
  ],
  "0.1.0": [
    "Erste Version: Topologie als Mindmap mit Drag & Drop, Verbinden-Werkzeug, Ein-/Ausklappen und Auto-Layout",
    "Geräte aus dem Hardwarekatalog (Ports, Protokolle, Web-UI vorbelegt) und generische Typen mit eigenen Icons",
    "VLANs, IP-Plan mit Konfliktprüfung und Vorschlag der nächsten freien Adresse",
    "Patchliste, Switch-Port-Konfiguration (Access/Trunk, PoE), Prüfung nach den Regeln der Protokollrecherche",
    "Web-UI-Links und Erreichbarkeit per TCP/Ping, Exporte als PDF, Excel, CSV, SVG und PNG",
  ],
};

// SemVer-Vergleich inkl. Vorabversionen: 0.2.0-beta.1 < 0.2.0-beta.2 < 0.2.0
export const parseVersion = (v) => {
  const m = String(v || "").trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  return { nums: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : [] };
};
export const compareVersions = (a, b) => {
  const A = parseVersion(a), B = parseVersion(b);
  if (!A || !B) return 0;
  for (let i = 0; i < 3; i++) if (A.nums[i] !== B.nums[i]) return A.nums[i] - B.nums[i];
  if (!A.pre.length || !B.pre.length) return (A.pre.length ? -1 : 0) - (B.pre.length ? -1 : 0);
  for (let i = 0; i < Math.max(A.pre.length, B.pre.length); i++) {
    const x = A.pre[i], y = B.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny && +x !== +y) return +x - +y;
    if (nx !== ny) return nx ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};
export const istBeta = (v) => /-(alpha|beta|rc)/i.test(String(v || ""));

// Neueste Version aus der GitHub-Releases-Liste (ohne Entwürfe)
export const neuesteVersion = (releases = []) => releases
  .filter((r) => !r.draft && parseVersion(r.tag_name))
  .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0] || null;
