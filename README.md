# ⌬ Netzwerkplaner

Offline-Planungswerkzeug für Netzwerke in der Veranstaltungstechnik (Ton, Licht, Video, Intercom, Steuerung). Die Topologie wird als **Mindmap** gezeichnet: Core-Switch in der Mitte, Switches und Endgeräte als Äste. VLANs, IP-Plan, Patchliste und Prüfungen liegen in einer Projektdatei. Design und Aufbau orientieren sich am [Stromplaner](https://github.com/MrPancaketwtch/Stromplaner).

Electron-Desktop-App für **macOS und Windows**, läuft komplett ohne Server und ohne Internet.

> **Beta.** Download der aktuellen Version unter [Releases](https://github.com/Nomisimo/Netzwerkplaner/releases): Windows (x64), macOS Apple Silicon und macOS Intel. Die Installer sind nicht signiert; Hinweise zum ersten Start stehen im Release.

## Funktionen

| Tab | Inhalt |
|---|---|
| **Projekt** | Veranstaltung, Ort, Version, Standorte/Äste, Übersicht, Beispielprojekt |
| **Topologie** | Zwei Ansichten: Mindmap und Frontplatten (Stil Luminex Araneo, Ports in VLAN-Farbe, Geräte als Karten am Port). Auto-Layout, Geräte per Drag & Drop, Werkzeug „Verbinden“, Äste ein-/ausklappen, Verschieben mit Ast, Farbe nach VLAN/Bereich/Kabel, Filter & Suche, Web-UI-Links, Erreichbarkeits-Status |
| **Geräte** | Liste mit Filter, Editor für Interfaces (IP/Maske/VLAN/Gateway/MAC/DHCP), physische Ports (Access/Trunk, PoE, Punkt-zu-Punkt), Web-UI, Protokolle, Notizen, eigene Icons |
| **VLANs & IP-Plan** | VLANs mit Subnetz, Gateway, IGMP-Querier, EEE, QoS, DHCP-Bereich; IP-Raster je VLAN mit Konflikten und nächster freier Adresse |
| **Patchliste** | Nach Switch oder als Gesamtliste, Kabeltyp, Länge, Label, Kabelsummen |
| **Analyse** | Datenströme je Gerät → Leitungslast je Verbindung, Multicast/Broadcast je VLAN, Dante-Hops mit Latenz-Empfehlung, Bandbreiten- und Laufzeitrechner, Analyse-Werkzeuge (Wireshark-Filter, Switch-Befehle) |
| **Wissen** | IGMP, QoS/DSCP, Bandbreite, Latenz, PTP, EEE, STP, VLANs, Adressen, Redundanz, Switch-Einstellungen je Hersteller; Seiten zu Dante, MA-Net 1–3, Art-Net, sACN, NDI, OSC, CITP |
| **Prüfung** | IP-Konflikte, Adressen außerhalb des Subnetzes, VLAN-Mismatch an Switch-Ports, Trunks, Punkt-zu-Punkt-Protokolle (AES50, SLink, HDBaseT …) am Switch, Multicast ohne IGMP, EEE bei Audio over IP, PoE-Budget, doppelte Ports |
| **Bibliothek** | Gerätebestand (eigene Geräte mit IPs, direkt einfügbar), Protokollreferenz (Ports, Multicast, Anforderungen, Datenstand), Gerätekatalog, eigene Vorlagen, mDNS/QoS/Infrastruktur, Icons |

**Exporte:** PDF-Dokumentation (A4 quer), Excel (IP-Liste, VLANs, Patchliste, Switch-Ports, Geräte, Prüfung), CSV-IP-Liste, Topologie als SVG/PNG.
**Dateien:** Projekte als `.netplan` (JSON, Doppelklick öffnet die App), Autospeichern, „zuletzt geöffnet“, Bibliothek (eigene Vorlagen + Icons) im App-Datenordner.
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
