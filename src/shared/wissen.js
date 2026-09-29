/* ── Wissen: Erklärungen zu den Netzwerkanforderungen ──────────────────────
   Blöcke: { t: "p" | "h" | "ul" | "table" | "hint" | "code", … }
   Zahlen mit „≈“ sind Richtwerte für die Planung. */
import { KERN, KERN_BY_ID, defaultParams, WIRE_OVERHEAD } from "./kernprotokolle.js";
import { laufzeit } from "./analyse.js";

const r = (id, menge, param = {}) => KERN_BY_ID[id].rechne(menge, { ...defaultParams(id), ...param });
const f = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} Gbit/s` : m >= 10 ? `${m.toFixed(0)} Mbit/s` : `${m.toFixed(1)} Mbit/s`);
const us = (x) => (x >= 100 ? `${x.toFixed(0)} µs` : x >= 1 ? `${x.toFixed(1)} µs` : `${(x * 1000).toFixed(0)} ns`);

const ANF = [["igmp", "IGMP-Snooping"], ["qos", "QoS / DSCP"], ["ptp", "PTP"], ["eee", "EEE (802.3az)"], ["jumbo", "Jumbo-Frames"], ["stp", "Spanning Tree"]];

export const ARTIKEL = [
  {
    id: "matrix", titel: "Anforderungsmatrix", kurz: "Was jedes Kernprotokoll vom Switch braucht, auf einen Blick.",
    bloecke: [
      { t: "p", x: "Die Tabelle fasst zusammen, wie die Switch-Ports und VLANs für jedes Kernprotokoll eingestellt sein sollten. Details stehen in den einzelnen Artikeln und auf den Protokollseiten." },
      { t: "table", kopf: ["Protokoll", ...ANF.map((a) => a[1])], zeilen: KERN.map((k) => [k.name, ...ANF.map(([key]) => k.anforderungen[key] || "–")]) },
      { t: "h", x: "Checkliste je Medien-VLAN" },
      { t: "ul", x: [
        "IGMP-Snooping an und genau ein Querier (am besten der Core-Switch), sobald Multicast läuft (Dante-Multicast, PTP, sACN, MA-Net3, NDI-Multicast).",
        "EEE / Green Ethernet an allen Ports ausschalten, über die Audio oder Licht läuft.",
        "QoS nur im Dante-/Intercom-VLAN: DSCP vertrauen, Strict Priority, DSCP 56 und 46 in die höchsten Queues.",
        "RSTP an, Geräteports als Edge-/PortFast-Port, BPDU-Guard an Ports für Gäste und Laptops.",
        "Uplinks mit Reserve planen: Dauerlast unter 70 % der Portgeschwindigkeit.",
        "Management der Switches in einem eigenen VLAN, nicht im Show-Netz.",
      ] },
    ],
  },
  {
    id: "igmp", titel: "IGMP & Multicast", kurz: "Warum Multicast ohne IGMP-Snooping das ganze VLAN flutet und wozu der Querier da ist.",
    bloecke: [
      { t: "p", x: "Multicast schickt ein Paket einmal ab, und das Netz verteilt es an alle Empfänger, die sich für die Gruppe angemeldet haben. Dante-Multicast-Flows, PTP, sACN-Universen, MA-Net3-Sessions und NDI-Multicast arbeiten so." },
      { t: "h", x: "Ohne IGMP-Snooping" },
      { t: "p", x: "Ein Switch ohne Snooping behandelt Multicast wie Broadcast und schickt jedes Paket an jeden Port im VLAN. 64 sACN-Universen (≈16 Mbit/s) landen dann auch bei jeder Kamera, jedem Laptop und jedem 100-Mbit-Gerät. Schwache Geräte verlieren dadurch Pakete oder reagieren träge." },
      { t: "h", x: "IGMP-Snooping" },
      { t: "p", x: "Empfänger melden sich per IGMP-Join für eine Gruppe an. Der Switch liest diese Meldungen mit und leitet die Gruppe nur noch an Ports weiter, hinter denen ein Empfänger sitzt." },
      { t: "h", x: "Querier" },
      { t: "p", x: "Der Querier fragt regelmäßig (Standard alle 125 s) nach, wer welche Gruppe noch braucht. Ohne Querier antwortet niemand mehr, die Einträge der Switches laufen nach ≈260 s ab, und Streams brechen ab oder werden wieder geflutet. Das zeigt sich typischerweise als Aussetzer einige Minuten nach dem Einschalten." },
      { t: "ul", x: [
        "Genau ein Querier je VLAN, am besten der Core-Switch. Bei mehreren gewinnt die niedrigste IP-Adresse.",
        "Der Querier braucht eine IP-Adresse im VLAN, sonst sendet er nicht.",
        "Alle Switches im VLAN brauchen Snooping. Ein unmanaged Switch dazwischen flutet seinen Teil des Netzes.",
        "„Unregistered Multicast“: Manche Switches fluten Gruppen ohne Empfänger, andere verwerfen sie. Für Dante und sACN ist „verwerfen“ (bzw. nur an Router-Ports) die richtige Einstellung, wenn der Querier sicher läuft.",
        "Link-local-Gruppen 224.0.0.x (z. B. mDNS 224.0.0.251, CITP 224.0.0.180) werden immer an alle Ports geschickt. Das ist gewollt und klein.",
        "Die Gruppentabelle ist begrenzt (je nach Switch 256 bis einige tausend Einträge). Viele sACN-Universen plus Dante-Flows können sie füllen.",
      ] },
      { t: "h", x: "Multicast-MAC-Adressen" },
      { t: "p", x: "Aus einer Multicast-IP wird die MAC 01:00:5e plus die unteren 23 Bit der IP. Dadurch teilen sich 32 IP-Gruppen eine MAC-Adresse (z. B. 239.255.0.1 und 224.127.0.1). Switches, die nach MAC filtern, trennen solche Gruppen nicht." },
    ],
  },
  {
    id: "qos", titel: "QoS & DSCP", kurz: "Priorisierung, damit Taktpakete und Audio nicht hinter großen Datenmengen warten.",
    bloecke: [
      { t: "p", x: "QoS sortiert Pakete in Warteschlangen. Solange ein Port nicht voll ist, ändert QoS nichts. Wichtig wird es, wenn kurzzeitig mehr Daten auf einen Port wollen, als er abgeben kann (z. B. Showfile-Transfer, Video, Updates): Dann dürfen PTP- und Audiopakete nicht hinter großen Paketen warten." },
      { t: "ul", x: [
        "DSCP steht im IP-Header und wird vom Gerät gesetzt. Der Switch muss dem DSCP-Wert „vertrauen“ (Trust DSCP).",
        "Strict Priority: Die höchste Queue wird immer zuerst geleert.",
        "Dante empfiehlt vier Queues: DSCP 56 (CS7) PTP, 46 (EF) Audio, 8 (CS1) reserviert, alles andere Best Effort.",
        "Licht (sACN, Art-Net, MA-Net) läuft Best Effort und wird über ein eigenes VLAN getrennt.",
        "NDI empfiehlt, QoS nicht zu nutzen.",
      ] },
      { t: "h", x: "DSCP-Werte aus der Recherche" },
      { t: "qos" },
      { t: "hint", x: "Dante und AES67 nutzen unterschiedliche DSCP-Werte für PTP (56 bzw. 46). Laufen beide im selben Netz, muss ein gemeinsames Schema festgelegt werden, sonst konkurriert Audio mit dem Takt." },
    ],
  },
  {
    id: "bandbreite", titel: "Bandbreite & Reserve", kurz: "Wie viel die Protokolle wirklich brauchen und wie man Uplinks dimensioniert.",
    bloecke: [
      { t: "p", x: `Jede Bandbreite im Netzwerkplaner ist Nutzdaten plus Overhead je Paket. Pro UDP-Paket kommen ${WIRE_OVERHEAD} Byte dazu (Präambel 8, Ethernet 14, FCS 4, Pause 12, IPv4 20, UDP 8). Bei kleinen Paketen mit hoher Rate (Dante, sACN) ist dieser Anteil groß.` },
      { t: "table", kopf: ["Beispiel", "Last", "Anmerkung"], zeilen: [
        ["Dante 2 Kanäle, 48 kHz / 24 bit", f(r("dante", 2).mbit), "ein Flow"],
        ["Dante 64 Kanäle", f(r("dante", 64).mbit), `${r("dante", 64).flows} Flows à 4 Kanäle`],
        ["Dante 64 Kanäle, 96 kHz", f(r("dante", 64, { fs: 96000 }).mbit), "doppelte Rate"],
        ["sACN 16 Universen, 44 Hz", f(r("sacn", 16).mbit), "16 Multicast-Gruppen"],
        ["sACN 256 Universen", f(r("sacn", 256).mbit), "Gruppentabelle beachten"],
        ["Art-Net 64 Universen", f(r("artnet", 64).mbit), "als Broadcast an jedem Port"],
        ["MA-Net3 16 Universen", f(r("manet", 16).mbit), "Richtwert"],
        ["NDI 1080p50 (Full)", f(r("ndi", 1, { variante: "full", format: "1080p50" }).mbit), "je Quelle"],
        ["NDI|HX2 1080p50", f(r("ndi", 1, { variante: "hx2", format: "1080p50" }).mbit), "je Quelle"],
        ["OSC 50 Nachrichten/s", f(r("osc", 50).mbit), "vernachlässigbar"],
      ] },
      { t: "h", x: "Dimensionierung" },
      { t: "ul", x: [
        "Dauerlast unter 70 % der Portgeschwindigkeit planen. Die Reserve fängt Lastspitzen (Showfile-Transfer, Discovery, Updates) ab.",
        "Uplinks tragen die Summe aller Ströme, die den Switch verlassen. Full-NDI braucht in der Regel 10G-Uplinks.",
        "Multicast ohne IGMP-Snooping und Art-Net-Broadcast liegen an jedem Port im VLAN an, auch an 100-Mbit-Geräten.",
        "Dante-Geräte mit 100-Mbit-Ports (ältere Verstärker, Wandpanels) begrenzen Kanalzahl und Latenz.",
        "Die Leitungslast im Analyse-Tab rechnet im Worst Case: Ströme ohne Empfänger laufen bis zum Core.",
      ] },
    ],
  },
  {
    id: "laufzeit", titel: "Latenz & Laufzeit", kurz: "Woraus sich die Verzögerung im Netz zusammensetzt und welche Dante-Latenz passt.",
    bloecke: [
      { t: "p", x: "Jeder Switch speichert ein Paket komplett, bevor er es weiterschickt (Store & Forward). Die Zeit dafür hängt von Paketgröße und Portgeschwindigkeit ab. Dazu kommen die Durchlaufzeit des Switches, die Laufzeit im Kabel (≈5 ns je Meter) und im ungünstigsten Fall ein großes Paket, das gerade vor dem eigenen in der Warteschlange liegt." },
      { t: "table", kopf: ["Paket", "100 Mbit/s", "1 Gbit/s", "10 Gbit/s"], zeilen: [64, 300, 1500].map((b) => [`${b} Byte`, ...[100, 1000, 10000].map((m) => us(laufzeit({ bytes: b, mbit: m }).ser))]) },
      { t: "p", x: `Beispiel: 1500-Byte-Paket über 3 Gigabit-Switches, 3 µs Durchlauf je Switch, 200 m Kabel, mit Warteschlange: ≈${us(laufzeit({ hops: 3, mbit: 1000, bytes: 1500, meter: 200, switchUs: 3, queue: true }).gesamt)}. Das Netz selbst ist also schnell; die eingestellte Gerätelatenz muss vor allem Schwankungen (Jitter) auffangen.` },
      { t: "h", x: "Dante-Latenz" },
      { t: "table", kopf: ["Einstellung", "Einsatz"], zeilen: KERN_BY_ID.dante.latenz },
      { t: "p", x: "Die Latenz wird je Empfänger eingestellt und gilt für alle Flows, die er empfängt. Ist sie zu klein, zeigt Dante Controller späte Pakete an („Late Packets“) und es gibt Aussetzer. Der Analyse-Tab zählt die Switches zwischen den Dante-Geräten und schlägt einen Wert vor." },
      { t: "h", x: "Weitere Größenordnungen" },
      { t: "table", kopf: ["Was", "Zeit"], zeilen: [
        ["1 Sample bei 48 kHz", "20,8 µs"],
        ["DMX-Frame mit 512 Kanälen", "≈22,7 ms (max. ≈44 Hz)"],
        ["Videoframe bei 50p", "20 ms"],
        ["Schall in 1 m Luft", "≈2,9 ms"],
      ] },
    ],
  },
  {
    id: "ptp", titel: "PTP-Takt", kurz: "Wie Dante und AES67 ihren gemeinsamen Takt über das Netz verteilen.",
    bloecke: [
      { t: "p", x: "PTP (Precision Time Protocol, IEEE 1588) verteilt einen gemeinsamen Takt. Ein Gerät wird per Best-Master-Clock-Algorithmus zum Leader, alle anderen folgen. Die Pakete sind klein, aber zeitkritisch: Schwankungen in der Laufzeit werden als Taktschwankung sichtbar." },
      { t: "ul", x: [
        "Dante nutzt PTPv1 (Multicast 224.0.1.129, UDP 319/320). Im AES67-Modus kommt PTPv2 dazu.",
        "Ein Leader je Netz. In Dante Controller lässt sich ein bevorzugter Leader festlegen, z. B. das FOH-Pult.",
        "PTP braucht IGMP-Snooping mit Querier (Multicast) und die höchste QoS-Klasse.",
        "EEE verzögert Pakete unregelmäßig und stört den Takt. Deshalb aus.",
        "Über Router hinweg nur mit PTP-fähigen Switches (Boundary Clock) oder Dante Domain Manager.",
        "MA-Net, Art-Net, sACN, NDI, OSC und CITP brauchen kein PTP.",
      ] },
    ],
  },
  {
    id: "eee", titel: "Energy Efficient Ethernet", kurz: "Warum „Green Ethernet“ an Medienports ausgeschaltet gehört.",
    bloecke: [
      { t: "p", x: "EEE (IEEE 802.3az) schaltet Ports bei wenig Verkehr kurz in einen Schlafzustand. Das Aufwachen dauert einige Mikrosekunden und passiert unregelmäßig. Für Bürodaten egal, für PTP und Audio eine Quelle für Jitter und Clock-Aussetzer." },
      { t: "ul", x: [
        "An allen Ports ausschalten, über die Dante, MA-Net oder sACN laufen. Hersteller nennen es auch „Green Ethernet“ oder „Power Saving“.",
        "Viele Unmanaged-Switches haben EEE fest an. Für Dante nur Modelle ohne EEE verwenden.",
        "Luminex GigaCore und die meisten AV-Profile haben EEE ab Werk aus. Bei Office-Switches (auch Cisco) muss es meist von Hand abgeschaltet werden.",
      ] },
    ],
  },
  {
    id: "stp", titel: "Spanning Tree & Schleifen", kurz: "Loops erkennen und verhindern, ohne dass Geräteports lange blockieren.",
    bloecke: [
      { t: "p", x: "Eine Schleife im Netz lässt Broadcasts endlos kreisen und legt innerhalb von Sekunden alles lahm. Spanning Tree (RSTP) findet Schleifen und blockiert einen Port. Im Showbetrieb sind Schleifen oft versehentlich: ein zweites Kabel zwischen zwei Switches oder Primary und Secondary verbunden." },
      { t: "ul", x: [
        "RSTP (802.1w) statt klassischem STP, damit Umschaltungen in Sekunden statt Minuten passieren.",
        "Geräteports als Edge-Port (Cisco: PortFast), damit Pulte und Stageboxen sofort Link haben.",
        "BPDU-Guard an Ports für fremde Geräte schaltet den Port ab, wenn dort ein Switch auftaucht.",
        "Eine Root-Bridge bewusst festlegen (niedrigste Priorität am Core).",
        "Dante Primary und Secondary nie verbinden, auch nicht über einen Trunk mit beiden VLANs auf demselben unmanaged Switch.",
        "Ringe (Luminex RLinkX, ERPS) sind herstellerspezifisch; nicht mit RSTP mischen, ohne die Doku zu prüfen.",
      ] },
    ],
  },
  {
    id: "vlan", titel: "VLANs & Trunks", kurz: "Gewerke trennen, Uplinks richtig taggen.",
    bloecke: [
      { t: "p", x: "Ein VLAN ist ein eigenes Netz auf derselben Hardware. Broadcasts und Multicast bleiben im VLAN. So stört Art-Net-Broadcast nicht das Audio, und Video-Last bleibt vom Licht getrennt." },
      { t: "ul", x: [
        "Access-Port: gehört genau zu einem VLAN, das Gerät merkt nichts davon (untagged).",
        "Trunk: trägt mehrere VLANs mit Tag (802.1Q). Beide Enden müssen dieselben VLANs erlauben.",
        "Native VLAN auf Trunks bewusst setzen oder nicht verwenden, damit ungetaggte Pakete nicht im falschen Netz landen.",
        "Discovery (mDNS, ArtPoll, CITP-PINF, sACN-Discovery) geht nicht über VLAN-Grenzen. Geräte, die sich finden sollen, gehören ins selbe VLAN.",
        "Ein eigenes Management-VLAN für die Switch-Web-UIs hält Show-Traffic und Konfiguration auseinander.",
      ] },
    ],
  },
  {
    id: "adressen", titel: "Adressen, Ports & Discovery", kurz: "Welche Multicast-Gruppen und Ports die Kernprotokolle verwenden.",
    bloecke: [
      { t: "table", kopf: ["Protokoll", "Ports", "Multicast / Broadcast", "Discovery"], zeilen: "refs" },
      { t: "h", x: "sACN-Universum → Gruppe" },
      { t: "p", x: "Universum n liegt auf 239.255.{n ÷ 256}.{n mod 256}. Universum 1 ist 239.255.0.1, Universum 300 ist 239.255.1.44." },
      { t: "h", x: "Discovery" },
      { t: "ul", x: [
        "mDNS (224.0.0.251, UDP 5353) nutzen Dante und NDI. Es wird nicht geroutet. NDI über mehrere VLANs braucht einen Discovery Server.",
        "Art-Net findet Nodes per ArtPoll (Broadcast), CITP per PINF-Multicast 224.0.0.180.",
        "Dante-Geräte ohne DHCP nehmen sich Link-local-Adressen (169.254.x.x) und finden sich trotzdem. Für geplante Netze sind feste Adressen übersichtlicher.",
      ] },
    ],
  },
  {
    id: "jumbo", titel: "Jumbo-Frames", kurz: "Für die Kernprotokolle nicht nötig.",
    bloecke: [
      { t: "p", x: "Jumbo-Frames (bis ≈9000 Byte) helfen bei großen Dateiübertragungen. Dante, sACN, Art-Net, MA-Net, OSC und CITP schicken kleine Pakete, NDI empfiehlt Jumbo aus. Unterschiedliche MTU-Einstellungen im selben Netz führen zu schwer auffindbaren Verlusten. Empfehlung: aus." },
    ],
  },
  {
    id: "redundanz", titel: "Redundanz", kurz: "Zweite Wege für Audio, Licht und Steuerung.",
    bloecke: [
      { t: "ul", x: [
        "Dante: Primary und Secondary als zwei physisch getrennte Netze (eigene Switches oder eigene VLANs auf getrennter Hardware). Fällt ein Netz aus, läuft das andere ohne Unterbrechung weiter.",
        "sACN: Backup-Pult mit niedrigerer Priorität sendet parallel. Fällt das Hauptpult aus, übernimmt der Node die nächste Priorität.",
        "MA-Net3: Backup-Pult bzw. -Processing-Unit in derselben Session übernimmt automatisch.",
        "Uplinks: Link Aggregation (LACP) oder Ringprotokolle der Switch-Hersteller. Nie zwei einfache Kabel ohne RSTP/LACP.",
        "Stromversorgung der Core-Switches redundant oder über USV planen.",
      ] },
    ],
  },
];

/* Werkzeuge zum Messen und Prüfen */
export const WIRESHARK = [
  ["Dante Audio", "udp.port in {14336..15359}"],
  ["PTP", "ptp"],
  ["IGMP-Joins", "igmp"],
  ["mDNS / Discovery", "mdns"],
  ["sACN", "acn || udp.port == 5568"],
  ["Art-Net", "artnet"],
  ["MA-Net3", "udp.port == 30020"],
  ["NDI", "tcp.port in {5959..5969}"],
  ["OSC", "osc"],
  ["CITP", "udp.port == 4809 || ip.dst == 224.0.0.180"],
];

export const WERKZEUGE = [
  ["Wireshark", "Mitschnitt an einem Spiegelport (Port Mirroring). Filter siehe unten."],
  ["iperf3", "Durchsatz einer Strecke messen, bevor Show-Traffic drauf ist."],
  ["Switch-Web-UI / CLI", "Portzähler (Fehler, Drops), IGMP-Gruppen, Querier-Status, EEE, Spanning Tree."],
  ["Luminex GigaCore / Araneo", "Profile, IGMP, QoS und Gruppen je Port; Araneo zeigt mehrere GigaCores zusammen."],
  ["Dante Controller", "Clock-Status, Late Packets, Latenz, Bandbreite je Gerät."],
  ["sACNView", "sACN-Quellen, Prioritäten und Werte je Universum."],
  ["DMX Workshop", "Art-Net-Nodes finden, Universen ansehen."],
  ["NDI Studio Monitor / NDI Analysis", "NDI-Quellen, Bitrate, Verbindungsart."],
  ["nmap / Angry IP Scanner", "Belegte IP-Adressen im VLAN finden."],
];

export const CISCO = [
  ["IGMP-Snooping-Gruppen", "show ip igmp snooping groups"],
  ["Querier", "show ip igmp snooping querier"],
  ["Fehlerzähler", "show interfaces counters errors"],
  ["Drops je Queue", "show platform hardware fed switch active qos queue stats interface Gi1/0/1"],
  ["EEE", "show eee status interface Gi1/0/1"],
  ["Spanning Tree", "show spanning-tree summary"],
];
