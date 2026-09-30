# ⌬ Netzwerkplaner

Offline-Planungswerkzeug für Netzwerke in der Veranstaltungstechnik (Ton, Licht, Video, Intercom, Steuerung). Die Topologie wird als **Mindmap** gezeichnet: Core-Switch in der Mitte, Switches und Endgeräte als Äste. VLANs, IP-Adressen und Prüfungen liegen in einer Projektdatei. Design und Aufbau orientieren sich am [Stromplaner](https://github.com/MrPancaketwtch/Stromplaner).

Electron-Desktop-App für **macOS und Windows**, läuft komplett ohne Server und ohne Internet.

> **Beta.** Download der aktuellen Version unter [Releases](https://github.com/Nomisimo/Netzwerkplaner/releases): Windows (x64), macOS Apple Silicon und macOS Intel. Die Installer sind nicht signiert; Hinweise zum ersten Start stehen im Release.

## Funktionen

| Tab | Inhalt |
|---|---|
| **Projekt** | Veranstaltung, Ort, Version, Standorte/Äste, Übersicht, Beispielprojekt |
| **Topologie** | Zwei Ansichten: Mindmap und Frontplatten (Stil Luminex Araneo, Ports in VLAN-Farbe, Geräte als Karten am Port). Auto-Layout, Geräte per Drag & Drop, Werkzeug „Verbinden“, Äste ein-/ausklappen, Verschieben mit Ast, Farbe nach VLAN/Bereich/Kabel, Linien rund oder eckig, Titel nach Name/Netzwerkname/Typ/Inventar, Filter & Suche, Web-UI-Links, Erreichbarkeits-Status |
| **Geräte** | Liste mit Filter, Editor für Interfaces (IP/Maske/VLAN/Gateway/MAC/DHCP), physische Ports (Access/Trunk, PoE, Punkt-zu-Punkt), Web-UI, Protokolle, Notizen, eigene Icons, „Modell zuweisen“ für generische Geräte |
| **VLANs** | ID, Name, Farbe, Zweck, Notiz; Schalter IGMP-Snooping, EEE aus, QoS, DHCP |
| **Live** | Werkzeuge fürs laufende Netz, je Protokoll ein Untertab: Online-Status aller Geräte, Netzwerkscan mit Soll/Ist-Abgleich gegen den Plan, Switches per SNMP (Link, VLAN je Port, PoE, LLDP-Nachbarn, Abweichungen zum Plan), sACN-Monitor (Quellen, Priorität, fps, Kanalwerte, Universe Discovery), Art-Net (ArtPoll-Nodes, Universen, Kanalwerte), Dante und NDI (Geräte per mDNS), MA-Net (Verkehr je Sender), OSC-Protokoll, CITP-Teilnehmer, PTP-Clock (Master, Domain, Konflikte) |
| **Wissen** | IGMP, QoS/DSCP, Bandbreite, Latenz, PTP, EEE, STP, VLANs, Adressen, Redundanz, Switch-Einstellungen je Hersteller, Protokoll-Poster (OSI-Modell & Ports), mDNS-Dienste, Infrastruktur-Protokolle, Wikipedia-Links; Seiten zu Dante, MA-Net 1–3, Art-Net, sACN, NDI, OSC, CITP |
| **Prüfung** | IP-Konflikte, VLAN-Mismatch an Switch-Ports, Trunks, Punkt-zu-Punkt-Protokolle (AES50, SLink, HDBaseT …) am Switch, Multicast ohne IGMP, EEE bei Audio over IP, PoE-Budget, doppelte Ports, Leitungslast und Dante-Hops aus den Datenströmen, MA-Net Gold-Standards |
| **Katalog** | Gerätebestand (eigene Geräte mit IPs, direkt einfügbar, neu anlegen, CSV-Import/-Export), eigene Vorlagen, Herstellergeräte, Protokollreferenz (Ports, Multicast, Anforderungen, Datenstand), Icons |
| **Anleitung** | Ein Kapitel je Tab mit Screenshots, Analyse-Werkzeuge (Wireshark-Filter, Cisco-Befehle) |

**Exporte:** PDF-Dokumentation (A4 quer), Excel (IP-Liste, VLANs, Verbindungen, Switch-Ports, Geräte, Prüfung), CSV-IP-Liste, Topologie als SVG/PNG.
**Dateien:** Projekte als `.netplan` (JSON, Doppelklick öffnet die App), Autospeichern, „zuletzt geöffnet“, Katalog (Bestand, eigene Vorlagen, Icons) im App-Datenordner. Eigenes Logo für Kopf und PDF.
**Updates:** Windows lädt neue Versionen im Hintergrund (electron-updater), macOS zeigt einen Hinweis mit Link zur Download-Seite.
**Private Daten:** Echte Gerätelisten gehören in den Ordner `lokal/` (per `.gitignore` gesperrt) und nie ins Repository.
**Erreichbarkeit:** TCP-Prüfung auf den Web-UI-Port, sonst ICMP-Ping aus dem Hauptprozess; einmalig oder alle 15 s.

## Entwicklung

```bash
npm install
npm start          # Oberfläche bauen und Electron starten
npm test           # Unit-Tests (IP-Rechnung, Katalog, Prüfregeln, Layout)
npm run dist:mac   # .dmg (arm64 + x64)
npm run dist:win   # .exe-Installer (NSIS, x64)
```

Die Oberfläche (React 18) wird mit esbuild zu einer einzelnen Datei `dist-app/index.html` gebündelt, wie beim Stromplaner.

## Versionen & Release

- Die Versionsnummer steht in `package.json` (SemVer, Betas als `0.x.y-beta.n`) und wird in der App oben links angezeigt.
- Änderungen je Version: `src/shared/version.js` (erscheint in der App unter „Was ist neu?“) und [CHANGELOG.md](CHANGELOG.md).
- Die App fragt beim Start die GitHub-Releases ab und zeigt einen Hinweis, wenn es eine neuere Version gibt.
- **Release bauen:** Version in `package.json`, `version.js` und `CHANGELOG.md` erhöhen, committen, dann `git tag v0.2.0-beta.2 && git push origin v0.2.0-beta.2`. Die GitHub Action [Release](.github/workflows/release.yml) baut Windows x64, macOS arm64 und macOS x64 und veröffentlicht sie; Tags mit Bindestrich werden als Vorabversion markiert.

## Ordnerstruktur

```
src/main/        Electron-Hauptprozess (Fenster, Dateien, PDF, Ping/TCP), Splash
src/main/monitor/  Live-Monitore (sACN, Art-Net, CITP, OSC, MA-Net, PTP, mDNS, Scan, SNMP), reines Node
src/preload/     IPC-Brücke (contextBridge)
src/renderer/    React-Oberfläche: App, Tabs, Geräte-/Verbindungs-Editor, Exporte
src/shared/      Logik ohne UI: IP-Rechnung, Datenmodell, Prüfregeln, Mindmap-Layout, Katalog
src/shared/data/katalog.json   Hardwarekatalog + Protokollrecherche (generiert)
assets/icons/devices/          Geräte-Icons (SVG, 24×24, currentColor)
assets/app-icon/               App-Icon
scripts/         build.js, test.js, import-data.js
test/            Unit-Tests (node:test)
docs/            Datenmodell und Datenquellen
```

## Daten aktualisieren

Katalog und Protokolle stammen aus dem Projektordner (`hardware/geraete.json`, `recherche/netzwerkprotokolle_veranstaltungstechnik.xlsx`). Nach Änderungen dort:

```bash
npm run import-data -- /pfad/zum/projektordner
```

Die Prüfregeln (Multicast → IGMP, Punkt-zu-Punkt, nur L2 …) werden aus den Spalten der Protokolltabelle abgeleitet und wachsen damit automatisch mit.

> Hinweis: Viele Katalog- und Protokollwerte stammen aus Fachwissen und sind nicht datenblattgeprüft (Spalte „Datenstand“ bzw. „Hinweis“). Vor dem Einsatz gegen die Herstellerdoku prüfen.
