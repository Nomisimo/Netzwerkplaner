# Änderungen

Versionsnummern nach [SemVer](https://semver.org/lang/de/). Betas tragen den Zusatz `-beta.N`.
Die Liste wird auch in der App unter „Was ist neu?“ angezeigt (Quelle: `src/shared/version.js`).

## [0.6.0-beta.11] – 2026-09-30

- Beim Start spielt die App während der Splash-Animation einen kurzen Sound

## [0.6.0-beta.10] – 2026-09-30

- Geräte-Icons nach Modell: 75 eigene Icons für MA, Luminex, Cisco, Yamaha, SSS und Dante. Katalog-Geräte bekommen ihr Icon automatisch, die MA-Pult-Generationen sind an den Bildschirmen zu unterscheiden
- Icon-Auswahl nach Hersteller gruppiert, die Maus auf einem Icon zeigt den Modellnamen
- Katalog: 34 Einträge gegen Datenblätter geprüft und korrigiert, u. a. grandMA3 xPort Node (nur 1 Netzwerkport), Yamaha RUio16-D (2× etherCON Dante statt 1× RJ45), PC-D und DME7 (NETWORK-Port fehlte), Netgear M4250-10G2XF (12 statt 10 Ports), PoE-Budgets für Cisco, Yamaha, Netgear und UniFi. Catalyst 9300 und GigaCore 30i rechnen jetzt mit dem Budget eines Netzteils statt dem Maximum mit zwei
- Switches aus dem Katalog bringen ihr PoE-Budget mit, die Prüfung meldet damit ein überschrittenes Budget ohne Handarbeit. Bisher stand das Budget immer auf 0 (keine Prüfung)

## [0.6.0-beta.9] – 2026-09-30

- Verbindungen: Ein Gerät bekommt nur so viele Kabel, wie es Anschlüsse hat. Bisher legte die App beim Verbinden einfach neue Ports an
- Sind alle Anschlüsse belegt, fragt die App, welcher ersetzt werden soll. Im Verbindungs-Editor gibt es vor dem Wechsel auf einen belegten Port eine Rückfrage
- Stapel lassen sich als Ganzes anpinnen: „📌 Anpinnen“ im Stapel-Fenster, Taste P bei ausgewähltem Stapel oder Rechtsklick auf ein Gerät im Stapel
- Stapeln: Ein Gerät, das auf einen bestehenden Stapel (Gerät, Rahmen oder Name) gezogen wird, kommt oben in diesen Stapel. Bisher wurden die Geräte herausgelöst und ein neuer Stapel angelegt
- Topologie: Hängt ein Gerät mit mehreren Kabeln am Netz, stehen alle belegten Ports mit VLAN untereinander am Gerät, auch bei gebündelten Kabeln. Bisher lagen zusätzliche Plaketten am Switch übereinander

## [0.6.0-beta.8] – 2026-09-30

- Katalog: Beim Anlegen eines Geräts oder einer Vorlage direkt ein neues VLAN anlegen und allen Ports oder einem Interface zuweisen
- Vorlagen und Bestand merken sich ihre VLANs. Fehlt eine VLAN-ID beim Einfügen in ein Projekt, wird das VLAN dort angelegt (gilt auch für kopierte Stapel)

## [0.6.0-beta.7] – 2026-09-30

- VLAN-Liste: die VLAN-ID steht zugeklappt als gut lesbares Kästchen, auch bei dunklen VLAN-Farben
- VLAN-Liste: ⚠ zeigt die Anzahl der Meldungen, die Maus darauf nennt den Grund. Die Regeln stehen oben im VLAN-Tab
- Neue VLANs bekommen helle Farben statt Zufallsfarben

## [0.6.0-beta.6] – 2026-09-30

- Stapel bearbeiten: Klick auf einen Stapel öffnet ein eigenes Fenster mit Name, Reihenfolge, Geräte hinzufügen oder lösen
- Stapel duplizieren und kopieren/einfügen, samt Verbindungen innerhalb des Stapels, auch in ein anderes Projekt
- Gerätekonfiguration kopieren und einfügen: im Dialog wählen, welche Daten (Ports, Interfaces, Protokolle, Datenströme, Web-UI, PoE, Bereich, Notizen), dann in ein oder mehrere Geräte einfügen (z. B. alle gleichen Modells)
- Kabel einzeln nebeneinander auf eigener Spur oder gebündelt (nur bei eckigen Linien), per Schalter „Kabel bündeln“
- macOS-Update: „⬆ … laden und öffnen“ lädt das passende DMG und öffnet es, danach die App nach „Programme“ ziehen
- Katalog: RME Digiface Dante, Digiface Ravenna und Digiface AVB
- Anleitung: Hinweis zu privaten Listen entfernt

## [0.6.0-beta.5] – 2026-09-30

- VLAN in VLAN (QinQ, IEEE 802.1ad): je VLAN ein äußeres VLAN (S-VLAN) wählbar, die VLAN-Liste zeigt die Verschachtelung
- Doppelte VLAN-IDs sind erlaubt, wenn QinQ sie trennt (verschiedene S-VLANs): Warnung mit Hinweis auf die Trennung. Gleiche IDs in derselben Ebene bleiben ein Fehler
- Prüfung: Kreis in der Verschachtelung, fehlendes äußeres VLAN, mehr als zwei Tags und ein Trunk-Port mit zweimal derselben VLAN-ID werden gemeldet
- Export (CSV/PDF): neue Spalte „S-VLAN (QinQ)“

## [0.6.0-beta.4] – 2026-09-30

- macOS Intel: Das DMG wird jetzt auf einem Intel-Mac als HFS+-Image gebaut. Das bisherige APFS-Image meldete auf manchen Macs „Das Image ist beschädigt“

## [0.6.0-beta.3] – 2026-09-30

- Update-Dialog (Windows): „⬆ … automatisch installieren“ lädt das Update, beendet die App, installiert und startet neu
- macOS: weiter über „⬇ herunterladen“ (Download-Seite), bis die Mac-Builds eine Apple-Signatur haben

## [0.6.0-beta.2] – 2026-09-30

- Topologie: Geräte anpinnen (Taste P, Rechtsklick oder Klick auf die Nadel). Angepinnte Geräte bleiben beim automatischen Anordnen stehen
- „Auto-Anordnen“ lässt sich ausschalten: dann bleiben alle Geräte und Leitungen an ihrem Platz, auch ungepinnte
- Neues Werkzeug „▤ Stapeln“ (Taste S): Geräte grafisch als Rack oder Tower übereinander darstellen, ohne Netzwerkverbindung
- Hintergrundbild für die Topologie, z. B. ein Stage-Plot, um Geräte in der Location zu verorten; kommt mit in den Export
- Verbindungen lassen sich am Mittelpunkt verschieben, um Leitungen aufzuräumen (Doppelklick setzt zurück)
- Tastenkürzel: M = Bewegen, C = Verbinden, S = Stapeln, P = Anpinnen
- VLANs: Der Button „+ Standard-VLANs“ ist entfernt

## [0.6.0-beta.1] – 2026-09-30

- Katalog: Cisco Catalyst 1300 C1300-24P-4X (24× 1 GbE PoE+, 195 W, 4× SFP+ 10G, Web-UI)
- Topologie: Shift + Mausrad scrollt hoch und runter, ⌘/Strg + Mausrad nach links und rechts
- Neu im Live-Tab: Discovery findet Geräte im Netz (Dante, NDI, Art-Net, sACN, CITP, MA-Net, dazu der Netzwerkscan) und fügt neue als generische Einträge mit IP, MAC und Name ein
- Generische Geräte zeigen eine leere Maske mit nur zwei Wegen: „⇄ Modell zuweisen“ oder „＋ Leeres Gerät anlegen“ mit Typauswahl; IP, MAC, Protokolle und Verbindungen bleiben
- Netzwerkscan: „+ In den Plan“ legt ebenfalls ein generisches Gerät an

## [0.5.0-beta.2] – 2026-09-30

- macOS: Das Intel-DMG war beschädigt und ließ sich nicht öffnen (Fehler 3840). Jeder Mac-Build erzeugt jetzt nur noch sein DMG, und der Release prüft es vor dem Hochladen
- „⇄ Modell zuweisen“ mit einem Gerät aus dem eigenen Gerätebestand übernimmt dessen feste IPs, Namen, Netzwerknamen und Inventar genau wie beim Einfügen; die Verbindungen bleiben

## [0.5.0-beta.1] – 2026-09-30

- Bibliothek heißt jetzt einheitlich „Katalog“; Geräte lassen sich direkt im Katalog anlegen (Bestand und eigene Vorlagen)
- Gerätebestand als CSV exportieren und importieren, z. B. aus einer anderen Installation oder einer eigenen Excel-Liste
- „⇄ Modell zuweisen“: ein generisches Gerät nachträglich zu einem Katalogmodell machen, IPs, VLANs und Verbindungen bleiben erhalten
- Topologie: Linien rund oder eckig, Titel wahlweise Gerätename, Netzwerkname, Typ/Modell oder Inventar-Nr.; ohne Netzwerkname erscheint der Typ
- MA-Net Gold-Standards in der Prüfung: 1 GbE, eigenes VLAN, keine 100-Mbit-Geräte, IGMP, EEE aus, kurze Switch-Ketten, kein 192.168.33.x, Generationen trennen
- VLANs vereinfacht: nur noch ID, Name, Farbe, Zweck, Notiz und die Schalter IGMP, EEE aus, QoS und DHCP
- Wissen: Protokoll-Poster „OSI-Modell & Ports“, mDNS-Dienste und Infrastruktur-Protokolle (aus dem Katalog verschoben), Wikipedia-Links
- Anleitung neu: ein Kapitel je Tab mit Screenshots, dazu die Analyse-Werkzeuge (Wireshark-Filter, Cisco-Befehle)
- Updates wie im Stromplaner: Windows lädt neue Versionen im Hintergrund und installiert nach Neustart, macOS öffnet die Download-Seite
- Eigenes Logo neben dem App-Namen, auch in den PDF-Exporten; App-Icon oben links
- Entfernt: Patchliste, Analyse-Tab (Rechner und Prüfungen laufen in der Prüfung weiter), Kabellängen, IP-Plan

## [0.4.0-beta.1] – 2026-09-29

- Neuer Tab „Live“: Online-Status aller Geräte, Netzwerkscan mit Abgleich gegen den Plan (fehlt, nicht im Plan, MAC weicht ab)
- Switches per SNMP: Live-VLAN je Port im Vergleich zum geplanten
- Protokoll-Monitore für sACN, Art-Net, Dante, MA-Net, NDI, OSC, CITP und PTP-Clock; gefundene IPs zeigen den Gerätenamen aus dem Plan
- Die Monitore hören nur mit; gesendet werden nur ArtPoll (per Knopf), mDNS-Abfragen, Scan und SNMP

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
