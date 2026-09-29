/* ── Kernprotokolle ─────────────────────────────────────────────────────────
   Die Protokolle, die im Einsatz primär genutzt werden (Stand 29.09.2026):
   Dante, MA-Net 1–3, Art-Net, sACN, NDI, OSC, CITP.
   Ports, Multicast-Adressen und Anforderungen kommen aus der Protokollrecherche
   (ref → Eintrag in katalog.json). Hier stehen zusätzlich Bandbreitenmodelle,
   Latenz, Analysewerkzeuge und Erklärungen. Alle Bandbreiten sind Richtwerte
   für die Planung, keine Messwerte. */

// Overhead je UDP-Paket auf der Leitung: Präambel+SFD 8, Ethernet 14, FCS 4, IFG 12, IPv4 20, UDP 8
export const WIRE_OVERHEAD = 66;
const mbit = (bytesPerPacket, pps) => ((bytesPerPacket + WIRE_OVERHEAD) * 8 * pps) / 1e6;

export const NDI_FORMATE = {
  full: { label: "NDI (Full Bandwidth, SpeedHQ)", werte: { "720p50": 55, "720p60": 65, "1080i50": 80, "1080p25": 65, "1080p30": 75, "1080p50": 105, "1080p60": 125, "2160p30": 180, "2160p50": 230, "2160p60": 250 } },
  hx3:  { label: "NDI|HX3", werte: { "1080p30": 30, "1080p50": 40, "1080p60": 45, "2160p30": 60, "2160p60": 90 } },
  hx2:  { label: "NDI|HX2 (H.264/H.265)", werte: { "720p60": 6, "1080p30": 8, "1080p50": 12, "1080p60": 15, "2160p30": 20, "2160p60": 30 } },
};

/* Jede Rechnung liefert { mbit, pps, pakete, hinweis } für die angegebene Menge */
export const KERN = [
  {
    id: "dante", name: "Dante", ref: "Dante", kategorie: "Audio", farbe: "#4ea1ff",
    kurz: "Audio over IP von Audinate. Audio läuft in Flows (Unicast oder Multicast) mit PTP-Takt; Geräte finden sich per mDNS.",
    einheit: "Kanäle", menge: 32,
    params: [
      { key: "fs", label: "Samplerate", type: "select", options: [44100, 48000, 88200, 96000], def: 48000 },
      { key: "bit", label: "Auflösung (Bit)", type: "select", options: [16, 24, 32], def: 24 },
      { key: "proFlow", label: "Kanäle je Flow", type: "number", def: 4, hint: "Unicast-Flows tragen bis zu 4 Kanäle" },
      { key: "pps", label: "Pakete/s je Flow", type: "number", def: 3000, hint: "48 000 ÷ Samples je Paket; 3 000/s entspricht 16 Samples (Richtwert der Recherche)" },
    ],
    rechne: (n, p) => {
      const flows = Math.ceil(n / Math.max(1, p.proFlow));
      const perFlowCh = n / Math.max(1, flows);
      const payload = (perFlowCh * p.fs * (p.bit / 8)) / p.pps + 4; // + Dante-Header (≈70 Byte Overhead gesamt)
      return { mbit: mbit(payload, p.pps) * flows, pps: p.pps * flows, flows, hinweis: `${flows} Flow(s) à ≈${mbit(payload, p.pps).toFixed(2)} Mbit/s` };
    },
    latenz: [
      ["0,15 ms", "nur PCIe-Karten, direkte Verbindung"],
      ["0,25 ms", "kleine Gigabit-Netze, wenige Switches (Richtwert bis 3 Hops)"],
      ["0,5 ms", "mittlere Gigabit-Netze (Richtwert bis 5 Hops)"],
      ["1 ms", "Standard; große Gigabit-Netze (Richtwert bis 10 Hops); Minimum bei 100-Mbit-Ports"],
      ["2 ms / 5 ms", "sehr große Netze, WAN-Strecken, Dante Via/DVS"],
    ],
    anforderungen: { igmp: "bei Multicast-Flows und PTP zwingend (Snooping + ein Querier je VLAN)", qos: "DSCP 56 (CS7) PTP · 46 (EF) Audio · 8 (CS1) reserviert; Strict Priority, 4 Queues", ptp: "PTPv1 (AES67-Modus: PTPv2); ein Leader je Netz, Switches ohne PTP-Filter", eee: "abschalten (802.3az stört den Takt)", jumbo: "nicht nötig", stp: "RSTP ok; Edge-/PortFast an Geräteports, Primary und Secondary nie verbinden" },
    tools: [
      ["Dante Controller", "Routing, Clock-Status, Latenz, Netzwerk- und Bandbreitenansicht je Gerät"],
      ["Dante Domain Manager", "Domänen, Benutzer, Routing über Subnetze, Audit-Log"],
      ["Dante Virtual Soundcard / Dante Via", "Rechner als Dante-Gerät, Test-Streams"],
      ["Wireshark", "PTP (udp.port==319||320), mDNS, IGMP-Joins prüfen"],
    ],
    stolpersteine: ["Primary und Secondary dürfen nie verbunden sein (auch nicht über Trunks)", "EEE-fähige Switches ohne Abschaltung verursachen Clock-Aussetzer", "Multicast ohne IGMP flutet alle Ports im VLAN", "Dante und AES67 im selben Netz: DSCP-Schemata abstimmen"],
  },
  {
    id: "manet", name: "MA-Net (1–3)", ref: "MA-Net3", kategorie: "Licht", farbe: "#f5d023",
    kurz: "Netzwerkprotokolle von MA Lighting: MA-Net (grandMA1), MA-Net2 (grandMA2) und MA-Net3 (grandMA3). Pulte, Processing Units und Nodes bilden eine Session und verteilen Showfile, Parameter- und DMX-Berechnung. Verluste werden per NACK nachgefordert.",
    einheit: "Universen", menge: 16,
    params: [
      { key: "reserve", label: "Session-Reserve (Mbit/s)", type: "number", def: 200, hint: "MA-Vorgabe für MA-Net3: im Mittel 200 Mbit/s für Echtzeitverkehr (Worst Case 158 Mbit/s). Nur einmal je Session eintragen, z. B. am Master-Pult." },
      { key: "hz", label: "Wiederholrate (Hz)", type: "number", def: 30, hint: "DMX-Refresh je Universum (grandMA3: 30 Hz)" },
      { key: "bytes", label: "Nutzdaten je Paket (Byte)", type: "number", def: 560, hint: "Richtwert, wie sACN/Art-Net" },
    ],
    rechne: (n, p) => ({ mbit: (+p.reserve || 0) + mbit(p.bytes, p.hz) * n, pps: p.hz * n, hinweis: `${p.reserve || 0} Mbit/s Session-Reserve (MA-Vorgabe) + ≈${(mbit(p.bytes, p.hz) * n).toFixed(1)} Mbit/s für ${n} Universen` }),
    varianten: [
      ["MA-Net (grandMA1)", "grandMA1-Serie mit NSP/NDP, 100-Mbit-Netz, Broadcast-lastig. Eigenes, dediziertes Netz verwenden.", "Fachwissen, vor Einsatz prüfen"],
      ["MA-Net2 (grandMA2)", "grandMA2 mit NPU/NSP/NDP. UDP 29998/29999 (Session), TCP 7003 (Software-Update), Multicast 236.4.0.x. Ports stammen aus dem MA-Forum, nicht aus offizieller Doku. Dediziertes Netz.", "Fachwissen, vor Einsatz prüfen"],
      ["MA-Net3 (grandMA3)", "UDP 30020 (Session, Multicast), TCP 30022+ (Alternate Traffic), TCP 30021 (Worldserver); Multicast 236.4.1.0–.4 für Session 1 (alternativ 239.4.1.x). 1 GbE non-blocking, keine 100-Mbit-Geräte im VLAN, IGMP-Snooping + Querier, EEE aus, max. 2 ms Laufzeit in der Broadcast-Domain. 192.168.33.x auf Con1–Con3 ist unzulässig.", "Herstellerdoku geprüft 09/2026"],
    ],
    latenz: [["max. 2 ms", "MA-Vorgabe für die Laufzeit innerhalb der Broadcast-Domain (MA-Net3)"], ["33 ms", "DMX-Zeitfenster bei 30 Hz"]],
    anforderungen: { igmp: "Snooping + Querier auf allen Switches; bei mehreren Switches laut MA-Doku PIM", qos: "Best Effort, Trennung per eigenem VLAN", ptp: "–", eee: "abschalten", jumbo: "nein", stp: "RSTP; Loops vermeiden (Session-Multicast)" },
    tools: [["grandMA3 System Monitor", "NACK-Zähler: 0–50 Retransmissions stabil, mehr unregelmäßig untersuchen"], ["Menü Network im Pult", "Session, Stationen, Nodes, DMX-Ports"], ["grandMA3 Web Remote (Port 80/8080)", "Fernbedienung und Status im Browser"], ["Wireshark", "Multicast 236.4.1.x und UDP 30020 prüfen"]],
    stolpersteine: ["Keine 100-Mbit-Geräte ins MA-Net3-VLAN", "MA-Net2 und MA-Net3 nicht im selben Session-Bereich mischen", "Viele Sessions/Universen ohne IGMP fluten das Licht-VLAN", "Der MA Network Switch hat IGMP teils deaktiviert (Forenbericht) – Einstellungen prüfen", "Showfile-Übertragungen erzeugen kurzzeitig hohe Last"],
  },
  {
    id: "artnet", name: "Art-Net", ref: "Art-Net 4", kategorie: "Licht", farbe: "#ffcf5c",
    kurz: "DMX512 über UDP (Port 6454). Ein ArtDmx-Paket trägt ein Universum (512 Kanäle). Broadcast oder Unicast; Nodes melden sich per ArtPollReply.",
    einheit: "Universen", menge: 16,
    params: [
      { key: "hz", label: "Wiederholrate (Hz)", type: "number", def: 44 },
      { key: "broadcast", label: "Broadcast", type: "bool", def: false, hint: "Broadcast erreicht jedes Gerät im VLAN" },
    ],
    rechne: (n, p) => ({ mbit: mbit(530, p.hz) * n, pps: p.hz * n, hinweis: `ArtDmx 530 Byte + ${WIRE_OVERHEAD} Byte Overhead je Paket${p.broadcast ? " · Broadcast: Last liegt an allen Ports im VLAN" : ""}` }),
    latenz: [["≈1 Frame (23 ms bei 44 Hz)", "DMX-Refresh bestimmt die Latenz, das Netz ist vernachlässigbar"]],
    anforderungen: { igmp: "nicht nötig (Broadcast/Unicast)", qos: "Best Effort", ptp: "–", eee: "abschalten empfohlen", jumbo: "nein", stp: "RSTP" },
    tools: [["DMX Workshop (Artistic Licence)", "Nodes finden, Universen mitschneiden, ArtAddress"], ["Hersteller-Web-UIs der Nodes", "Port-Zuordnung, Merge, Status"], ["Wireshark", "Dissector „artnet“, udp.port==6454"]],
    stolpersteine: ["Broadcast mit vielen Universen überlastet schwache Geräte (Kameras, Laptops) im selben VLAN → Unicast", "Default-Netze 2.x/10.x kollidieren leicht mit anderen 10er-Netzen", "Net/Sub-Net/Universe-Zählung beginnt bei 0"],
  },
  {
    id: "sacn", name: "sACN (E1.31)", ref: "sACN (Streaming ACN)", kategorie: "Licht", farbe: "#f59e0b",
    kurz: "DMX über UDP Port 5568 nach ANSI E1.31. Jedes Universum ist eine eigene Multicast-Gruppe 239.255.{hi}.{lo}; Priorität 0–200 für Merge und Backup.",
    einheit: "Universen", menge: 16,
    params: [{ key: "hz", label: "Wiederholrate (Hz)", type: "number", def: 44 }],
    rechne: (n, p) => ({ mbit: mbit(638, p.hz) * n, pps: p.hz * n, gruppen: n, hinweis: `E1.31-Paket 638 Byte + ${WIRE_OVERHEAD} Byte Overhead · ${n} Multicast-Gruppen` }),
    latenz: [["≈1 Frame", "wie Art-Net; Sync-Pakete für bildgenaue Wiedergabe"]],
    anforderungen: { igmp: "zwingend bei vielen Universen: Snooping + genau ein Querier im VLAN", qos: "Best Effort", ptp: "–", eee: "abschalten", jumbo: "nein", stp: "RSTP" },
    tools: [["sACNView", "Universen, Quellen, Prioritäten live anzeigen"], ["Hersteller-Web-UIs", "Merge-Modus, Priorität, Universum-Zuordnung"], ["Wireshark", "Dissector „acn“, IGMP-Joins je Universum"]],
    stolpersteine: ["Ohne IGMP-Snooping wird jedes Universum an jeden Port geflutet", "Mehr als 256 Multicast-Gruppen überfordern manche Switches (Tabellengröße prüfen)", "Universe Discovery (Universum 64214) läuft alle 10 s"],
  },
  {
    id: "ndi", name: "NDI", ref: "NDI (NDI 5/6, HX)", kategorie: "Video", farbe: "#b37dff",
    kurz: "Video over IP von NDI (Vizrt). Full-Bandwidth-NDI (SpeedHQ) für Produktion, NDI|HX für geringe Bandbreite. Discovery per mDNS oder Discovery Server.",
    einheit: "Streams", menge: 2,
    params: [
      { key: "variante", label: "Variante", type: "select", options: Object.keys(NDI_FORMATE), labels: Object.fromEntries(Object.entries(NDI_FORMATE).map(([k, v]) => [k, v.label])), def: "full" },
      { key: "format", label: "Format", type: "select", options: Object.keys(NDI_FORMATE.full.werte), def: "1080p50" },
    ],
    rechne: (n, p) => {
      const t = NDI_FORMATE[p.variante]?.werte || NDI_FORMATE.full.werte;
      const v = t[p.format] ?? Object.values(t)[0];
      return { mbit: v * n, hinweis: `≈${v} Mbit/s je Stream (${NDI_FORMATE[p.variante]?.label}, ${p.format}; abhängig vom Bildinhalt)` };
    },
    latenz: [["≈1 Frame (Full NDI)", "Encoding/Decoding dominiert"], ["mehrere Frames (HX)", "Long-GOP-Kompression"]],
    anforderungen: { igmp: "nur bei NDI-Multicast nötig", qos: "laut NDI-Empfehlung aus", ptp: "–", eee: "–", jumbo: "aus", stp: "RSTP; Flow Control laut NDI an" },
    tools: [["NDI Studio Monitor", "Streams ansehen, Bitrate und Verbindungsart"], ["NDI Discovery Server / Access Manager", "Discovery über Subnetze, Gruppen"], ["NDI Analysis", "Diagnose der Verbindungen"], ["Wireshark", "mDNS _ndi._tcp, TCP 5959–5961+"]],
    stolpersteine: ["Full NDI braucht Gigabit je Quelle und 10G-Uplinks", "mDNS wird nicht geroutet → Discovery Server bei mehreren VLANs", "WLAN nur für HX-Streams"],
  },
  {
    id: "osc", name: "OSC", ref: "OSC (Open Sound Control)", kategorie: "Steuerung", farbe: "#39d0c8",
    kurz: "Nachrichtenprotokoll mit Adress-Pfaden (/eos/key/go). Transport meist UDP, Port je Gerät frei wählbar.",
    einheit: "Nachrichten/s", menge: 50,
    params: [{ key: "bytes", label: "Bytes je Nachricht", type: "number", def: 64 }],
    rechne: (n, p) => ({ mbit: mbit(p.bytes, n), pps: n, hinweis: "Steuerdaten, bandbreitenseitig unkritisch" }),
    latenz: [["< 1 ms im LAN", "UDP ohne Bestätigung, Verluste werden nicht wiederholt"]],
    anforderungen: { igmp: "–", qos: "Best Effort", ptp: "–", eee: "–", jumbo: "–", stp: "–" },
    tools: [["Protokol (Hexler)", "OSC/MIDI-Nachrichten mitlesen"], ["TouchOSC / Bitfocus Companion", "Senden und Testen"], ["Wireshark", "Dissector „osc“"]],
    stolpersteine: ["Ports je Gerät unterschiedlich (z. B. Eos, WING, X32) – in der Bibliothek nachsehen", "UDP-Broadcast-OSC landet bei allen Geräten im VLAN"],
  },
  {
    id: "citp", name: "CITP / MSEx", ref: "CITP / MSEx", kategorie: "Licht", farbe: "#e67e22",
    kurz: "Austausch zwischen Lichtpult, Visualizer und Medienserver: Discovery (PINF), Thumbnails und Media-Streams (MSEx).",
    einheit: "Streams", menge: 1,
    params: [{ key: "stream", label: "MSEx-Stream (Mbit/s)", type: "number", def: 4, hint: "Vorschau-Stream, Richtwert" }],
    rechne: (n, p) => ({ mbit: n * p.stream, hinweis: "Discovery und Thumbnails sind vernachlässigbar; Vorschau-Streams je nach Auflösung" }),
    latenz: [["unkritisch", "Vorschau und Metadaten"]],
    anforderungen: { igmp: "wirkungslos: PINF 224.0.0.180 ist Link-Local und wird immer geflutet; Pult und Server im selben VLAN", qos: "Best Effort", ptp: "–", eee: "–", jumbo: "–", stp: "–" },
    tools: [["Pult/Medienserver-Menüs", "CITP-Verbindung und Thumbnails"], ["Wireshark", "UDP 4809, Multicast 224.0.0.180; danach TCP auf dem in PINF genannten Port (MagicQ: 4811/4814)"]],
    stolpersteine: ["Pult und Medienserver müssen im selben VLAN sein (Multicast-Discovery)", "Ports teils dynamisch – Firewalls vermeiden"],
  },
];

export const KERN_BY_ID = Object.fromEntries(KERN.map((k) => [k.id, k]));
export const defaultParams = (id) => Object.fromEntries((KERN_BY_ID[id]?.params || []).map((p) => [p.key, p.def]));

export const streamRate = (s) => {
  const k = KERN_BY_ID[s.proto];
  if (!k) return { mbit: 0 };
  return k.rechne(+s.menge || 0, { ...defaultParams(s.proto), ...(s.param || {}) });
};

// Multicast/Broadcast-Verhalten eines Datenstroms
export const streamFlutet = (s) => (s.proto === "artnet" ? !!s.param?.broadcast : s.proto === "sacn" || s.proto === "manet" || ((s.proto === "dante" || s.proto === "ndi") && !!s.mc));

// Vorschlag für Datenströme aus Gerätetyp und Protokollen
export const streamVorschlag = (dev) => {
  const has = (re) => (dev.protokolle || []).some((p) => re.test(p));
  const out = [];
  if (has(/dante/i)) out.push({ proto: "dante", menge: { mischpult: 64, stagebox: 32, verstaerker: 0, funk: 4 }[dev.typ] ?? 8, mc: false });
  if (has(/ma-net3|ma-net2/i) && /lichtpult/.test(dev.typ)) out.push({ proto: "manet", menge: 16 });
  if (has(/sacn|e1\.31/i) && /lichtpult|medienserver/.test(dev.typ)) out.push({ proto: "sacn", menge: 16 });
  else if (has(/art-?net/i) && /lichtpult|medienserver/.test(dev.typ)) out.push({ proto: "artnet", menge: 16 });
  if (has(/^ndi/i) && /kamera|videomischer|medienserver/.test(dev.typ)) out.push({ proto: "ndi", menge: 1, param: { variante: "full", format: "1080p50" } });
  return out.filter((s) => s.menge > 0);
};
