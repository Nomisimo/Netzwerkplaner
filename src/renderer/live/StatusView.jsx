import React, { useMemo } from "react";
import { S, OK, ERR, MUTED } from "../../shared/constants.js";
import { webUrl } from "../../shared/model.js";
import { ipSort } from "../../shared/net.js";
import { fmtAge } from "../../shared/live.js";
import { StatusDot, Toggle, VlanChip } from "../ui.jsx";
import { api } from "../api.js";
import { Table, td, Hint, Empty, mono } from "./common.jsx";
import { ipPorts } from "../../shared/catalog.js";
import { RefreshCw, ExternalLink } from "lucide-react";

// Online/Offline aller geplanten Geräte. Nutzt dieselbe Prüfung wie die Topologie,
// daher erscheinen die Punkte dort ebenfalls.
export default function StatusView({ P, X, status, checkReach, autoStatus, setAutoStatus, onSelectDevice }) {
  const rows = useMemo(() => P.geraete
    .map((d) => ({ d, ifc: d.ports.find((i) => i.id === d.webUi?.iface && i.ip) || ipPorts(d).find((i) => i.ip) }))
    .filter((r) => r.ifc)
    .sort((a, b) => ipSort(a.ifc.ip, b.ifc.ip)), [P.geraete]);
  const n = { on: 0, off: 0, unk: 0 };
  for (const r of rows) { const st = status[r.d.id]; if (!st || st.ok == null) n.unk++; else if (st.ok) n.on++; else n.off++; }

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 14 }}>
        <button style={S.primaryBtn} onClick={() => checkReach()}><RefreshCw size={14} /> Jetzt prüfen</button>
        <Toggle checked={autoStatus} onChange={setAutoStatus} label="Automatisch alle 15 s (auch in der Topologie)" />
        <span style={{ fontSize: 12, color: "#c8d0d8" }}>
          <b style={{ color: OK }}>{n.on}</b> online · <b style={{ color: ERR }}>{n.off}</b> offline · <b style={{ color: MUTED }}>{n.unk}</b> ungeprüft
        </span>
      </div>
      {!rows.length ? <Empty>Im Plan hat noch kein Gerät eine IP-Adresse.</Empty> : (
        <Table head={["", "Gerät", "IP", "VLAN", "Ergebnis", "Geprüft", "Web-UI"]}>
          {rows.map(({ d, ifc }) => {
            const st = status[d.id];
            const url = webUrl(d);
            return (
              <tr key={d.id}>
                <td style={td({ width: 20 })}><StatusDot st={st} /></td>
                <td style={td()}><a href="#" style={{ color: "#fff" }} onClick={(e) => { e.preventDefault(); onSelectDevice(d.id); }}>{d.name}</a></td>
                <td style={td(mono)}>{st?.ok && st.ip ? st.ip : ifc.ip}{ipPorts(d).filter((i) => i.ip).length > 1 && <span style={{ color: MUTED, fontFamily: "inherit", fontSize: 11 }}> +{ipPorts(d).filter((i) => i.ip).length - 1}</span>}</td>
                <td style={td()}>{ifc.vlan && <VlanChip v={X.vlanById.get(ifc.vlan)} small />}</td>
                <td style={td({ fontSize: 12, color: !st ? MUTED : st.ok ? OK : st.ok === false ? ERR : MUTED })}>
                  {!st ? "–" : st.ok == null ? st.method : st.ok ? `erreichbar · ${st.method} · ${st.ms} ms` : `keine Antwort (${st.method})`}
                </td>
                <td style={td({ fontSize: 12, color: MUTED })}>{st?.t ? fmtAge(Date.now() - st.t) : "–"}</td>
                <td style={td()}>{url && <button style={S.smallBtn} onClick={() => api.openExternal(url)}>Öffnen <ExternalLink size={12} /></button>}</td>
              </tr>
            );
          })}
        </Table>
      )}
      <Hint>Geprüft wird jede IP eines Geräts über die oben gewählte Netzwerkkarte: am Web-UI-Anschluss zuerst per TCP auf den Web-UI-Port, sonst per Ping. Antwortet eine IP, gilt das Gerät als erreichbar; welche IPs antworten, zeigt der Geräte-Editor. „Keine Antwort“ kann auch heißen, dass der Rechner nicht im selben Netz hängt oder eine Firewall Ping blockt.</Hint>
    </div>
  );
}
