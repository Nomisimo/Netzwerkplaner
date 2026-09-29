import React from "react";
import { S, ACCENT, SUB } from "../../shared/constants.js";
import { Section } from "../ui.jsx";

const Block = ({ title, items }) => (
  <Section title={title}>
    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13, color: "#d4dae0" }}>
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  </Section>
);

export default function AnleitungTab() {
  return (
    <>
      <Block title="1 · Projekt & VLANs" items={[
        "Im Tab Projekt Veranstaltung, Ort und Ersteller eintragen. Die Standard-VLANs aus der Protokollrecherche (10, 11, 20, 30, 40, 50, 99) sind schon angelegt.",
        "Im Tab VLANs & IP-Plan Subnetze, Gateway und Switch-Einstellungen (IGMP-Querier, EEE aus, QoS, DHCP-Bereich) je VLAN pflegen.",
      ]} />
      <Block title="2 · Topologie aufbauen" items={[
        "Einen Switch aus der Palette links auf die Fläche ziehen. Das erste bzw. am stärksten vernetzte Switch wird automatisch zur Mitte der Mindmap (Core); mit „☆ Als Core setzen“ lässt sich das ändern.",
        "Weitere Geräte auf ein vorhandenes Gerät ziehen: Sie werden an den nächsten freien Port angeschlossen. „+ Aus Katalog …“ öffnet die Suche über alle Herstellermodelle; ist ein Gerät ausgewählt, wird das neue direkt daran angeschlossen.",
        "Werkzeug „🔗 Verbinden“ (Taste C): von Gerät zu Gerät ziehen. Switch-Ports übernehmen das VLAN des Endgeräts, Switch-zu-Switch-Verbindungen werden als Trunk mit allen VLANs angelegt.",
        "Werkzeug „✥ Bewegen“ (Taste V): Geräte ziehen; der ganze Ast zieht mit. „↺ Auto-Layout“ setzt alle Verschiebungen zurück. Die Kreise am Astende klappen Äste ein und aus.",
        "Farbe der Leitungen nach VLAN, Bereich oder Kabeltyp. Filter nach Bereich, VLAN und Suche blenden alles andere ab. Entf löscht die Auswahl, Strg+Z macht rückgängig.",
      ]} />
      <Block title="3 · Geräte, Ports, IP-Adressen" items={[
        "Klick auf ein Gerät öffnet den Editor: Interfaces (IP, Maske, VLAN, Gateway, MAC, DHCP), physische Ports (Access/Trunk-VLANs, PoE, Punkt-zu-Punkt), Web-UI, Protokolle und Notizen.",
        "⟳ neben der IP schlägt die nächste freie Adresse im VLAN vor (die ersten Adressen und der DHCP-Bereich bleiben frei). „⟳ IPs vergeben“ im Tab Geräte füllt alle leeren Interfaces auf einmal.",
        "Katalogmodelle bringen Ports, Protokolle und Web-UI mit. Dante-Geräte mit Primary/Secondary bekommen zwei Interfaces (VLAN 10 und 11).",
      ]} />
      <Block title="4 · Web-UI & Erreichbarkeit" items={[
        "Geräte mit Web-UI zeigen 🌐 in der Topologie und in der Geräteliste; ein Klick öffnet die Oberfläche im Standardbrowser. Die URL darf {ip} und einen Port enthalten, z. B. https://{ip}:8443.",
        "„⟳ Status“ prüft alle Geräte mit IP: zuerst per TCP auf den Web-UI-Port, sonst per Ping. Grün = erreichbar, Rot = keine Antwort, Grau = nicht geprüft. Mit „alle 15 s“ läuft die Prüfung zyklisch. Das funktioniert nur, wenn der Rechner im selben Netz ist.",
      ]} />
      <Block title="5 · Prüfung & Export" items={[
        "Der Tab Prüfung listet IP-Konflikte, Adressen außerhalb des Subnetzes, VLAN-Fehler an Switch-Ports, Punkt-zu-Punkt-Protokolle (AES50, SLink, HDBaseT …) am Switch, fehlendes IGMP bei Multicast, EEE bei Audio over IP und PoE-Budgets.",
        "Speichern erzeugt eine .netplan.json-Datei (komplett offline, inkl. eigener Icons). Der Stand wird zusätzlich automatisch gespeichert.",
        "Export: PDF-Dokumentation (Topologie, VLANs, IP-Liste, Patchliste, Prüfung), Excel mit allen Listen, CSV-IP-Liste sowie die Topologie als SVG oder PNG.",
      ]} />
      <p style={{ ...S.hint, textAlign: "center" }}>Die Protokoll- und Gerätedaten stammen aus der Recherche im Projektordner und sind teilweise nicht datenblattgeprüft (siehe Datenstand in der Bibliothek).</p>
    </>
  );
}
