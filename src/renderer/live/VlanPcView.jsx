import React, { useState, useEffect, useMemo } from "react";
import { S, OK, ERR, WARN, MUTED, SUB } from "../../shared/constants.js";
import { vlanPcVorschlag } from "../../shared/vlanpc.js";
import { VlanChip } from "../ui.jsx";
import { api } from "../api.js";
import { Table, td, Hint, Empty, mono } from "./common.jsx";
import { RefreshCw, Plus, Trash2, OctagonX, TriangleAlert, Check } from "lucide-react";

// Getaggte VLAN-Schnittstellen am eigenen Mac anlegen, damit er am Trunk-Port alle geplanten VLANs sieht
export default function VlanPcView({ P, X, interfaces, reloadInterfaces }) {
  const [st, setSt] = useState(null);
  const [parent, setParent] = useState(() => localStorage.getItem("netzwerkplaner_vlanpc_parent") || "");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ergebnis, setErgebnis] = useState(null);

  const laden = () => api.vlanPcStatus().then((s) => {
    setSt(s);
    setParent((cur) => (s.ports.some((p) => p.device === cur) ? cur : s.ports[0]?.device || ""));
  });
  useEffect(() => { laden(); }, []);
  useEffect(() => { if (parent) localStorage.setItem("netzwerkplaner_vlanpc_parent", parent); }, [parent]);

  const eigene = (st?.vlans || []).filter((v) => v.eigen);
  const vorschlag = useMemo(() => vlanPcVorschlag(P, interfaces, eigene.map((v) => v.device)), [P, interfaces, st]);
  useEffect(() => { setRows(vorschlag); }, [vorschlag]);
  const setRow = (i, o) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...o } : x)));

  if (!st) return <Empty>Lade Netzwerkkarten …</Empty>;
  if (!st.unterstuetzt) return (
    <div>
      <Empty>VLANs am Rechner anlegen geht nur in der Mac-App.</Empty>
      <Hint>Windows kann ohne passenden Treiber keine getaggten VLANs. Bei Intel-Karten geht es mit „Intel PROSet / ANS“, bei manchen Realtek-Karten mit dem „Realtek Ethernet Diagnostic Utility“. Sonst den Switch-Port als Access-Port ins gewünschte VLAN stellen.</Hint>
    </div>
  );

  const fertig = async (r) => {
    setErgebnis(r);
    setBusy(false);
    await laden();
    // macOS braucht einen Moment, bis die neuen Schnittstellen ihre Adresse haben
    setTimeout(() => reloadInterfaces?.(), 1500);
    setTimeout(() => reloadInterfaces?.(), 6000);
  };
  const anlegen = async () => {
    const eintraege = rows.filter((r) => r.an).map((r) => ({ vid: r.vid, dhcp: r.dhcp, ip: r.ip.trim(), mask: r.mask.trim() }));
    setBusy(true); setErgebnis(null);
    fertig(await api.vlanPcAnlegen({ parent, eintraege }));
  };
  const entfernen = async () => { setBusy(true); setErgebnis(null); fertig(await api.vlanPcEntfernen()); };
  const anzahl = rows.filter((r) => r.an).length;

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: SUB }}>
          Am Trunk hängt
          <select style={{ ...S.selectSm, width: 240 }} value={parent} onChange={(e) => setParent(e.target.value)}>
            {!st.ports.length && <option value="">keine Ethernet-Karte gefunden</option>}
            {st.ports.map((p) => <option key={p.device} value={p.device}>{p.port} · {p.device}</option>)}
          </select>
        </label>
        <button style={S.smallBtn} onClick={laden} title="Neu laden"><RefreshCw size={12} /></button>
        <button style={S.primaryBtn} disabled={busy || !parent || !anzahl} onClick={anlegen}><Plus size={14} /> {anzahl} VLAN{anzahl === 1 ? "" : "s"} anlegen</button>
        <button style={S.secondaryBtn} disabled={busy || !eigene.length} onClick={entfernen}><Trash2 size={12} /> Alle wieder entfernen</button>
        {busy && <span style={{ fontSize: 12, color: MUTED }}>Warte auf das Admin-Passwort …</span>}
      </div>
      {st.fehler && <div style={{ color: ERR, fontSize: 12, marginBottom: 10 }}>{st.fehler}</div>}
      {ergebnis && <Ergebnis r={ergebnis} />}

      {!rows.length ? <Empty>Im Plan gibt es noch keine VLANs.</Empty> : (
        <Table head={["", "VLAN", "Subnetz", "Adresse am Rechner", "Maske", "Hinweis"]}>
          {rows.map((r, i) => {
            const da = eigene.find((v) => v.tag === r.vid);
            return (
              <tr key={r.vlanId}>
                <td style={td({ width: 24 })}><input type="checkbox" checked={r.an} onChange={(e) => setRow(i, { an: e.target.checked })} /></td>
                <td style={td()}><VlanChip v={X.vlanById.get(r.vlanId)} small /> <span style={{ fontSize: 12, color: SUB }}>{r.name}</span></td>
                <td style={td(mono)}>{r.subnetz || "–"}</td>
                <td style={td()}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select style={{ ...S.selectSm, width: 90 }} value={r.dhcp ? "dhcp" : "fest"} onChange={(e) => setRow(i, { dhcp: e.target.value === "dhcp" })}>
                      <option value="fest">fest</option>
                      <option value="dhcp">DHCP</option>
                    </select>
                    {!r.dhcp && <input style={{ ...S.inputSm, ...mono, width: 130 }} value={r.ip} onChange={(e) => setRow(i, { ip: e.target.value })} placeholder="IP" />}
                  </div>
                </td>
                <td style={td()}>{!r.dhcp && <input style={{ ...S.inputSm, ...mono, width: 130 }} value={r.mask} onChange={(e) => setRow(i, { mask: e.target.value })} placeholder="255.255.255.0" />}</td>
                <td style={td({ fontSize: 12, color: da ? OK : MUTED })}>{da ? `angelegt (${da.device} an ${da.parent})` : r.hinweis}</td>
              </tr>
            );
          })}
        </Table>
      )}
      {eigene.some((v) => !rows.some((r) => r.vid === v.tag)) && <div style={{ fontSize: 12, color: SUB, marginTop: 10 }}>Außerdem am Rechner angelegt (nicht mehr im Plan): {eigene.filter((v) => !rows.some((r) => r.vid === v.tag)).map((v) => `${v.name} (${v.device} an ${v.parent})`).join(", ")}</div>}
      <Hint>
        Legt am Mac für jedes gewählte VLAN eine getaggte Schnittstelle (802.1Q) an, wie unter Systemeinstellungen › Netzwerk › VLANs. macOS fragt einmal nach dem Admin-Passwort.
        Der Switch-Port muss ein Trunk mit diesen VLANs sein. Es wird kein Gateway gesetzt, Internet und Standardroute bleiben beim Hauptanschluss.
        Die VLANs bleiben nach dem Beenden der App bestehen, bis du sie hier entfernst. Die App fasst nur VLANs an, deren Name mit „NP VLAN“ beginnt.
        Die neuen Schnittstellen erscheinen danach oben bei „Netzwerkkarte“; Scan und Monitore laufen immer über die dort gewählte.
      </Hint>
    </div>
  );
}

function Ergebnis({ r }) {
  if (r.abgebrochen) return <div style={{ color: WARN, fontSize: 12, marginBottom: 10, display: "flex", gap: 5 }}><TriangleAlert size={13} /> Abgebrochen, nichts geändert.</div>;
  if (r.fehler) return <div style={{ color: ERR, fontSize: 12, marginBottom: 10, display: "flex", gap: 5 }}><OctagonX size={13} style={{ flexShrink: 0 }} /> {r.fehler}</div>;
  return (
    <div style={{ fontSize: 12, marginBottom: 10 }}>
      {!r.meldungen.length && <div style={{ color: MUTED }}>Nichts zu tun.</div>}
      {r.meldungen.map((m, i) => (
        <div key={i} style={{ color: m.ok ? OK : ERR, display: "flex", gap: 5, alignItems: "center" }}>
          {m.ok ? <Check size={12} /> : <OctagonX size={12} />} {m.text}
        </div>
      ))}
    </div>
  );
}
