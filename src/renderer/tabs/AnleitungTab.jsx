import React, { useState } from "react";
import { S, ACCENT, SUB, LINE } from "../../shared/constants.js";
import { WERKZEUGE, WIRESHARK, CISCO } from "../../shared/wissen.js";
import { Section } from "../ui.jsx";
import BILDER from "virtual:anleitung-bilder";

/* Anleitung: ein Kapitel je Tab bzw. Funktion, mit Screenshots aus dem Beispielprojekt
   (assets/anleitung/*.jpg, beim Build eingebettet). */

const Bild = ({ id, text }) => BILDER[id] ? (
  <figure style={{ margin: "4px 0 16px" }}>
    <img src={BILDER[id]} alt={text || id} style={{ width: "100%", display: "block", borderRadius: 8, border: `1px solid ${LINE}` }} />
    {text && <figcaption style={{ fontSize: 11.5, color: SUB, marginTop: 5 }}>{text}</figcaption>}
  </figure>
) : null;

const Liste = ({ items }) => (
  <ul style={{ margin: "0 0 14px", paddingLeft: 18, lineHeight: 1.7, fontSize: 13, color: "#d4dae0" }}>
    {items.map((t, i) => <li key={i}>{t}</li>)}
  </ul>
);
const H = ({ children }) => <h3 style={{ ...S.h3, margin: "18px 0 6px" }}>{children}</h3>;
const Tab = ({ id, goTab, children }) => goTab ? <button style={{ ...S.secondaryBtn, padding: "5px 12px" }} onClick={() => goTab(id)}>{children} öffnen →</button> : null;
const Code = ({ rows }) => (
  <table style={S.table}><tbody>
    {rows.map(([n, f]) => <tr key={n}><td style={{ ...S.td, width: 170 }}>{n}</td><td style={{ ...S.td, fontFamily: "Consolas,monospace", color: "#8ec5ff" }}>{f}</td></tr>)}
  </tbody></table>
);

const KAPITEL = [
  { id: "start", titel: "Erste Schritte", tab: ["projekt", "Projekt"], inhalt: () => <>
    <Bild id="projekt" text="Tab Projekt mit dem Beispielprojekt" />
    <Liste items={[
      "„Beispielprojekt laden“ zeigt ein fertiges Open-Air-Netz mit Audio, Licht, Video und Intercom. Zum Ausprobieren ideal, „↺ Neues leeres Projekt“ setzt wieder zurück.",
      "Veranstaltung, Ort, Datum, Version und Ersteller erscheinen im Kopf der App und in allen Exporten.",
      "Unter „Standorte / Äste“ legst du Bereiche wie Bühne, FOH oder Monitor an. Geräte lassen sich danach nach Standort filtern und einfärben.",
      "Der Stand wird automatisch gespeichert (💾 auto). „Speichern“ legt zusätzlich eine .netplan-Datei an, die du weitergeben kannst. ↶/↷ bzw. Strg+Z / Strg+Umschalt+Z machen Schritte rückgängig.",
    ]} />
  </> },
  { id: "topo", titel: "Topologie", tab: ["topologie", "Topologie"], inhalt: () => <>
    <Bild id="topologie-mindmap" text="Mindmap: der Core-Switch in der Mitte, Äste nach links und rechts" />
    <H>Geräte hinzufügen und verbinden</H>
    <Liste items={[
      "Einen Typ aus der Palette links auf die Fläche ziehen. Auf ein vorhandenes Gerät gezogen, wird das neue Gerät an den nächsten freien Port angeschlossen.",
      "„+ Aus Katalog …“ öffnet die Suche über Herstellermodelle, eigene Vorlagen und deinen Gerätebestand. Ist ein Gerät ausgewählt, hängt das neue direkt daran.",
      "„🔗 Verbinden“ (Taste C): von Gerät zu Gerät ziehen. Switch-Ports übernehmen das VLAN des Endgeräts. Switch-zu-Switch-Verbindungen werden Trunks mit allen VLANs.",
      "„✥ Bewegen“ (Taste M): Geräte ziehen, der ganze Ast zieht mit. „↺ Auto-Layout“ setzt die Verschiebungen zurück, „⊟ Äste“ klappt Äste ein.",
      "Rechtsklick auf ein Gerät zeigt Ports, Verbindungen und IPs. Entf löscht die Auswahl.",
      "Mausrad zoomt. Shift + Mausrad schiebt die Fläche hoch und runter, ⌘ (Mac) bzw. Strg (Windows) + Mausrad schiebt sie nach links und rechts.",
    ]} />
    <H>Anpinnen, Einrasten, Auto-Anordnen, Stapel, Hintergrund</H>
    <Bild id="topologie-hintergrund" text="Stage-Plot als Hintergrund, angepinntes Pult und ein Stapel aus zwei Nodes" />
    <Liste items={[
      "📌 Anpinnen (Taste P oder Rechtsklick): das Gerät bleibt stehen, wenn sich die Anordnung durch neue Geräte oder Verbindungen ändert. Sein Ast wandert mit ihm. Klick auf die Nadel löst es wieder.",
      "Mehrere Geräte wählen: Shift+Klick (oder ⌘/Strg+Klick) nimmt ein Gerät dazu oder heraus, Shift+Fläche ziehen zieht einen Auswahlrahmen, ⌘/Strg+A wählt alle. Ziehen an einem gewählten Gerät verschiebt alle zusammen. In der Seitenleiste: alle anpinnen (Taste P), als Stapel zusammenfassen, Konfiguration in alle einfügen, alle löschen (Entf).",
      "„Einrasten“ an: Beim Ziehen rastet ein Gerät im Raster ein und richtet sich an Kanten und Mitten benachbarter Geräte aus (gestrichelte Hilfslinie). Alt gedrückt halten = frei ziehen. Der Schalter gilt für das ganze Projekt.",
      "„Auto-Anordnen“ aus: alle Geräte und Leitungen bleiben, wo sie sind, auch die nicht angepinnten. Ziehen verschiebt dann nur das eine Gerät. Wieder an: die automatische Anordnung gilt wieder, Pins bleiben.",
      "„▤ Stapeln“ (Taste S): ein Gerät auf ein anderes ziehen stellt beide grafisch übereinander, z. B. als Rack oder Tower. Zieht man es auf ein Gerät in einem Stapel oder auf den Stapelrahmen, kommt es oben in diesen Stapel. Der Stapel bleibt dabei an seinem Platz. Das ist keine Netzwerkverbindung. Rechtsklick › „Aus Stapel lösen“ nimmt ein Gerät heraus.",
      "Klick auf Rahmen oder Namen eines Stapels öffnet „Stapel bearbeiten“: Name, Reihenfolge (▲▼), Geräte hinzufügen oder lösen. „⧉ Duplizieren“ legt alle Geräte mit ihren Einstellungen und Verbindungen untereinander als neuen Stapel an (ohne IP- und MAC-Adressen). „⎘ Kopieren“ legt den Stapel in die Zwischenablage, „📋 Stapel einfügen“ in der Werkzeugleiste fügt ihn ein, auch in einem anderen Projekt.",
      "Ein Stapel lässt sich als Ganzes anpinnen: „📌 Anpinnen“ im Stapel-Fenster, Taste P bei ausgewähltem Stapel oder Rechtsklick auf eines seiner Geräte. Vor dem Namen steht dann 📌.",
      "Ein Gerät bekommt nur so viele Kabel, wie es Anschlüsse hat. Sind alle belegt, fragt „Verbinden“, welchen Anschluss du ersetzen willst; die alte Verbindung dort fällt weg. Mehr Ports gibt es nur im Editor mit „+ Port“.",
      "Verbindungen aufräumen: Verbindung anklicken und den roten Punkt in der Mitte ziehen. Doppelklick auf den Punkt setzt sie zurück.",
      "„🖼 Hintergrund“: ein Bild (Stage-Plot, Hallenplan) unter die Geräte legen, um sie in der Location zu verorten. Deckkraft und Größe einstellen, zum Platzieren „Bild mit der Maus verschieben“ einschalten. Das Bild kommt mit in den Export.",
    ]} />
    <H>Frontplatten-Ansicht</H>
    <Bild id="topologie-frontplatten" text="Frontplatten: Switches mit echten Ports, Geräte als Karten an den Ports" />
    <Liste items={[
      "Umschalten oben links zwischen „Mindmap“ und „Frontplatten“. Die Frontplatten zeigen die Switches mit Kupfer-, SFP- und etherCON-Ports.",
      "Ein Klick auf einen Port wählt die Verbindung dahinter aus. Belegte Ports tragen die VLAN-Farbe, Trunks sind weiß.",
    ]} />
    <H>Darstellung</H>
    <Bild id="topologie-eckig" text="Linien eckig, Farbe nach VLAN, Port & VLAN an jeder Verbindung" />
    <Liste items={[
      "„Farbe“: Verbindungen nach VLAN, Bereich oder Kabeltyp einfärben.",
      "„Linien: rund / eckig / direkt“: geschwungene, rechtwinklige oder gerade Verbindungslinien (direkt = kürzester Weg von Port zu Port). Mehrere Kabel zwischen denselben Geräten liegen nebeneinander, in den Frontplatten bekommt jedes Kabel eine eigene Bahn.",
      "„Kabel bündeln“ (nur bei eckigen Linien): an = Kabel teilen sich den Weg, parallele Kabel werden eine Linie mit Anzahl (z. B. 2×). Aus = jedes Kabel läuft einzeln auf eigener Spur.",
      "In den Frontplatten bündelt „Kabel bündeln“ die Kabel eines Switches in einem gemeinsamen Kanal. Kabel zwischen Geräten im selben Stapel erscheinen als Klammer seitlich am Stapel.",
      "„Titel“: in den Kästen den Gerätenamen, den Netzwerknamen (Hostname), den Typ bzw. das Modell oder den Wert eines eigenen Felds (z. B. Inventar-Nr.) zeigen. Ohne Netzwerknamen steht dort der Typ.",
      "„Port & VLAN“ blendet an jeder Verbindung Switch-Port und VLAN ein. Hängt ein Gerät mit mehreren Kabeln am Netz, stehen alle belegten Ports untereinander am Gerät, auch bei gebündelten Kabeln. Filter nach Bereich, VLAN und Suche blenden den Rest ab.",
      "„⟳ Status“ prüft alle Geräte mit IP (Web-UI-Port, sonst Ping). Mit „alle 15 s“ läuft das zyklisch, sofern der Rechner im selben Netz hängt.",
    ]} />
  </> },
  { id: "geraete", titel: "Geräte & Editor", tab: ["geraete", "Geräte"], inhalt: () => <>
    <Bild id="geraete" text="Tab Geräte: alle Geräte als Tabelle, Klick öffnet den Editor" />
    <Liste items={[
      "Klick auf ein Gerät öffnet den Editor: Name, Netzwerkname (Hostname), Hersteller/Modell, Standort, eigene Felder, Ports, Web-UI, Protokolle und Notizen.",
      "Ports: Jeder Port eines Endgeräts ist zugleich sein Interface mit VLAN, IP, Maske, Gateway, MAC und DHCP. ⟳ neben der IP schlägt die nächste freie Adresse im VLAN vor, „⟳ IPs vergeben“ füllt alle leeren Ports auf einmal (je Gerät eine Adresse pro VLAN).",
      "Switch-Ports: Access- oder Trunk-VLANs, PoE und Punkt-zu-Punkt (AES50, SLink, HDBaseT …). Die IP des Switches steht am Anschluss „Management“ ohne Buchse („+ Management“).",
      "„⇄ Modell zuweisen“: ein generisch angelegtes Gerät nachträglich zu einem Katalogmodell machen. Bei Herstellermodellen und Vorlagen bleiben Name, Netzwerkname, IPs, VLANs und eigene Felder erhalten. Bei einem Gerät aus dem eigenen Bestand gelten dessen feste IPs, Name und eigene Felder, genau wie beim Einfügen. Die Verbindungen bleiben immer.",
      "„im Katalog speichern“ legt das Gerät als eigene Vorlage oder im Gerätebestand ab.",
      "🔒 Geräte aus dem Katalog (Herstellermodelle) und aus dem Gerätebestand haben feste Hardware: Gerätetyp, Hersteller, Modell, Ports, Buchsen, P2P und PoE-Werte lassen sich im Editor nicht ändern. Einstellbar bleiben Name, VLAN, IP, Modus, Trunk, PoE je Port, Web-UI, Protokolle und Verbindungen. Ein anderes Modell setzt man mit „⇄ Modell zuweisen“. Generische und selbst angelegte Geräte bleiben frei bearbeitbar.",
      "„⧉ Duplizieren“ kopiert das Gerät mit allen Einstellungen, aber ohne IP- und MAC-Adressen.",
      "„⎘ Konfig kopieren“: im Dialog wählen, was mitkommt (Port-Einstellungen mit VLAN und Maske, Protokolle, Datenströme, Web-UI, PoE, Bereich, Notizen). Bei jedem anderen Gerät dann „📋 Konfig einfügen“, Teile und Zielgeräte wählen („Gleiches Modell“, „Gleicher Typ“, „Alle Switches“) und einfügen. Namen, IPs, MACs und Verbindungen der Ziele bleiben. Ports werden nach Namen zugeordnet, sonst nach Reihenfolge.",
    ]} />
    <Bild id="geraet-editor" text="Geräte-Editor in der Topologie" />
    <H>Generische Geräte aus der Discovery</H>
    <Bild id="geraet-generisch" text="Leere Maske eines gefundenen Geräts" />
    <Liste items={[
      "Geräte, die Discovery oder Netzwerkscan eingefügt haben, zeigen eine leere Maske mit IP, MAC, Protokollen und Fundhinweis.",
      "„⇄ Modell zuweisen“ macht daraus ein Katalogmodell, eine eigene Vorlage oder ein Gerät aus dem Bestand.",
      "„＋ Leeres Gerät anlegen“ fragt nur nach dem Gerätetyp (vorausgewählt ist der Vorschlag der Discovery) und öffnet danach den normalen Editor. Name, IP, MAC, Protokolle und Verbindungen bleiben.",
    ]} />
  </> },
  { id: "vlans", titel: "VLANs", tab: ["vlans", "VLANs"], inhalt: () => <>
    <Bild id="vlans" text="VLAN mit Zweck und Switch-Schaltern" />
    <Liste items={[
      "Die Standard-VLANs 10, 11, 20, 30, 40, 50 und 99 sind schon angelegt. „+ VLAN“ legt ein neues an.",
      "Je VLAN: ID, Name, Farbe, Zweck und Notiz sowie die Schalter IGMP-Snooping, EEE aus, QoS/DSCP und DHCP.",
      "Die Schalter fließen in die Prüfung ein: Multicast-Protokolle verlangen IGMP, Audio over IP und MA-Net3 verlangen EEE aus.",
      "VLAN in VLAN (QinQ, IEEE 802.1ad): Unter „Äußeres VLAN“ ein S-VLAN wählen, dann läuft das VLAN als inneres C-VLAN darin und steht eingerückt darunter. Innere VLANs verschiedener S-VLANs dürfen dieselbe ID haben. Die Prüfung warnt dann und nennt die trennenden S-VLANs; gleiche IDs in derselben Ebene bleiben ein Fehler, ebenso ein Trunk-Port, der dieselbe ID zweimal führt, bekommt eine Warnung.",
    ]} />
  </> },
  { id: "pruefung", titel: "Prüfung & MA-Net", tab: ["pruefung", "Prüfung"], inhalt: () => <>
    <Bild id="pruefung" text="Prüfung mit Fehlern, Warnungen und Hinweisen" />
    <Liste items={[
      "Die Prüfung läuft ständig mit. „Zeigen →“ springt zum betroffenen Gerät, VLAN oder zur Verbindung.",
      "Geprüft werden unter anderem IP-Konflikte, doppelt belegte Ports, VLAN-Fehler an Switch-Ports, Punkt-zu-Punkt-Protokolle am Switch, IGMP bei Multicast, EEE bei Audio over IP, PoE-Budgets, Leitungslast und Dante-Hops.",
    ]} />
    <H>MA-Net Gold-Standards</H>
    <Bild id="pruefung-manet" text="Gold-Standards für MA-Geräte im Tab Prüfung" />
    <Liste items={[
      "Sobald ein Gerät MA-Net1, MA-Net2 oder MA-Net3 spricht, prüft der Netzwerkplaner zusätzlich die MA-Vorgaben. Die Treffer beginnen mit „MA-Net:“.",
      "MA-Net3: 1 GbE durchgehend, eigenes VLAN ohne Dante/NDI, keine 100-Mbit-Geräte, IGMP-Snooping mit Querier, EEE aus, kurze Switch-Ketten (max. 2 ms), kein 192.168.33.x.",
      "MA-Net-Generationen (1, 2, 3) nicht im selben VLAN mischen. Session-Mitglieder mit festen IPs statt DHCP.",
    ]} />
  </> },
  { id: "live", titel: "Live", tab: ["live", "Live"], inhalt: () => <>
    <Bild id="live" text="Live-Tab: Online-Status der geplanten Geräte" />
    <Liste items={[
      "Online-Status: welche geplanten Geräte antworten. Netzwerkscan: ein Subnetz nach aktiven Adressen durchsuchen, gefundene IPs zeigen den Gerätenamen aus dem Plan.",
      "Switches (SNMP): Portstatus und Zähler der managed Switches lesen.",
      "Protokoll-Monitore für sACN, Art-Net, Dante, MA-Net, NDI, OSC, CITP und PTP-Clock hören im Netz mit. Das funktioniert nur in der Desktop-App und nur im selben Netz.",
    ]} />
    <H>Discovery: Geräte automatisch finden</H>
    <Bild id="live-discovery" text="Discovery: gefundene Geräte, neu oder schon im Plan" />
    <Liste items={[
      "„▶ Geräte suchen“ startet die Monitore für Dante, NDI, Art-Net, sACN, CITP und MA-Net und fragt aktiv nach (ArtPoll, mDNS). „Subnetz scannen …“ ergänzt Geräte, die kein Showprotokoll sprechen.",
      "Die Funde werden je IP zusammengeführt: Name im Netz, MAC, Protokolle, Quellen und ein Typvorschlag. „im Plan“ heißt, IP oder MAC stehen schon im Projekt.",
      "„+ Einfügen“ bzw. „+ Alle neuen einfügen“ setzt neue Geräte als generische Einträge in den Plan. Danach im Editor „⇄ Modell zuweisen“ oder „＋ Leeres Gerät anlegen“.",
    ]} />
  </> },
  { id: "katalog", titel: "Katalog", tab: ["bibliothek", "Katalog"], inhalt: () => <>
    <H>Gerätebestand</H>
    <Bild id="katalog-bestand" text="Gerätebestand: deine eigenen Geräte mit eigenen Feldern" />
    <Liste items={[
      "Der Bestand enthält deine realen Geräte mit Namen, Netzwerknamen, IPs und eigenen Feldern. „+ ins Projekt“ setzt ein Gerät samt Adressen ein.",
      "„+ Neues Gerät“ legt ein Gerät direkt im Katalog an, ohne es ins Projekt zu setzen: Grundtyp wählen und im Editor ausfüllen.",
      "„Neues VLAN für dieses Gerät“ (bei „+ Neues Gerät“ und „+ Neue Vorlage“): VLAN-ID und Namen eingeben, wählen, ob es alle Ports (Access) oder ein einzelner Port bekommt, und „＋ Anlegen und zuweisen“. Das VLAN wird mit dem Gerät gespeichert. Fügst du das Gerät in ein Projekt ohne diese VLAN-ID ein, legt der Netzwerkplaner das VLAN dort an.",
      "„⇩ Projektgeräte übernehmen“ kopiert alle Geräte des offenen Projekts in den Bestand.",
      "„Export CSV“ und „Import“ tauschen den Bestand mit anderen Netzwerkplaner-Installationen oder mit einer eigenen Excel-Liste aus (Spalten: Name; Netzwerkname; Hersteller; Modell; Typ; IP1; VLAN1; MAC1 …, danach eine Spalte je eigenem Feld). Unbekannte Spalten werden beim Import zu eigenen Feldern. Modelle werden über Katalog-ID oder Modellname erkannt.",
      "„Eigene Felder“: Felder wie Inventar-Nr., Seriennummer, Case oder Eigentümer einmal anlegen, danach im Geräte-Editor mit „+ Feld …“ bei einem Gerät einfügen und ausfüllen. Umbenennen und Löschen wirkt auf alle Geräte in Projekt, Bestand und Vorlagen.",
    ]} />
    <Bild id="katalog-neu" text="Neues Gerät im Katalog anlegen" />
    <H>Eigene Vorlagen, Herstellergeräte, Protokolle, Icons</H>
    <Bild id="katalog-hersteller" text="Herstellergeräte mit vorbefüllten Ports, Protokollen und Web-UI" />
    <Liste items={[
      "Eigene Vorlagen: wiederkehrende Geräte ohne Adressen. „+ Neue Vorlage“ legt eine an, jedes Projektgerät lässt sich als Vorlage speichern.",
      "Herstellergeräte: die Modelle der Fokus-Hersteller mit Ports, Protokollen und Web-UI.",
      "Protokolle: Ports, Transport, Multicast-Adressen und Anforderungen je Protokoll, mit den Geräten im Projekt, die es sprechen.",
      "Icons: eigene Icons hochladen und Geräten zuweisen.",
    ]} />
  </> },
  { id: "wissen", titel: "Wissen", tab: ["wissen", "Wissen"], inhalt: () => <>
    <Bild id="wissen-poster" text="OSI-Modell & Ports: Protokoll-Poster im App-Design" />
    <Liste items={[
      "Grundlagen zu IGMP, QoS, Bandbreite, Latenz, PTP, EEE, Spanning Tree, VLANs, Redundanz und Switch-Einstellungen je Hersteller.",
      "„OSI-Modell & Ports“ zeigt die Protokoll-Poster: je Protokoll Port, TCP/UDP und Unicast/Broadcast/Multicast. Mauszeiger auf eine Spalte zeigt Details.",
      "„mDNS-Dienste“ und „Infrastruktur-Protokolle“ (früher im Katalog) erklären Discovery sowie DHCP, LLDP, SNMP und NTP.",
      "Kernprotokolle mit Bandbreiten-Rechner. Wo vorhanden, führt ein Wikipedia-Link oben rechts weiter.",
    ]} />
  </> },
  { id: "export", titel: "Export, Logo & Updates", inhalt: () => <>
    <Liste items={[
      "„⇩ Export“: PDF-Dokumentation (Deckblatt, Topologie, VLANs, IP-Liste, Switch-Ports, Geräte, Prüfung), Excel mit IP-Liste, VLANs, Ports und Verbindungen, CSV-IP-Liste und die Topologie als SVG oder PNG.",
      "„+ Logo“ neben dem App-Namen: eigenes Firmenlogo hochladen. Es erscheint im Kopf der App und auf jeder PDF-Seite. ✕ entfernt es wieder. Das Logo bleibt nur auf diesem Rechner.",
      "Updates: Beim Start sucht die App nach einer neuen Version. Unter Windows lädt sie das Update im Hintergrund, „⬆ … installieren“ startet neu und installiert. Unter macOS lädt „⬆ … laden und öffnen“ das passende DMG in den Download-Ordner und öffnet es. Dann „Netzwerkplaner beenden“, die App im Finder-Fenster auf „Programme“ ziehen, „Ersetzen“ wählen und neu starten. Ganz ohne Zutun geht es auf dem Mac erst mit einer Apple-Signatur.",
      "Der Knopf mit der Versionsnummer zeigt alle Änderungen und „Nach Updates suchen“.",
    ]} />
  </> },
  { id: "werkzeuge", titel: "Analyse-Werkzeuge", inhalt: () => <>
    <p style={S.hint}>Werkzeuge für die Fehlersuche am echten Netz. Die Planung im Netzwerkplaner ersetzt keine Messung.</p>
    <table style={S.table}><tbody>
      {WERKZEUGE.map(([n, t]) => <tr key={n}><td style={{ ...S.td, fontWeight: 600, width: 170, verticalAlign: "top" }}>{n}</td><td style={S.td}>{t}</td></tr>)}
    </tbody></table>
    <H>Wireshark-Filter</H>
    <Code rows={WIRESHARK} />
    <H>Cisco-Befehle</H>
    <Code rows={CISCO} />
  </> },
];

export default function AnleitungTab({ goTab }) {
  const [sel, setSel] = useState("start");
  const k = KAPITEL.find((x) => x.id === sel) || KAPITEL[0];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 20, alignItems: "start" }}>
      <div style={{ ...S.section, padding: "10px 0", position: "sticky", top: 100 }}>
        <div className="sp-section-label" style={{ padding: "0 12px" }}>Anleitung</div>
        {KAPITEL.map((x, i) => (
          <button key={x.id} onClick={() => setSel(x.id)} style={{ display: "block", width: "100%", textAlign: "left", background: sel === x.id ? ACCENT + "26" : "none", border: "none", borderLeft: `3px solid ${sel === x.id ? ACCENT : "transparent"}`, color: sel === x.id ? "#fff" : "#c8d0d8", padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>
            {i + 1} · {x.titel}
          </button>
        ))}
      </div>
      <Section title={k.titel} right={k.tab && <Tab id={k.tab[0]} goTab={goTab}>{k.tab[1]}</Tab>}>
        {k.inhalt()}
      </Section>
    </div>
  );
}
