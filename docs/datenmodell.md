# Datenmodell (.netplan)

```
Projekt   { format: "netzwerkplaner", version: 1, meta, bereiche[], vlans[], geraete[], verbindungen[], layout, icons[], planProfil? }
meta      { veranstaltung, ort, ersteller, datum, version, notiz }
VLAN      { id, vid, name, farbe, subnetz (CIDR), gateway, zweck, igmp, querier, eeeAus, qos, dhcp { aktiv, von, bis }, notiz }
Gerät     { id, name, typ, kategorie, hersteller, modell, katalogId, icon, bereich, isSwitch, poeBudget, poeBedarf,
            interfaces[ { id, name, ip, prefix, gateway, vlan, mac, dhcp } ],
            ports[ { id, name, typ, iface, modus: access|trunk, vlan, vlans[], poe, p2p, farbe? } ],
            webUi { vorhanden, url ("http://{ip}"), iface }, protokolle[], notizen }
Verbindung{ id, a { dev, port }, b { dev, port }, kabel, laenge, label, notiz }
layout    { rootId, offsets { devId: { dx, dy } }, pinned { devId: { x, y } }, collapsed { devId: true } }
icons     [ { id, name, data (Data-URL) } ]
```

### Plan-Profil (Plott)

`planProfil` ist eine Kopie des Profils, mit dem der Plott-Plan gezeichnet wird. Fehlt es (ältere Projekte), gilt „Standard“ mit den bisherigen Einstellungen dieses Rechners (Farbe, IP-Adressen). Dieselbe Form hat eine `.npprofil`-Datei und ein eigenes Profil in der Bibliothek (`library.planProfile[]`). Code: `src/shared/plottprofil.js`.

```
planProfil { format: "netzwerkplaner-planprofil", version: 1, id, name, basiertAuf,
  design   { schrift, papier, rahmen, text, textNeben, linienBreite, boxRand, switchFuellung, kategorieAufhellen, kategorieFarben { Kategorie: "#rrggbb" },
             farben { primary, secondary, glas, trunk, sonst },
             raum { fuellung, rand, kopf, kopfLinie, strich }, stack { fuellung, rand, kopf, kopfLinie } },
  inhalt   { stufe: 1–4, felder { modell, ip, notiz, anmerkung, kabeltext, switchPorts, geraetPorts, portKaesten, kabelDetails },
             gewerke: [] | ["Licht", "Ton", "Video"], fremde: "blass" | "aus" },
  kabel    { farbe: "dante" | "vlan", spur },
  anordnung{ maxSpalten, kastenAbstand, reihenAbstand, gruppeAbstand, raumAbstand } }
```

- `basiertAuf` nennt die Vorlage oder das eigene Profil, aus dem alles kommt, was das Profil nicht selbst setzt.
- Beim Laden werden unbekannte Angaben ignoriert; falsche Typen, ungültige Farben und Werte außerhalb der Grenzen fallen auf die Basis zurück.
- `inhalt.felder` überschreibt einzelne Felder der Stufe. Leere `gewerke` heißt: alle Gewerke. `portKaesten` zeigt alle Ports als Kästchen (an in Stufe 4), unbelegte gestrichelt. Farbe: `port.farbe`, sonst Trunk- bzw. VLAN-Farbe des Ports oder des angeschlossenen Kabels.
- `anordnung`: Abstände in Punkten (Standard 30 / 26 / 46 / 70) mit Grenzen 10–120, 10–120, 10–200, 20–300.

Von Hand im Plott-Editor geändert (im Projekt-`layout`, nicht im Profil):

```
layout.plottPos    { devId: { dx, dy } }        Kasten frei verschoben, Versatz zur automatischen Lage
layout.plottKabel  { connId: [[x, y], …] }      gezogener Kabelverlauf, innere Knickpunkte; Enden schließen rechtwinklig an
layout.plottFarben { devId | connId: "#hex" }   eigene Farbe für einen Kasten oder ein Kabel
```

- Interfaces tragen die IP-Konfiguration, Ports sind die physischen Buchsen. Ein Endgerät-Port zeigt über `iface` auf sein Interface (Dante Primary/Secondary = zwei Interfaces).
- Das VLAN einer Verbindung ergibt sich aus dem Switch-Port (Access/Trunk) bzw. dem Interface des Endgeräts.
- Der Mindmap-Baum wird aus den Verbindungen berechnet: Verzweigung nur über Switches; Switches, die nur über Endgeräte erreichbar sind (z. B. Dante Secondary), bilden eigene Netze darunter. `offsets` wirken auf den ganzen Ast.
