# Datenmodell (.netplan)

```
Projekt   { format: "netzwerkplaner", version: 1, meta, bereiche[], vlans[], geraete[], verbindungen[], layout, icons[] }
meta      { veranstaltung, ort, ersteller, datum, version, notiz }
VLAN      { id, vid, name, farbe, subnetz (CIDR), gateway, zweck, igmp, querier, eeeAus, qos, dhcp { aktiv, von, bis }, notiz }
Gerät     { id, name, typ, kategorie, hersteller, modell, katalogId, icon, bereich, isSwitch, poeBudget, poeBedarf,
            interfaces[ { id, name, ip, prefix, gateway, vlan, mac, dhcp } ],
            ports[ { id, name, typ, iface, modus: access|trunk, vlan, vlans[], poe, p2p } ],
            webUi { vorhanden, url ("http://{ip}"), iface }, protokolle[], notizen }
Verbindung{ id, a { dev, port }, b { dev, port }, kabel, laenge, label, notiz }
layout    { rootId, offsets { devId: { dx, dy } }, pinned { devId: { x, y } }, collapsed { devId: true } }
icons     [ { id, name, data (Data-URL) } ]
```

- Interfaces tragen die IP-Konfiguration, Ports sind die physischen Buchsen. Ein Endgerät-Port zeigt über `iface` auf sein Interface (Dante Primary/Secondary = zwei Interfaces).
- Das VLAN einer Verbindung ergibt sich aus dem Switch-Port (Access/Trunk) bzw. dem Interface des Endgeräts.
- Der Mindmap-Baum wird aus den Verbindungen berechnet: Verzweigung nur über Switches; Switches, die nur über Endgeräte erreichbar sind (z. B. Dante Secondary), bilden eigene Netze darunter. `offsets` wirken auf den ganzen Ast.
