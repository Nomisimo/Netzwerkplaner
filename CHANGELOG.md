# Änderungen

Versionsnummern nach [SemVer](https://semver.org/lang/de/). Betas tragen den Zusatz `-beta.N`.
Die Liste wird auch in der App unter „Was ist neu?“ angezeigt (Quelle: `src/shared/version.js`).

## [0.3.0-beta.1] – 2026-09-29

- Neue Topologie-Ansicht „Frontplatten“ im Stil von Luminex Araneo: Switches als Frontplatte mit ihrer echten Portzahl und Bauform (RJ45, SFP, etherCON)
- Ports in der Farbe ihres VLANs, Trunks mehrfarbig gestreift, freie Ports abgedunkelt, Link-LED und PoE-Kennzeichen am Port
- Endgeräte als Karten mit Port-Lasche direkt über oder unter ihrem Switch-Port, Rahmen in VLAN-Farbe
- Port anklicken öffnet die Verbindung; Switch ziehen verschiebt die ganze Gruppe; Umschalter Mindmap / Frontplatten in der Werkzeugleiste
- Export als SVG/PNG/PDF übernimmt die gewählte Ansicht

## [0.2.0-beta.1] – 2026-09-29

- Erste Beta. Versionsnummer in der Kopfzeile, Hinweis beim Start, wenn eine neuere Version auf GitHub liegt
- Kernprotokolle Dante, MA-Net 1–3, Art-Net, sACN, NDI, OSC und CITP mit Bandbreitenmodellen und Anforderungen
- Datenströme je Gerät; Analyse-Tab mit Leitungslast, Multicast je VLAN, Dante-Hops, Bandbreiten- und Laufzeitrechner, Analyse-Werkzeugen
- Wissen-Tab: IGMP, QoS/DSCP, Bandbreite, Latenz, PTP, EEE, STP, VLANs, Adressen, Redundanz, Switch-Einstellungen je Hersteller
- Fokus-Katalog: MA, Luminex, Cisco, Yamaha, Schnick-Schnack-Systems, Dante (201 recherchierte Modelle)
- Gerätebestand: eigene Geräte mit Name, IPs, MACs und Inventardaten speichern und direkt einfügen
- Netzwerkname, Inventar-Nr., Seriennummer und Case je Gerät
- Topologie zeigt Switch-Port und VLAN an jeder Leitung; Rechtsklick auf ein Gerät öffnet eine Infokarte
- Akzentfarbe mattes Rot

## [0.1.0] – 2026-09-29

- Erste Version: Topologie als Mindmap mit Drag & Drop, Verbinden-Werkzeug, Ein-/Ausklappen und Auto-Layout
- Geräte aus dem Hardwarekatalog (Ports, Protokolle, Web-UI vorbelegt) und generische Typen mit eigenen Icons
- VLANs, IP-Plan mit Konfliktprüfung und Vorschlag der nächsten freien Adresse
- Patchliste, Switch-Port-Konfiguration (Access/Trunk, PoE), Prüfung nach den Regeln der Protokollrecherche
- Web-UI-Links und Erreichbarkeit per TCP/Ping, Exporte als PDF, Excel, CSV, SVG und PNG
