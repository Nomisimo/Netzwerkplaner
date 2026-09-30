/* ── Versionen & Änderungen ────────────────────────────────────────────────
   Die Versionsnummer steht in package.json (SemVer, Betas als 0.x.y-beta.n).
   Hier stehen die Änderungen je Version für „Was ist neu?“ in der App. */
export const REPO = "Nomisimo/Netzwerkplaner";
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export const CHANGELOG = {
  "0.6.0-beta.1": [
    "Topologie: Shift + Mausrad scrollt hoch und runter, ⌘/Strg + Mausrad nach links und rechts",
    "Neu im Live-Tab: Discovery findet Geräte im Netz (Dante, NDI, Art-Net, sACN, CITP, MA-Net, dazu der Netzwerkscan) und fügt neue als generische Einträge mit IP, MAC und Name ein",
    "Generische Geräte zeigen eine leere Maske mit nur zwei Wegen: „⇄ Modell zuweisen“ oder „＋ Leeres Gerät anlegen“ mit Typauswahl; IP, MAC, Protokolle und Verbindungen bleiben",
    "Netzwerkscan: „+ In den Plan“ legt ebenfalls ein generisches Gerät an",
  ],
  "0.5.0-beta.2": [
    "macOS: Das Intel-DMG war beschädigt und ließ sich nicht öffnen (Fehler 3840). Jeder Mac-Build erzeugt jetzt nur noch sein DMG, und der Release prüft es vor dem Hochladen",
    "„⇄ Modell zuweisen“ mit einem Gerät aus dem eigenen Gerätebestand übernimmt dessen feste IPs, Namen, Netzwerknamen und Inventar genau wie beim Einfügen; die Verbindungen bleiben",
  ],
  "0.5.0-beta.1": [
    "Bibliothek heißt jetzt einheitlich „Katalog“; Geräte lassen sich direkt im Katalog anlegen (Bestand und eigene Vorlagen)",
    "Gerätebestand als CSV exportieren und importieren, z. B. aus einer anderen Installation oder einer eigenen Excel-Liste",
    "„⇄ Modell zuweisen“: ein generisches Gerät nachträglich zu einem Katalogmodell machen, IPs, VLANs und Verbindungen bleiben erhalten",
    "Topologie: Linien rund oder eckig, Titel wahlweise Gerätename, Netzwerkname, Typ/Modell oder Inventar-Nr.; ohne Netzwerkname erscheint der Typ",
    "MA-Net Gold-Standards in der Prüfung: 1 GbE, eigenes VLAN, keine 100-Mbit-Geräte, IGMP, EEE aus, kurze Switch-Ketten, kein 192.168.33.x, Generationen trennen",
    "VLANs vereinfacht: nur noch ID, Name, Farbe, Zweck, Notiz und die Schalter IGMP, EEE aus, QoS und DHCP",
    "Wissen: Protokoll-Poster „OSI-Modell & Ports“, mDNS-Dienste und Infrastruktur-Protokolle (aus dem Katalog verschoben), Wikipedia-Links",
    "Anleitung neu: ein Kapitel je Tab mit Screenshots, dazu die Analyse-Werkzeuge (Wireshark-Filter, Cisco-Befehle)",
    "Updates wie im Stromplaner: Windows lädt neue Versionen im Hintergrund und installiert nach Neustart, macOS öffnet die Download-Seite",
    "Eigenes Logo neben dem App-Namen, auch in den PDF-Exporten; App-Icon oben links",
    "Entfernt: Patchliste, Analyse-Tab (Rechner und Prüfungen laufen in der Prüfung weiter), Kabellängen, IP-Plan",
  ],
  "0.4.0-beta.1": [
    "Neuer Tab „Live“: Online-Status aller Geräte, Netzwerkscan mit Abgleich gegen den Plan (fehlt, nicht im Plan, MAC weicht ab)",
    "Switches per SNMP: Live-VLAN je Port im Vergleich zum geplanten",
    "Protokoll-Monitore für sACN, Art-Net, Dante, MA-Net, NDI, OSC, CITP und PTP-Clock; gefundene IPs zeigen den Gerätenamen aus dem Plan",
    "Die Monitore hören nur mit; gesendet werden nur ArtPoll (per Knopf), mDNS-Abfragen, Scan und SNMP",
  ],
  "0.3.0-beta.1": [
    "Neue Topologie-Ansicht „Frontplatten“ im Stil von Luminex Araneo: Switches als Frontplatte mit ihrer echten Portzahl und Bauform (RJ45, SFP, etherCON)",
    "Ports in der Farbe ihres VLANs, Trunks mehrfarbig gestreift, freie Ports abgedunkelt, Link-LED und PoE-Kennzeichen am Port",
    "Endgeräte als Karten mit Port-Lasche direkt über oder unter ihrem Switch-Port, Rahmen in VLAN-Farbe",
    "Port anklicken öffnet die Verbindung; Switch ziehen verschiebt die ganze Gruppe; Umschalter Mindmap / Frontplatten in der Werkzeugleiste",
    "Export als SVG/PNG/PDF übernimmt die gewählte Ansicht",
  ],
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
