# Änderungen

Versionsnummern nach [SemVer](https://semver.org/lang/de/). Betas tragen den Zusatz `-beta.N`.
Die Liste wird auch in der App unter „Was ist neu?“ angezeigt (Quelle: `src/shared/version.js`).

## [0.7.0-beta.16] – 2026-10-05

- Clean Cat sortiert jetzt nach Standort und darin nach Stacks: jeder Stack (Rack, Case) ist ein eigener Kasten mit seinem Namen im Standort-Raum, die Geräte ohne Stack stehen daneben

## [0.7.0-beta.15] – 2026-10-05

- Gerätebestand-CSV: Switches exportieren ihr Management-VLAN wieder (Spalten VLAN1–VLAN3). Bei Endgeräten bleiben die Spalten leer, deren VLAN kommt weiter vom Switch-Port

## [0.7.0-beta.14] – 2026-10-05

- Clean Cat ist jetzt eine Ansicht im Topologie-Tab (neben Mindmap und Anschlüsse) statt eines eigenen Tabs
- Clean Cat ist immer ein A3-Blatt quer mit Rahmen. Die Räume liegen in mehreren Reihen, damit das Blatt gut gefüllt ist; Verbindungen zwischen Reihen laufen links am Blatt entlang
- Plankopf aus den Projektdaten: Veranstaltung, Ort, Ersteller, Planinhalt, Planversion, Projektdatum, Exportdatum und dein Logo
- Legende mit allen Leitungs- und Gerätefarben, die im Plan vorkommen
- Gleiche Geräte sind immer gleich groß: alle Endgeräte gleich breit, Switches nach Portzahl. Zu lange Texte werden kleiner geschrieben oder gekürzt und bleiben immer im Feld
- Neuer Export „PDF A3“ für Clean Cat

## [0.7.0-beta.13] – 2026-10-05

- Netzrechner: „Aufteilen in“ bietet jetzt jede Zielgröße bis /32 an, auch große Netze wie /8 oder /16 in /24-Netze. Vorher ging die Auswahl nur 10 Stufen unter das Ausgangsnetz. Die Liste zeigt die ersten 256 Teilnetze, „Weitere anzeigen“ lädt mehr nach

## [0.7.0-beta.12] – 2026-10-05

- Neuer Tab „Clean Cat“: der Plan als aufgeräumte Zeichnung auf weißem Grund. Standorte sind Räume, Geräte farbige Blöcke, die Leitungen laufen rechtwinklig. Dante Primary ist rot, Secondary grün, Glasfaser lila, Switch zu Switch grau. Wahlweise nach VLAN färben, IPs ein- oder ausblenden, Export als SVG und PNG
- Helles Design: Über das Zahnrad oben rechts stellst du das Erscheinungsbild auf „Wie das System“ (Standard), „Hell“ oder „Dunkel“
- Wissen: Schaubilder zu VLAN-Trunks, IGMP-Snooping, QoS-Warteschlangen, PTP, Spanning Tree, Dante-Redundanz, IPv4-Aufbau und Teilnetzen
- Gerätebestand: Hinweistext passt jetzt zu „VLAN kommt vom Switch-Port“

## [0.7.0-beta.11] – 2026-10-05

- Wissen: neuer Eintrag „IP-Adressen & Netzrechner“. Der Netzrechner nimmt IPv4 oder IPv6 mit Präfix oder Maske und zeigt Netz, Maske, Wildcard, Broadcast, erste und letzte Host-Adresse, Anzahl Hosts, Klasse, Art der Adresse (privat, öffentlich, link-local, Multicast …) und die Binärdarstellung. „Aufteilen in“ zerlegt ein Netz in Teilnetze. Bei IPv6 kommen Kurz- und Langform, Interface-ID, MAC aus EUI-64 und ein MAC→Link-Local-Rechner dazu. Klick auf einen Wert kopiert ihn
- Wissen: IPv4 und IPv6 erklärt, mit Adressklassen A–E, privaten Bereichen (RFC 1918), Link-Local/APIPA, Loopback, Multicast, CGNAT, Masken-Tabelle /8 bis /32 und den IPv6-Adressarten (Link-Local, ULA, Global, Multicast)
- VLANs gibt es jetzt nur noch an Switches, in der ganzen App: neue Geräte, Vorlagen, Bestandseinträge und Katalogmodelle bringen kein VLAN mehr mit. Ältere Vorlagen und Bestandseinträge mit VLAN werden ohne VLAN eingefügt und legen keine VLANs mehr an. Im Projekt übernimmt das Endgerät weiter das VLAN des Switch-Ports
- „Konfig kopieren“, „Modell zuweisen“ und der Netzwerkscan setzen bei Endgeräten kein VLAN mehr. Der Bestand-CSV-Export hat keine VLAN-Spalten mehr; beim Import gelten sie nur noch für das Management von Switches
- „Neues VLAN für diesen Switch“ erscheint beim Anlegen nur noch bei managed Switches

## [0.7.0-beta.10] – 2026-10-01

- Geräte-Editor: „+ Feld … → Neues Feld anlegen …“ und „Vorlage“ funktionieren wieder in der Desktop-App. Beide öffnen jetzt einen eigenen Eingabedialog (Enter = OK, Esc = Abbrechen)

## [0.7.0-beta.9] – 2026-10-01

- Gemeinsam arbeiten: „Verlassen“ fragt jetzt, ob nur du gehst oder die Sitzung für alle beendet wird. Beim Beenden bekommen die anderen den Hinweis, wer beendet hat, und behalten ihren Stand als veraltete Kopie
- Sitzungen, in denen seit 72 Stunden niemand war, lassen sich in der Liste mit „Beenden“ löschen, ohne beizutreten (mit Sitzungscode, falls gesetzt). Die Liste zeigt, seit wann niemand mehr online ist
- „Beitreten“ ist ausgegraut, wenn die Sitzung eine neuere App-Version nutzt oder mit einer anderen Version gerade Teilnehmer hat; der Grund steht darunter. Eine leere Sitzung mit älterer Version wird beim Beitreten nach Rückfrage auf deine Version umgestellt
- Sitzungscode wird jetzt direkt im Fenster abgefragt und vor dem Beitreten geprüft. Vorher ließ sich einer Sitzung mit Code in der App gar nicht beitreten
- Scheitert der Beitritt (falscher Code, falsche Version), bleibt dein Projekt unverändert und es erscheint kein „Sitzung beendet“ mehr. Wer selbst verlässt, bekommt ebenfalls keine Beendet-Meldung mehr
- Benötigt den aktuellen Planer-Server

## [0.7.0-beta.8] – 2026-10-01

- VLANs nur an Switches: Netzwerkkarten von Endgeräten haben kein eigenes VLAN mehr. Sie übernehmen das VLAN des Switch-Ports, an dem sie stecken (auch über unmanaged Switches hinweg). Steckt eine Karte nirgends, gilt das VLAN, in dessen Subnetz ihre IP liegt. Der Editor zeigt das VLAN mit Link zum Switch-Port. Bestehende Projekte übernehmen das bisherige Geräte-VLAN einmalig auf leere Switch-Ports
- Meldungszentrum links in der Werkzeugleiste: Fehler, Warnungen und Hinweise als Zähler, Klick listet die Meldungen mit „Zeigen“ und Link zur Prüfung
- Topologie: Äste stehen bei allen Geräten einheitlich in Port-Reihenfolge des Switches (Port 1 oben), wie in der Patchliste. In schmalen Fenstern zeigt die Werkzeugleiste Nebenknöpfe nur als Icon
- Topologie: Rahmen auf der leeren Fläche ziehen wählt mehrere Geräte (Shift = dazu). Die Ansicht verschiebt man jetzt mit Leertaste + Ziehen, der mittleren Maustaste oder Shift/⌘ + Mausrad
- Topologie: ⌘/Strg+C und ⌘/Strg+V kopieren und fügen Geräte ein, mit den Kabeln und Stapeln zwischen ihnen, ohne IP- und MAC-Adressen
- Mehrfachauswahl: Bereich, Standort, PoE-Bedarf, eigene Felder und Notizen für alle gewählten Geräte auf einmal bearbeiten
- Geräte-Editor: Der Kopf mit Icon, Name, Status und Schließen-Knopf bleibt beim Scrollen oben stehen
- Erreichbarkeit: Jede IP eines Geräts wird geprüft. Antwortet eine, gilt das Gerät als erreichbar. Der Editor zeigt an jeder Netzwerkkarte, ob sie antwortet
- Live-Tab: Eine Netzwerkkarte wird gewählt, und alles läuft nur über diese, auch Netzwerkscan, SNMP und die Online-Prüfung. Dante zeigt Modell, Dante-Version, primäre und sekundäre Adresse und Abtastrate. „Uhren“ heißt jetzt „Clocks“

## [0.7.0-beta.7] – 2026-10-01

- Neuer Tab „Patchliste“: alle Geräte mit Netzwerkname, IPs je Interface, „Gesteckt auf“ (Switch und Port), weiteren Kabeln, Abteilung, Standort, eigenen Feldern als „Name: Inhalt“ und Notizen
- Patchliste: sortiert nach Aufbau-Logik. Vom Haupt-Switch aus, Geräte eines Switches nach Portnummer, Unter-Switches mit ihren Geräten an der Stelle ihres Ports, Stapel zusammen
- Patchliste: Reihenfolge per Ziehen oder Pfeilen anpassbar, „Automatisch sortieren“ setzt sie zurück. Notizen direkt in der Tabelle bearbeitbar
- Patchliste im Export: eigenes PDF zum Ausdrucken mit linierter Spalte „Notizen vor Ort“ und Abhak-Kästchen, als CSV, als erstes Blatt im Excel und als Seite im Gesamt-PDF

## [0.7.0-beta.6] – 2026-10-01

- Anschlüsse: Switches zeigen Vorder- und Rückseite. Liegen Buchsen auf beiden Seiten (z. B. GigaCore 16Xt: 10 vorne, 2 hinten), steht links „VORNE“ und rechts „HINTEN“ auf der Platte
- Anschlüsse: Steckertypen sehen unterschiedlich aus. RJ45 eckig mit Rastnase, etherCON rund, opticalCON rund mit Glasfaser-Ring und Faserpunkten, SFP/SFP+ mit türkisem Rahmen
- Anschlüsse: Endgeräte zeigen ihre Netzwerkbuchsen als kleine Symbole auf der Karte, mit V/H für vorne/hinten. Belegte Buchsen sind hell, der Tooltip nennt alle Anschlüsse des Modells
- Grundlage ist eine Recherche in den Herstellerhandbüchern für 168 Katalogmodelle (Fokus: Luminex, MA, Yamaha, Cisco, Dante-Geräte). Im Geräte-Editor lässt sich die Seite je Port unter „Seite“ fest einstellen, „auto“ nimmt die Herstellerangabe

## [0.7.0-beta.5] – 2026-10-01

- Oberfläche: Die Werkzeugleiste der Topologie steht fest über Geräteliste, Zeichenfläche und Seitenleiste. Öffnet sich rechts der Editor, springen Knöpfe und Zeichenfläche nicht mehr um. Die Knöpfe sind in zwei feste Reihen sortiert
- Oberfläche: Eingeklappt zeigt die Geräteliste links die Typ-Icons als Miniaturen. Sie lassen sich weiter auf die Fläche ziehen oder per Doppelklick einfügen
- Oberfläche: Alle Emojis sind durch einheitliche Icons ersetzt
- Oberfläche: Die App scrollt nicht mehr als Ganzes. Scrollbalken gibt es nur noch in den Bereichen, die scrollen, z. B. Listen und Seitenleisten
- Topologie: Die Ansicht „Frontplatten“ heißt jetzt „Anschlüsse“
- Topologie: Linien lassen sich wieder direkt greifen. Im Werkzeug „Bewegen“ eine Verbindung ziehen verschiebt ihren Verlauf
- Topologie: „Auto-Layout“ und das Einschalten von „Auto-Anordnen“ fragen nach, wenn das Layout von Hand angepasst wurde
- Anschlüsse: „Kabel bündeln“ fasst alle Kabel eines Switches, die in dieselbe Richtung laufen, in einem Kanal direkt am Switch zusammen. Ohne Bündeln haben die einzelnen Bahnen doppelt so viel Abstand, in der Mindmap etwas mehr

## [0.7.0-beta.4] – 2026-09-30

- Topologie: Neuer Linienmodus „Linien: direkt“. Jede Verbindung ist die kürzeste gerade Linie von Port zu Port, in Mindmap und Frontplatten
- Frontplatten: Jedes Kabel läuft auf einer eigenen, schmalen Bahn neben den anderen, so bleiben parallele Kabel einzeln verfolgbar. Bahnen weichen Geräten aus und Kabel an derselben Karte werden nebeneinander verteilt
- Frontplatten: „Kabel bündeln“ gibt es jetzt auch hier. An: die Kabel eines Switches laufen gemeinsam in einem Kanal. Aus: jedes Kabel auf eigener Bahn
- Kabel zwischen zwei Geräten im selben Stapel werden als kurze Klammer seitlich am Stapel gezeichnet statt quer durch die Karten

## [0.7.0-beta.3] – 2026-09-30

- Gemeinsam arbeiten: Die App nutzt für den Planer-Server kein HTTP/3 (QUIC) mehr. Hinter Reverse-Proxys, die HTTP/3 anbieten, ohne dass es durchkommt, schlug die Verbindung sonst mit „ERR_QUIC_PROTOCOL_ERROR“ fehl

## [0.7.0-beta.2] – 2026-09-30

- Gemeinsam arbeiten: Die App spricht den Planer-Server jetzt über den Hauptprozess an. Damit klappt die Verbindung auch hinter Reverse-Proxys und bei Umleitungen von http:// auf https://
- Ein Servername ohne http:// und ohne Port (z. B. planer.example.de) wird zuerst auf Port 3001, dann per https:// und http:// probiert. IP:Port (z. B. 192.168.178.10:3002) geht weiterhin direkt
- Ist der Server nicht erreichbar, nennt die Meldung jetzt den genauen Grund und die verwendete Adresse statt nur „Failed to fetch“

## [0.7.0-beta.1] – 2026-09-30

- Gemeinsam arbeiten: Über den neuen Knopf „👥 Sitzung“ oben verbindet sich die App mit einem Planer-Server (Docker, eigenes Repo Planer-Server). Mehrere Personen bearbeiten denselben Plan gleichzeitig, Änderungen erscheinen sofort bei allen
- Sitzung anlegen aus dem aktuellen Projekt (optional mit Sitzungscode) oder einer laufenden Sitzung beitreten. Server als IP (Port 3001) oder als volle Adresse mit http:// bzw. https:// eintragen, dazu optional das Server-Token
- Schreibt jemand in ein Feld, ist es für die anderen gesperrt und es erscheint ein Hinweis, wer es gerade bearbeitet. Ansicht (eingeklappte Äste, Mindmap/Frontplatte, Einrasten) bleibt pro Person
- Rückgängig und Wiederholen betreffen nur die eigenen Änderungen. Das Sitzungsfenster zeigt, wer online ist, und den Verlauf aller Teilnehmer. Endet eine Sitzung, behält jeder seinen Stand als veraltete Kopie zum Speichern
- Gerätebestand: Dasselbe Bestandsgerät (gleiche Inventarnummer, Seriennummer oder MAC) bekommt auf jedem Rechner dieselbe ID und wird in einer Sitzung als dasselbe Gerät erkannt. Die Prüfung warnt, wenn ein Bestandsgerät doppelt im Plan steht
- Alle Teilnehmer brauchen dieselbe App-Version wie die Sitzung

## [0.6.0-beta.21] – 2026-09-30

- Topologie: Mehrfachauswahl. Shift+Klick (oder ⌘/Strg+Klick) nimmt Geräte dazu oder heraus, Shift+Fläche ziehen zieht einen Auswahlrahmen, ⌘/Strg+A wählt alle
- Ziehen an einem gewählten Gerät verschiebt alle zusammen. Die Seitenleiste zeigt die Auswahl mit „📌 Alle anpinnen“ (Taste P), „▤ Als Stapel“, „📋 Konfig einfügen“ und „🗑 Alle löschen“ (Entf)
- Geräte aus dem Katalog und aus dem Gerätebestand haben feste Hardware (🔒): Gerätetyp, Hersteller, Modell, Ports, Buchsen, P2P und PoE-Werte sind im Editor gesperrt. VLAN, IP, Modus, Trunk, PoE je Port, Web-UI, Protokolle und Verbindungen bleiben einstellbar. Auch „Konfig einfügen“ ändert diese Werte dort nicht mehr
- Katalog: Yamaha RSio64-D (I/O-Rack, 4 MY-Slots, 2× etherCON Dante Pri/Sec) ergänzt

## [0.6.0-beta.20] – 2026-09-30

- Topologie: Neuer Schalter „Einrasten“ (standardmäßig an). Beim Ziehen rastet ein Gerät im Raster ein und richtet sich an Kanten und Mitten benachbarter Geräte aus, eine gestrichelte Hilfslinie zeigt die Ausrichtung. So entsteht ein gleichmäßiges Layout ohne Pixelschieben
- Alt gedrückt halten schaltet das Einrasten beim Ziehen kurz aus. Die Einstellung wird mit dem Projekt gespeichert

## [0.6.0-beta.19] – 2026-09-30

- Live › Scan: Mit „✕ Leeren“ lässt sich das letzte Scan-Ergebnis verwerfen. Das Subnetz bleibt eingetragen, ein neuer Scan startet mit leerer Liste

## [0.6.0-beta.17] – 2026-09-30

- Ports und Interfaces sind zusammengeführt: Jeder Port trägt direkt VLAN, IP, Maske, Gateway, MAC und DHCP. Die getrennte Interface-Liste und die Zuordnung Port → Interface entfallen
- Switches haben ihre Management-IP als Anschluss „Management“ ohne Buchse. Er erscheint nicht auf der Frontplatte und lässt sich nicht verkabeln
- Ältere Projektdateien, Vorlagen, Bestand und kopierte Konfigurationen werden beim Öffnen umgestellt, ohne Daten zu verlieren. Teilten sich mehrere Ports ein Interface, bekommt der erste Port IP und MAC, die übrigen VLAN, Maske und Gateway
- „⟳ IPs vergeben“ vergibt je Gerät eine Adresse pro VLAN, damit z. B. der zweite Port eines Daisy-Chain-Geräts keine eigene IP bekommt

## [0.6.0-beta.16] – 2026-09-30

- Katalog: 15 weitere Einträge gegen Datenblätter geprüft (49 insgesamt). Korrigiert u. a.: grandMA2 onPC command wing hat kein Ethernet (nur USB), ETC Eos Apex hat 4× etherCON und 2× SFP+ statt 3× RJ45, Yamaha XMV-D ohne separaten NETWORK-Port, MikroTik hEX nur mit passivem PoE-in (kein 802.3af)
- Yamaha YDIF-Buchsen (MTX, MRX) werden als Punkt-zu-Punkt erkannt; die Prüfung warnt, wenn sie an einem Switch stecken

## [0.6.0-beta.14] – 2026-09-30

- Eigene Felder: Im Katalog unter „Eigene Felder“ beliebige Gerätefelder anlegen (z. B. Inventar-Nr., Seriennummer, Case, Eigentümer), im Geräte-Editor mit „+ Feld …“ einfügen und ausfüllen
- Die festen Felder Inventar-Nr., Seriennummer und Case sind entfernt. Vorhandene Werte aus älteren Projekten und aus dem Gerätebestand werden beim Öffnen in gleichnamige eigene Felder übernommen
- Eigene Felder stehen in Geräteliste (Excel/PDF), Bestands-CSV, Suche, Tooltip und Rechtsklick-Menü und lassen sich in der Topologie als Titel anzeigen. Unbekannte CSV-Spalten werden beim Import zu eigenen Feldern

## [0.6.0-beta.13] – 2026-09-30

- Neue Geräte bekommen kein VLAN mehr automatisch. Bisher landeten sie je nach Kategorie z. B. in VLAN 10, 20 oder 99. Vorlagen und Bestand bringen ihre gespeicherten VLANs weiter mit
- Topologie: Die Plakette am Kabel zeigt nur noch den Switch-Port, das VLAN steht im Tooltip

## [0.6.0-beta.12] – 2026-09-30

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
