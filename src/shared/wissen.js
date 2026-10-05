/* ── Wissen: Erklärungen zu den Netzwerkanforderungen ──────────────────────
   Blöcke: { t: "p" | "h" | "ul" | "table" | "hint" | "code", … }
   Zahlen mit „≈“ sind Richtwerte für die Planung. */
import { KERN, KERN_BY_ID, defaultParams, WIRE_OVERHEAD } from "./kernprotokolle.js";
import { laufzeit } from "./analyse.js";
import { prefixToMaskStr } from "./net.js";

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
      { t: "bild", id: "igmp" },
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
      { t: "bild", id: "qos" },
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
      { t: "p", x: "Die Latenz wird je Empfänger eingestellt und gilt für alle Flows, die er empfängt. Ist sie zu klein, zeigt Dante Controller späte Pakete an („Late Packets“) und es gibt Aussetzer. Die Prüfung zählt die Switches zwischen den Dante-Geräten und warnt bei mehr als 10 Hops." },
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
      { t: "bild", id: "ptp" },
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
      { t: "bild", id: "stp" },
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
    id: "ip", titel: "IP-Adressen & Netzrechner", kurz: "IPv4 und IPv6: Aufbau, Klassen, private und besondere Bereiche, Subnetze. Oben der Rechner zum Ausprobieren.",
    bloecke: [
      { t: "rechner" },
      { t: "h", x: "IPv4: Aufbau" },
      { t: "p", x: "Eine IPv4-Adresse hat 32 Bit, geschrieben als vier Zahlen von 0 bis 255 (z. B. 10.10.20.15). Die Subnetzmaske (oder das Präfix, z. B. /24) teilt sie in Netzanteil und Hostanteil: /24 heißt, die ersten 24 Bit sind das Netz, die letzten 8 Bit zählen die Geräte. Geräte im selben Netz sprechen direkt miteinander, alles andere geht über das Gateway (den Router)." },
      { t: "bild", id: "ip" },
      { t: "ul", x: [
        "Netzadresse: alle Host-Bits 0 (10.10.20.0/24). Sie bezeichnet das Netz und wird nicht vergeben.",
        "Broadcast: alle Host-Bits 1 (10.10.20.255/24). Ein Paket daran erreicht alle im Netz, z. B. ArtPoll.",
        "Nutzbare Hosts: 2^(32 − Präfix) − 2. Bei /24 sind das 254.",
        "Gateway: meist die erste (.1) oder letzte (.254) Adresse. Im Showbetrieb ohne Internet oft gar nicht nötig.",
        "Wildcard-Maske: die umgedrehte Maske (0.0.0.255 bei /24), gebraucht in Cisco-ACLs und OSPF.",
      ] },
      { t: "h", x: "Adressklassen (historisch)" },
      { t: "p", x: "Bis 1993 legte das erste Oktett die Netzgröße fest. Seit CIDR (Classless Inter-Domain Routing) kann jede Maske frei gewählt werden. Die Klassen tauchen trotzdem noch auf: Geräte schlagen sie als Standardmaske vor, und Art-Net 2.x.x.x/8 ist ein Klasse-A-Netz." },
      { t: "table", kopf: ["Klasse", "Erstes Oktett", "Erste Bits", "Standardmaske", "Netze × Hosts", "Heute"], zeilen: [
        ["A", "0–127", "0…", "255.0.0.0 (/8)", "126 × 16,7 Mio.", "0.x und 127.x sind reserviert"],
        ["B", "128–191", "10…", "255.255.0.0 (/16)", "16.384 × 65.534", ""],
        ["C", "192–223", "110…", "255.255.255.0 (/24)", "2,1 Mio. × 254", "/24 ist bis heute die übliche LAN-Größe"],
        ["D", "224–239", "1110…", "–", "Multicast-Gruppen", "Dante, sACN, PTP, MA-Net3, mDNS"],
        ["E", "240–255", "1111…", "–", "reserviert", "nicht verwenden"],
      ] },
      { t: "h", x: "Private und besondere IPv4-Bereiche" },
      { t: "table", kopf: ["Bereich", "Name", "Bedeutung im Veranstaltungsnetz"], zeilen: [
        ["10.0.0.0/8", "Privat (RFC 1918)", "Größter privater Bereich, gut für VLAN-Schemata wie 10.10.<VLAN>.0/24."],
        ["172.16.0.0/12", "Privat (RFC 1918)", "172.16.0.0 bis 172.31.255.255. Dante Secondary nutzt ab Werk 172.31.x.x."],
        ["192.168.0.0/16", "Privat (RFC 1918)", "Ab Werk bei vielen Geräten (192.168.0.x, 192.168.1.x). Kollidiert gern mit Heim- und Hotelnetzen."],
        ["169.254.0.0/16", "Link-Local / APIPA", "Selbst vergebene Adresse, wenn kein DHCP antwortet. Dante Primary ohne DHCP landet hier. Wird nicht geroutet."],
        ["127.0.0.0/8", "Loopback", "Das eigene Gerät (127.0.0.1 = localhost). Nie im Netz vergeben."],
        ["100.64.0.0/10", "Carrier-Grade NAT", "Vom Provider (LTE-/5G-Router, Starlink). Nicht für eigene Netze verwenden."],
        ["2.0.0.0/8 · 10.0.0.0/8", "Art-Net", "Art-Net nutzt 2.x.x.x oder 10.x.x.x mit /8. 2.0.0.0/8 ist eigentlich öffentlich, darf also nie ins Internet geroutet werden."],
        ["224.0.0.0/4", "Multicast (Klasse D)", "224.0.0.x ist Link-Local (mDNS 224.0.0.251, CITP 224.0.0.180), 239.x ist organisationsintern (Dante und sACN 239.255.x.x, AES67 239.69.x.x)."],
        ["192.0.2.0/24 · 198.51.100.0/24 · 203.0.113.0/24", "Dokumentation", "Nur für Beispiele in Handbüchern."],
        ["255.255.255.255", "Limitierter Broadcast", "Erreicht alle im eigenen Netz, wird nie geroutet."],
        ["0.0.0.0", "Unbestimmt", "„Noch keine Adresse“ (DHCP-Anfrage) oder „alle Schnittstellen“ bei Diensten."],
      ] },
      { t: "h", x: "Präfix, Maske und Größe" },
      { t: "table", kopf: ["Präfix", "Maske", "Nutzbare Hosts", "Typisch für"], zeilen: [
        [8, "Klasse-A-Netz, sehr groß (z. B. Art-Net 2.0.0.0/8)"],
        [16, "Klasse-B-Netz, Link-Local 169.254/16, Dante Secondary 172.31/16"],
        [20, "großes Show-Netz mit viel Reserve"],
        [22, "mehrere Gewerke in einem Netz"],
        [23, "doppeltes /24"],
        [24, "der Standard je VLAN"],
        [25, "halbes /24"],
        [26, "kleine Gewerke"],
        [27, "ein Rack, ein Pult-Netz"],
        [28, "Management kleiner Racks"],
        [29, "wenige Geräte, z. B. Kamera-Steuerung"],
        [30, "klassische Punkt-zu-Punkt-Strecke"],
        [31, "2 Adressen ohne Netz/Broadcast, Router-Links (RFC 3021)"],
        [32, "einzelne Adresse (Loopback, Host-Route)"],
      ].map(([p, z]) => [`/${p}`, prefixToMaskStr(p), (p >= 31 ? 2 ** (32 - p) : 2 ** (32 - p) - 2).toLocaleString("de-DE"), z]) },
      { t: "bild", id: "subnetze" },
      { t: "ul", x: [
        "Teilnetze bilden: Präfix um 1 erhöhen halbiert das Netz. Aus 10.10.0.0/22 werden vier /24 (10.10.0.0 bis 10.10.3.0). Der Rechner oben zeigt die Aufteilung.",
        "Subnetze dürfen sich nicht überschneiden. Der Netzwerkplaner warnt, wenn zwei VLAN-Subnetze sich überlappen.",
        "Faustregel für Shows: ein /24 je VLAN. Das reicht für fast jedes Gewerk und bleibt im Kopf rechenbar.",
      ] },
      { t: "h", x: "IPv6: Aufbau" },
      { t: "p", x: "Eine IPv6-Adresse hat 128 Bit, geschrieben als acht Gruppen zu vier Hex-Ziffern: 2001:0db8:0000:0000:0000:ff00:0042:8329. Führende Nullen je Gruppe dürfen wegfallen, und genau eine Folge von Null-Gruppen darf durch „::“ ersetzt werden: 2001:db8::ff00:42:8329. In URLs steht die Adresse in eckigen Klammern (http://[fe80::1]:8080), bei Link-Local-Adressen folgt oft die Schnittstelle mit % (fe80::1%en0)." },
      { t: "ul", x: [
        "Präfix: wie bei IPv4 der Netzanteil, z. B. /64. Ein LAN bekommt immer ein /64, auch wenn nur drei Geräte darin sind.",
        "Interface-ID: die unteren 64 Bit. Das Gerät bildet sie selbst (SLAAC), zufällig (Privacy Extensions) oder per EUI-64 aus der MAC (ff:fe in die Mitte, das 7. Bit gekippt).",
        "Es gibt kein Broadcast mehr. An seine Stelle tritt Multicast, z. B. ff02::1 für alle Knoten im Link.",
        "Neighbor Discovery (NDP, ICMPv6) ersetzt ARP. ICMPv6 darf deshalb nie komplett gefiltert werden.",
        "Adressvergabe: SLAAC (Router Advertisement vom Router), DHCPv6 oder fest. Ohne Router hat jedes Gerät trotzdem eine Link-Local-Adresse.",
        "Jede Schnittstelle hat mehrere Adressen gleichzeitig: Link-Local plus ggf. ULA und global.",
      ] },
      { t: "h", x: "IPv6-Adressarten" },
      { t: "table", kopf: ["Bereich", "Name", "Entspricht bei IPv4", "Hinweis"], zeilen: [
        ["::1/128", "Loopback", "127.0.0.1", ""],
        ["::/128", "Unbestimmt", "0.0.0.0", ""],
        ["fe80::/10", "Link-Local", "169.254.0.0/16", "Jede Schnittstelle hat eine, wird nie geroutet. Dante Domain Manager und AES67-Geräte können sie nutzen."],
        ["fc00::/7 (praktisch fd00::/8)", "Unique Local Address (ULA)", "RFC 1918 (privat)", "Für interne Netze: fd + 40 Bit Zufall als eigenes /48, darin 65.536 /64-Netze."],
        ["2000::/3", "Global Unicast", "öffentliche Adresse", "Vom Provider, weltweit eindeutig und routbar."],
        ["ff00::/8", "Multicast", "224.0.0.0/4", "ff02:: = Link-Local-Scope (ff02::1 alle Knoten, ff02::2 alle Router, ff02::fb mDNS)."],
        ["::ffff:0:0/96", "IPv4-gemappt", "–", "Schreibweise einer IPv4-Adresse im IPv6-Stack (::ffff:192.168.1.5)."],
        ["2001:db8::/32", "Dokumentation", "192.0.2.0/24 usw.", "Nur für Beispiele."],
      ] },
      { t: "h", x: "IPv4 und IPv6 in der Veranstaltungstechnik" },
      { t: "ul", x: [
        "Die Kernprotokolle (Dante, Art-Net, sACN, MA-Net, NDI, OSC, CITP) laufen in der Praxis über IPv4. Geplant und vergeben wird deshalb IPv4.",
        "Dual-Stack: Betriebssysteme haben IPv6 parallel an. Laptops sprechen sich dann oft über fe80:: an, auch wenn IPv4 falsch eingestellt ist. Bei Fehlersuche daran denken.",
        "mDNS läuft auch über IPv6 (ff02::fb). Ein mDNS-Reflector muss beide Varianten weitergeben oder IPv6 bewusst auslassen.",
        "Switches mit IPv6-Management oder MLD-Snooping (das IGMP von IPv6) brauchen eigene Einstellungen; IGMP-Snooping allein deckt IPv6-Multicast nicht ab.",
      ] },
    ],
  },
  {
    id: "vlan", titel: "VLANs & Trunks", kurz: "Gewerke trennen, Uplinks richtig taggen.",
    bloecke: [
      { t: "p", x: "Ein VLAN ist ein eigenes Netz auf derselben Hardware. Broadcasts und Multicast bleiben im VLAN. So stört Art-Net-Broadcast nicht das Audio, und Video-Last bleibt vom Licht getrennt." },
      { t: "bild", id: "vlan" },
      { t: "ul", x: [
        "Access-Port: gehört genau zu einem VLAN, das Gerät merkt nichts davon (untagged).",
        "Trunk: trägt mehrere VLANs mit Tag (802.1Q). Beide Enden müssen dieselben VLANs erlauben.",
        "Native VLAN auf Trunks bewusst setzen oder nicht verwenden, damit ungetaggte Pakete nicht im falschen Netz landen.",
        "Discovery (mDNS, ArtPoll, CITP-PINF, sACN-Discovery) geht nicht über VLAN-Grenzen. Geräte, die sich finden sollen, gehören ins selbe VLAN.",
        "Ein eigenes Management-VLAN für die Switch-Web-UIs hält Show-Traffic und Konfiguration auseinander.",
      ] },
      { t: "hint", x: "Im Netzwerkplaner gehören VLANs nur zu Switch-Ports. Ein Endgerät hat selbst kein VLAN: Es übernimmt das VLAN des Access-Ports, an dem es steckt. Hängt es an keinem Switch mit VLAN, ordnet der Planer es über seine IP dem passenden VLAN-Subnetz zu." },
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
    id: "osi", titel: "OSI-Modell & Ports", kurz: "Welche Protokolle auf welcher Schicht laufen, mit Port und Übertragungsart. Nach den Protokoll-Postern von Frank Plöger (Lichttechnik) und W&T.",
    bloecke: [{ t: "poster" }],
  },
  {
    id: "mdns", titel: "mDNS-Dienste", kurz: "Welche Dienste Geräte per mDNS/DNS-SD ankündigen. mDNS (224.0.0.251:5353) wird nicht geroutet: pro VLAN planen oder einen mDNS-Reflector einsetzen.",
    bloecke: [{ t: "mdns" }],
  },
  {
    id: "infrastruktur", titel: "Infrastruktur-Protokolle", kurz: "Die Protokolle, die im Hintergrund laufen (DHCP, LLDP, SNMP, NTP …), und ihre Rolle im Veranstaltungsnetz.",
    bloecke: [{ t: "infra" }],
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
      { t: "bild", id: "redundanz" },
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
