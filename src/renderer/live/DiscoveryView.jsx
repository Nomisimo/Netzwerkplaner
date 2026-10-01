import React, { useMemo, useState } from "react";
import { S, OK, INFO, MUTED, SUB, TYPEN } from "../../shared/constants.js";
import { sammleFunde, fundeMitPlan, fundZuGeraet } from "../../shared/discovery.js";
import { useMonitor } from "./store.js";
import { Table, td, Hint, Empty, Pill, mono } from "./common.jsx";
import { Play, RefreshCw, Square } from "lucide-react";

// Monitore, die beim Suchen starten. Nur Mithören plus mDNS-Abfragen und ArtPoll.
const SUCHE = ["dante", "ndi", "artnet", "sacn", "citp", "manet"];

export default function DiscoveryView({ P, mutate, iface, onSelectDevice, notify, goSub }) {
  const mons = {
    scan: useMonitor("scan"), dante: useMonitor("dante"), ndi: useMonitor("ndi"), artnet: useMonitor("artnet"),
    sacn: useMonitor("sacn"), citp: useMonitor("citp"), manet: useMonitor("manet"), ptp: useMonitor("ptp"),
  };
  const snaps = Object.fromEntries(Object.entries(mons).map(([k, m]) => [k, m.snapshot]));
  const funde = useMemo(() => fundeMitPlan(P, sammleFunde(snaps)), [P, ...Object.values(snaps)]);
  const neu = funde.filter((f) => !f.plan);
  const laeuft = SUCHE.filter((k) => mons[k].running);
  const [fehler, setFehler] = useState([]);

  const suchen = async () => {
    const err = [];
    for (const k of SUCHE) {
      if (mons[k].running) continue;
      const ok = await mons[k].start(k === "sacn" ? { iface, universes: [] } : { iface });
      if (!ok) err.push(k);
    }
    setTimeout(() => { mons.artnet.action("poll"); mons.dante.action("query"); mons.ndi.action("query"); }, 400);
    setFehler(err);
  };
  const stoppen = () => SUCHE.forEach((k) => mons[k].running && mons[k].stop());

  const einfuegen = (list) => {
    if (!list.length) return;
    mutate((d) => { for (const f of list) d.geraete.push(fundZuGeraet(f, d.vlans)); });
    notify?.(list.length === 1 ? `${list[0].name || list[0].ip} als generisches Gerät eingefügt.` : `${list.length} generische Geräte eingefügt.`);
  };

  return (
    <div>
      <div style={{ ...S.row, alignItems: "center" }}>
        {laeuft.length < SUCHE.length
          ? <button style={S.primaryBtn} onClick={suchen}><Play size={12} fill="currentColor" /> Geräte suchen</button>
          : <button style={S.secondaryBtn} onClick={() => { mons.artnet.action("poll"); mons.dante.action("query"); mons.ndi.action("query"); }}><RefreshCw size={14} /> Erneut fragen</button>}
        {laeuft.length > 0 && <button style={S.ghostBtn} onClick={stoppen}><Square size={12} fill="currentColor" /> Suche stoppen</button>}
        <button style={S.ghostBtn} onClick={() => goSub?.("scan")}>Subnetz scannen …</button>
        <span style={{ fontSize: 12, color: SUB }}>
          {laeuft.length ? `Hört mit: ${laeuft.map((k) => ({ dante: "Dante", ndi: "NDI", artnet: "Art-Net", sacn: "sACN", citp: "CITP", manet: "MA-Net" })[k]).join(", ")}` : "Suche aus"}
          {mons.scan.snapshot?.hosts?.length ? ` · letzter Scan ${mons.scan.snapshot.cidr}: ${mons.scan.snapshot.hosts.length} Geräte` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <button style={S.primaryBtn} disabled={!neu.length} onClick={() => einfuegen(neu)}>+ Alle neuen einfügen ({neu.length})</button>
      </div>
      {fehler.length > 0 && <div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>Nicht gestartet (Port belegt oder kein Netz): {fehler.join(", ")}. Die übrigen Quellen laufen.</div>}
      {!funde.length ? <Empty>Noch nichts gefunden. „Geräte suchen“ startet die Monitore, ein Netzwerkscan findet auch stille Geräte.</Empty> : (
        <Table head={["", "IP", "Name im Netz", "MAC", "Protokolle", "Vorschlag", "Quellen", ""]}>
          {funde.map((f) => (
            <tr key={f.ip}>
              <td style={td()}>{f.plan ? <Pill color={OK}>im Plan</Pill> : <Pill color={INFO}>neu</Pill>}</td>
              <td style={td(mono)}>{f.ip}</td>
              <td style={td()}>{f.plan ? <a href="#" style={{ color: "#fff" }} onClick={(e) => { e.preventDefault(); onSelectDevice(f.plan.dev.id); }}>{f.plan.dev.name}</a> : f.name || <span style={{ color: MUTED }}>–</span>}{f.plan && f.name && f.name !== f.plan.dev.name && <div style={{ fontSize: 11, color: MUTED }}>im Netz: {f.name}</div>}</td>
              <td style={td(mono)}>{f.mac}</td>
              <td style={td({ fontSize: 12 })}>{f.protokolle.join(", ")}</td>
              <td style={td({ fontSize: 12, color: SUB })}>{f.typ ? TYPEN[f.typ]?.label : ""}</td>
              <td style={td({ fontSize: 11, color: MUTED })}>{f.quellen.join(", ")}</td>
              <td style={td()}>{!f.plan && <button style={S.smallBtn} onClick={() => einfuegen([f])}>+ Einfügen</button>}</td>
            </tr>
          ))}
        </Table>
      )}
      <Hint>
        Die Suche führt zusammen, was die Monitore im Netz sehen: Dante- und NDI-Geräte per mDNS, Art-Net-Nodes per ArtPoll, sACN-Quellen, MA-Net-Sender und CITP-Teilnehmer, dazu die Treffer des letzten Netzwerkscans.
        Neue Geräte kommen als generische Einträge mit IP, MAC und Name in den Plan. Im Geräte-Editor legst du dann per „Modell zuweisen“ das Katalogmodell fest oder per „Leeres Gerät anlegen“ nur den Typ.
      </Hint>
    </div>
  );
}
