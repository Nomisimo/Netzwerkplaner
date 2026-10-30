/* Interaktive Touren: Schritte und Touren an einer Stelle.
   anker: data-tour-Name des Elements (Liste = alle zusammen markieren, null = Blase in der Mitte)
   art: "klick" (weiter, sobald der Klick auf dem Anker ankommt), "eingabe" (ausprobieren, dann Weiter),
        "ziehen" (weiter, sobald ein Gerät dazukommt), "weiter" (nur Text)
   vor: was vor dem Schritt passiert: Anker-Namen werden angeklickt, { waehle } wählt ein Gerät aus,
        { kontext } öffnet seine Infokarte. Vorher werden offene Dialoge geschlossen. */

export const SCHRITTE = {
  start: { anker: null, art: "weiter", titel: "Willkommen im Netzwerkplaner", knopf: "Tour starten",
    text: "Diese Tour führt dich durch die wichtigsten Menüs. Wir nutzen dafür das Beispielprojekt. Dein eigenes Projekt bleibt gesichert und ist danach wieder da." },
  kopf: { anker: "kopf", art: "weiter", titel: "Die Kopfzeile",
    text: "Hier stehen Veranstaltung, Planversion und Datei. „auto“ heißt: Jede Änderung wird sofort gespeichert. Rückgängig geht mit den Pfeilen oder Strg+Z." },
  tabs: { anker: "tabs", art: "weiter", titel: "Sieben Bereiche",
    text: "Projekt, VLANs, Topologie, Geräte, Live, Bibliothek und Hilfe. Die Zahl am Projekt-Tab zählt offene Fehler und Warnungen." },

  "tab-projekt": { anker: "tab-projekt", art: "klick", titel: "Projekt einrichten", text: "Klicke auf „Projekt“." },
  "projekt-angaben": { anker: "projekt-angaben", vor: ["tab-projekt"], art: "eingabe", titel: "Projektangaben",
    text: "Trag hier Veranstaltung, Ort und Planversion ein. Die Angaben stehen im Kopf jedes Exports." },
  "projekt-uebersicht": { anker: "projekt-uebersicht", vor: ["tab-projekt"], art: "weiter", titel: "Übersicht und Prüfung",
    text: "Die Prüfung läuft ständig mit. „Zeigen →“ springt direkt zum betroffenen Gerät, VLAN oder Kabel." },
  "projekt-standorte": { anker: "projekt-standorte", vor: ["tab-projekt"], art: "weiter", titel: "Standorte",
    text: "FOH, Bühne, Monitor: Standorte gruppieren deine Geräte. Umbenennen gilt im ganzen Projekt." },

  "tab-vlans": { anker: "tab-vlans", art: "klick", titel: "VLANs", text: "Klicke auf „VLANs“." },
  "vlan-liste": { anker: "vlan-liste", vor: ["tab-vlans"], art: "weiter", titel: "VLANs und IP-Plan",
    text: "Jedes VLAN hat ID, Farbe, Subnetz und Schalter für IGMP, EEE und QoS. In einem neuen Projekt legt „Standard-VLANs einfügen“ die üblichen Netze an." },

  "tab-topologie": { anker: "tab-topologie", art: "klick", titel: "Zur Topologie", text: "Klicke auf „Topologie“. Hier zeichnest du dein Netz." },
  "topo-palette": { anker: "topo-palette", vor: ["tab-topologie", "ansicht-mindmap"], art: "ziehen", titel: "Geräte hinzufügen",
    text: "Zieh einen Gerätetyp auf die Fläche. Lässt du ihn auf einem Switch los, steckt er automatisch am nächsten freien Port." },
  "topo-katalog": { anker: "topo-katalog", vor: ["tab-topologie", "ansicht-mindmap"], art: "klick", titel: "Aus dem Katalog",
    text: "Klicke auf „Aus Katalog …“. Dort findest du über 300 Herstellermodelle mit Ports, Protokollen und Web-UI." },
  "topo-picker": { anker: "picker", vor: ["tab-topologie", "topo-katalog"], art: "eingabe", titel: "Modell suchen",
    text: "Tippe z. B. „GigaCore“ und wähle ein Modell. Mit „Anzahl“ fügst du mehrere gleiche Geräte auf einmal ein." },
  "topo-werkzeuge": { anker: "topo-werkzeuge", vor: ["tab-topologie", "ansicht-mindmap"], art: "weiter", titel: "Werkzeuge",
    text: "Auswählen (M), Verbinden (C): von Gerät zu Gerät ziehen steckt ein Kabel. Stapeln (S) baut Racks und Tower." },
  "topo-editor": { anker: "topo-editor", vor: ["tab-topologie", "ansicht-mindmap", { waehle: "SW FOH" }], art: "weiter", titel: "Der Geräte-Editor",
    text: "Ein Klick auf ein Gerät öffnet rechts den Editor: Name, Standort, Ports mit VLAN, PoE und IP. Endgeräte übernehmen ihr VLAN vom Switch-Port." },
  "topo-kontext": { anker: "kontextmenue", vor: ["tab-topologie", "ansicht-mindmap", { kontext: "Rio A" }], art: "weiter", titel: "Rechtsklick",
    text: "Ein Rechtsklick auf ein Gerät zeigt Ports, Verbindungen und IPs auf einen Blick, dazu Anpinnen und Löschen." },
  "topo-ansichten": { anker: "topo-ansichten", vor: ["tab-topologie", "ansicht-mindmap"], art: "klick", titel: "Drei Ansichten",
    text: "Mindmap zeigt den Baum, Anschlüsse die echten Buchsen, Druckplan ein fertiges A3-Blatt. Klicke auf „Anschlüsse“." },
  "topo-anschluesse": { anker: "topo-flaeche", vor: ["tab-topologie", "ansicht-front"], art: "weiter", titel: "Ansicht Anschlüsse",
    text: "Ports tragen die Farbe ihres VLANs, Trunks sind gestreift. Klick auf einen freien Port und dann auf ein Gerät steckt ein Kabel genau dort." },
  "topo-druckplan": { anker: "druckplan", vor: ["tab-topologie", "ansicht-cleancat"], art: "weiter", titel: "Druckplan",
    text: "Der aufgeräumte Plan mit Standorten, Legende und Plankopf. Standorte und Geräte lassen sich greifen und umstellen." },
  "topo-darstellung": { anker: ["topo-darstellung", "topo-anordnen"], vor: ["tab-topologie", "ansicht-mindmap"], art: "weiter", titel: "Darstellung und Anordnen",
    text: "Kabelfarbe nach VLAN, Gewerk oder Kabeltyp, Linienform und Beschriftung. Unter „Anordnen“: Äste einklappen, Stapel einfügen, Hintergrundbild." },
  "topo-filter": { anker: ["topo-suche", "topo-filter"], vor: ["tab-topologie", "ansicht-mindmap"], art: "eingabe", titel: "Suchen und filtern",
    text: "Nach Name oder IP suchen, nur ein Gewerk oder ein VLAN hervorheben. Der Rest wird abgeblendet." },
  "topo-meldungen": { anker: "topo-meldungen", vor: ["tab-topologie", "ansicht-mindmap"], art: "weiter", titel: "Meldungen",
    text: "Fehler, Warnungen und Hinweise der Prüfung als Zähler. Ein Klick auf eine Zahl listet die Meldungen, „Zeigen“ springt zum Gerät." },
  "topo-status": { anker: "topo-status", vor: ["tab-topologie", "ansicht-mindmap"], art: "weiter", titel: "Wer ist online?",
    text: "Pingt alle Geräte an oder prüft den Web-UI-Port. Mit „alle 15 s“ läuft das dauerhaft. Geräte mit Web-UI öffnest du per Klick auf das Globus-Symbol." },

  "tab-geraete": { anker: "tab-geraete", art: "klick", titel: "Alle Geräte als Liste", text: "Klicke auf „Geräte“." },
  "geraete-tabelle": { anker: "geraete-tabelle", vor: ["tab-geraete", "geraete-liste"], art: "weiter", titel: "Geräteliste",
    text: "Alle Geräte mit Typ, IPs, VLAN und Port. Sortieren per Klick auf den Spaltenkopf, ein Klick auf eine Zeile öffnet den Editor." },
  "geraete-ips": { anker: "geraete-ips", vor: ["tab-geraete", "geraete-liste"], art: "weiter", titel: "IPs automatisch vergeben",
    text: "Vergibt allen Geräten ohne Adresse die nächste freie IP aus dem Subnetz ihres VLANs." },
  "geraete-ansicht": { anker: "geraete-ansicht", vor: ["tab-geraete", "geraete-liste"], art: "klick", titel: "Patchliste",
    text: "Klicke auf „Patchliste“: alle Geräte in Aufbau-Reihenfolge, Switch und Port direkt in der Tabelle umstecken, als PDF mit Abhak-Kästchen drucken." },

  "tab-live": { anker: "tab-live", art: "klick", titel: "Live am echten Netz", text: "Klicke auf „Live“. Hier prüfst du den Plan gegen das echte Netz." },
  "live-karte": { anker: "live-karte", vor: ["tab-live"], art: "eingabe", titel: "Netzwerkkarte wählen",
    text: "Wähle zuerst die Netzwerkkarte, die im Show-Netz steckt. Alle Live-Funktionen laufen nur über diese Karte." },
  "live-ansichten": { anker: "live-ansichten", vor: ["tab-live", "live-status"], art: "klick", titel: "Werkzeuge und Monitore",
    text: "Online-Status, Discovery, Netzwerkscan, SNMP und Monitore für sACN, Art-Net, Dante, MA-Net, NDI, OSC, CITP und PTP. Klicke auf „Discovery“." },
  "live-discovery": { anker: "inhalt", vor: ["tab-live", "live-discovery"], art: "weiter", titel: "Geräte finden",
    text: "„Geräte suchen“ findet Dante-, NDI-, Art-Net- und MA-Geräte. Neue Funde fügst du mit „+ Einfügen“ in den Plan ein und weist danach ein Modell zu." },

  "tab-bibliothek": { anker: "tab-bibliothek", art: "klick", titel: "Deine Bibliothek", text: "Klicke auf „Bibliothek“." },
  "bib-bereiche": { anker: "bib-bereiche", vor: ["tab-bibliothek", "bib-bestand"], art: "weiter", titel: "Sechs Bereiche",
    text: "Gerätebestand (deine echten Geräte mit IPs), eigene Vorlagen, Herstellergeräte, Protokolle, eigene Felder und Icons." },
  "bib-uebernehmen": { anker: "bib-uebernehmen", vor: ["tab-bibliothek", "bib-bestand"], art: "weiter", titel: "Gerätebestand füllen",
    text: "Übernimmt alle Geräte des Projekts mit Namen und IPs in deinen Bestand. Im nächsten Projekt fügst du sie mit einem Klick wieder ein." },
  "bib-hersteller": { anker: "inhalt", vor: ["tab-bibliothek", "bib-katalog"], art: "weiter", titel: "Herstellergeräte",
    text: "Modelle der Fokus-Hersteller mit Ports, Protokollen und Web-UI. Welche Hersteller „Fokus“ sind, stellst du in den Einstellungen ein." },

  "tab-hilfe": { anker: "tab-hilfe", art: "klick", titel: "Hilfe", text: "Klicke auf „Hilfe“." },
  "hilfe-bereiche": { anker: "hilfe-bereiche", vor: ["tab-hilfe"], art: "weiter", titel: "Anleitung und Netzwerk-Wissen",
    text: "Die Anleitung erklärt jede Funktion mit Bildern, das Netzwerk-Wissen IGMP, QoS, PTP, VLANs, die Kernprotokolle und einen Netzrechner. Hier startest du auch jede Tour neu." },

  "kopf-datei": { anker: ["kopf-datei", "kopf-speichern"], art: "weiter", titel: "Speichern und Öffnen",
    text: "„Speichern“ legt eine .netplan-Datei an, die du weitergeben kannst. Im Menü „Datei“: Neu, Öffnen, zuletzt geöffnet und das Beispielprojekt." },
  "kopf-export": { anker: "kopf-export", art: "klick", titel: "Exportieren", text: "Klicke auf „Export“." },
  "export-dialog": { anker: "export", vor: ["kopf-export"], art: "weiter", titel: "Export-Formate",
    text: "PDF-Dokumentation, Excel, CSV oder die Topologie als SVG und PNG. Beim PDF wählst du Ansicht, Blattgröße und welche Kapitel hinein sollen." },
  einstellungen: { anker: "einstellungen", vor: ["kopf-einstellungen"], art: "weiter", titel: "Einstellungen",
    text: "Hell, dunkel oder wie das System, dein Logo, Fokus-Hersteller und die Standard-Anzeige der Topologie. Schneller geht es über das Menü „Einstellungen“." },
  sitzung: { anker: "sitzung", vor: ["kopf-sitzung"], art: "weiter", titel: "Gemeinsam arbeiten",
    text: "Über den Planer-Server plant ihr zu mehreren gleichzeitig am selben Projekt. Server-Adresse eingeben, Sitzung starten oder beitreten." },
  ende: { anker: "tab-hilfe", art: "weiter", titel: "Fertig!", knopf: "Tour beenden",
    text: "Gleich ist dein eigenes Projekt wieder da. Alle Touren und die ausführliche Anleitung findest du jederzeit unter „Hilfe“." },
};

export const TOUREN = [
  { id: "schnell", titel: "Schnellstart", dauer: "3 min", text: "Das Wichtigste in 17 Schritten",
    schritte: ["start", "kopf", "tabs", "projekt-angaben", "vlan-liste", "tab-topologie", "topo-palette", "topo-katalog", "topo-werkzeuge", "topo-editor", "topo-ansichten", "topo-anschluesse", "topo-meldungen", "geraete-ansicht", "kopf-export", "export-dialog", "ende"] },
  { id: "projekt", titel: "Projekt und VLANs", dauer: "1 min", schritte: ["tab-projekt", "projekt-angaben", "projekt-uebersicht", "projekt-standorte", "tab-vlans", "vlan-liste"] },
  { id: "topologie", titel: "Topologie", dauer: "4 min", schritte: ["tab-topologie", "topo-palette", "topo-katalog", "topo-picker", "topo-werkzeuge", "topo-editor", "topo-kontext", "topo-ansichten", "topo-anschluesse", "topo-druckplan", "topo-darstellung", "topo-filter", "topo-meldungen", "topo-status"] },
  { id: "geraete", titel: "Geräte und Patchliste", dauer: "1 min", schritte: ["tab-geraete", "geraete-tabelle", "geraete-ips", "geraete-ansicht"] },
  { id: "live", titel: "Live", dauer: "1 min", text: "Nur in der Desktop-App", schritte: ["tab-live", "live-karte", "live-ansichten", "live-discovery"] },
  { id: "bibliothek", titel: "Bibliothek", dauer: "1 min", schritte: ["tab-bibliothek", "bib-bereiche", "bib-uebernehmen", "bib-hersteller"] },
  { id: "datei", titel: "Speichern, Export und Einstellungen", dauer: "2 min", schritte: ["kopf-datei", "kopf-export", "export-dialog", "einstellungen", "sitzung", "tab-hilfe", "hilfe-bereiche"] },
];

export const tourSchritte = (id) => (TOUREN.find((t) => t.id === id)?.schritte || []).map((s) => ({ id: s, ...SCHRITTE[s] }));
export const TOUR_ERLEDIGT_KEY = "netzwerkplaner_touren";
export const TOUR_SICHERUNG_KEY = "netzwerkplaner_tour_sicherung";
