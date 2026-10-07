import React, { useState, useMemo, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, KATEGORIEN, TYPEN, katColor } from "../../shared/constants.js";
import { mainIp, webUrl, suggestIp } from "../../shared/model.js";
import { ipSort } from "../../shared/net.js";
import { Section, VlanChip, StatusDot, VlanSelect } from "../ui.jsx";
import { IconView } from "../icons.jsx";
import DeviceEditor from "../DeviceEditor.jsx";
import { api } from "../api.js";
import DeviceContextMenu from "../DeviceContextMenu.jsx";
import { ipPorts } from "../../shared/catalog.js";
import PatchTabelle, { PatchKnoepfe } from "./PatchlisteTab.jsx";
import { RefreshCw, TriangleAlert, Globe, List, Cable } from "lucide-react";

// Ansicht der Geräteliste: „liste“ (Überblick, sortierbar) oder „patch“ (Aufbau-Reihenfolge, direkt bearbeitbar)
export const ANSICHT_KEY = "netzwerkplaner_geraete_ansicht";
const leseAnsicht = () => { try { return localStorage.getItem(ANSICHT_KEY) === "patch" ? "patch" : "liste"; } catch { return "liste"; } };

export default function GeraeteTab({ P, X, mutate, issues, status, checkReach, selection, setSelection, onAddDevice, onDeleteDevice, onShowProto, onSaveVorlage, onSaveBestand, onUmbauen, onTypWaehlen, bestand, onExport, notify }) {
  const [ansicht, setAnsichtState] = useState(leseAnsicht);
  const setAnsicht = (a) => { setAnsichtState(a); try { localStorage.setItem(ANSICHT_KEY, a); } catch {} };
  const [q, setQ] = useState("");
  const [kat, setKat] = useState("");
  const [vlan, setVlan] = useState(null);
  const [sort, setSort] = useState("name");
  const [ctx, setCtx] = useState(null);
  const closeCtx = useCallback(() => setCtx(null), []);
  const sel = selection?.type === "dev" ? X.devById.get(selection.id) : null;
  const devIssues = (id) => issues.filter((i) => i.dev === id || (i.devs || []).includes(id));

  const list = useMemo(() => {
    const ql = q.toLowerCase();
    const l = P.geraete.filter((d) => (!kat || d.kategorie === kat) && (!vlan || ipPorts(d).some((i) => i.vlan === vlan))
      && (!ql || `${d.name} ${d.netzname || ""} ${(d.felder || []).map((f) => f.wert).join(" ")} ${d.hersteller} ${d.modell} ${d.bereich} ${ipPorts(d).map((i) => i.ip + " " + i.mac).join(" ")} ${(d.protokolle || []).join(" ")}`.toLowerCase().includes(ql)));
    const key = { name: (a, b) => a.name.localeCompare(b.name, "de", { numeric: true }), ip: (a, b) => ipSort(mainIp(a), mainIp(b)), kat: (a, b) => a.kategorie.localeCompare(b.kategorie) || a.name.localeCompare(b.name, "de", { numeric: true }), bereich: (a, b) => (a.bereich || "~").localeCompare(b.bereich || "~") || a.name.localeCompare(b.name, "de") }[sort];
    return [...l].sort(key);
  }, [P.geraete, q, kat, vlan, sort]);

  const autoIps = () => {
    if (!confirm("Allen Ports ohne IP (und ohne DHCP) die nächste freie Adresse ihres VLANs zuweisen? Je Gerät gibt es eine Adresse pro VLAN.")) return;
    mutate((d) => {
      for (const g of d.geraete) for (const i of ipPorts(g)) {
        if (i.ip || i.dhcp || !i.vlan) continue;
        if (ipPorts(g).some((x) => x !== i && x.vlan === i.vlan && (x.ip || x.dhcp))) continue; // z. B. zweiter Port eines Daisy-Chain-Geräts
        const v = d.vlans.find((x) => x.id === i.vlan);
        const ip = suggestIp(d, v, i.id);
        if (ip) i.ip = ip;
      }
    });
  };

  const sichtbar = useMemo(() => new Set(list.map((d) => d.id)), [list]);
  const filterAktiv = !!(q || kat || vlan);
  const umschalter = (
    <div style={{ display: "inline-flex", border: `1px solid ${LINE}`, borderRadius: 7, overflow: "hidden" }}>
      {[["liste", "Liste", List, "Überblick, sortierbar"], ["patch", "Patchliste", Cable, "Aufbau-Reihenfolge, IPs, Ports, Standort, Felder und Notizen direkt bearbeiten"]].map(([k, l, I, t]) => (
        <button key={k} title={t} onClick={() => setAnsicht(k)} style={{ ...S.ghostBtn, border: "none", borderRadius: 0, background: ansicht === k ? ACCENT : "transparent", color: ansicht === k ? "#fff" : undefined }}><I size={14} />{l}</button>
      ))}
    </div>
  );

  const TH = ({ k, children, style }) => <th style={{ ...S.th, cursor: k ? "pointer" : "default", color: sort === k ? ACCENT : S.th.color, ...style }} onClick={() => k && setSort(k)}>{children}</th>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: !sel ? "1fr" : ansicht === "patch" ? "minmax(640px,1.7fr) minmax(460px,1fr)" : "minmax(420px,1fr) minmax(520px,1.25fr)", gap: 20, alignItems: "start" }}>
      <Section title={`Geräte (${P.geraete.length})`} right={<div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {umschalter}
        {ansicht === "patch" && <PatchKnoepfe P={P} mutate={mutate} onExport={onExport} />}
        <button style={S.secondaryBtn} onClick={autoIps} title="Freie IPs automatisch vergeben"><RefreshCw size={14} /> IPs vergeben</button>
        <button style={S.primaryBtn} onClick={() => onAddDevice(null, { picker: true })}>+ Gerät</button>
      </div>}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input style={{ ...S.inputSm, flex: 1, minWidth: 160 }} placeholder="Name, IP, MAC, Modell, Protokoll" value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ ...S.selectSm, width: "auto" }} value={kat} onChange={(e) => setKat(e.target.value)}>
            <option value="">Alle Bereiche</option>{Object.keys(KATEGORIEN).map((k) => <option key={k}>{k}</option>)}
          </select>
          <VlanSelect vlans={P.vlans} value={vlan} onChange={setVlan} style={{ width: "auto" }} noneLabel="Alle VLANs" />
        </div>
        {ansicht === "patch" ? (
          <div style={{ marginTop: 8 }}>
            {filterAktiv && <div style={{ ...S.hint, marginTop: 0, marginBottom: 6 }}>Filter aktiv: Es sind nicht alle Geräte zu sehen. Umsortieren verschiebt nur zwischen den sichtbaren Nachbarn.</div>}
            <PatchTabelle P={P} X={X} mutate={mutate} notify={notify} status={status} issues={issues} aktivId={sel?.id} sichtbar={filterAktiv ? sichtbar : null}
              onSelectDevice={(id) => setSelection({ type: "dev", id })} />
          </div>
        ) : list.length === 0 ? <p style={S.empty}>{P.geraete.length ? "Kein Gerät passt zum Filter." : "Noch keine Geräte. Mit „+ Gerät“ aus dem Katalog hinzufügen."}</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr>
                <TH style={{ width: 28 }}></TH><TH k="name">Name</TH><TH k="kat">Bereich</TH><TH k="ip">IP</TH><TH>VLAN</TH><TH k="bereich">Standort</TH><TH>Web</TH>
              </tr></thead>
              <tbody>
                {list.map((d) => {
                  const ip = mainIp(d);
                  const v = X.vlanById.get(ipPorts(d).find((i) => i.ip)?.vlan || ipPorts(d)[0]?.vlan);
                  const iss = devIssues(d.id);
                  const url = webUrl(d);
                  const active = sel?.id === d.id;
                  return (
                    <tr key={d.id} onClick={() => setSelection({ type: "dev", id: d.id })} onContextMenu={(e) => { e.preventDefault(); setCtx({ id: d.id, x: e.clientX, y: e.clientY }); }} style={{ cursor: "pointer", background: active ? ACCENT + "1c" : undefined }}>
                      <td style={S.td}><IconView icon={d.icon} customIcons={P.icons} color={katColor(d.kategorie)} size={20} /></td>
                      <td style={S.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <StatusDot st={status[d.id]} size={8} />
                          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{d.name}</span>
                          {iss.some((i) => i.sev === "error") ? <span style={{ color: ERR, display: "inline-flex" }} title={iss.map((i) => i.msg).join("\n")}><TriangleAlert size={14} /></span> : iss.some((i) => i.sev === "warn") ? <span style={{ color: WARN, display: "inline-flex" }} title={iss.map((i) => i.msg).join("\n")}><TriangleAlert size={14} /></span> : null}
                        </div>
                        <div style={{ fontSize: 11, color: MUTED }}>{[d.hersteller, d.modell].filter(Boolean).join(" ") || TYPEN[d.typ]?.label}{d.netzname ? ` · ${d.netzname}` : ""}</div>
                      </td>
                      <td style={{ ...S.td, fontSize: 12, color: katColor(d.kategorie) }}>{d.kategorie}</td>
                      <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>{ip || <span style={{ color: MUTED }}>{ipPorts(d).some((i) => i.dhcp) ? "DHCP" : "–"}</span>}{ipPorts(d).filter((i) => i.ip).length > 1 && <span style={{ color: MUTED }}> +{ipPorts(d).filter((i) => i.ip).length - 1}</span>}</td>
                      <td style={S.td}><VlanChip v={v} small /></td>
                      <td style={{ ...S.td, fontSize: 12 }}>{d.bereich}</td>
                      <td style={S.td}>{url ? <button style={{ ...S.smallBtn, padding: "2px 6px" }} title={url} onClick={(e) => { e.stopPropagation(); api.openExternal(url); }}><Globe size={12} /></button> : d.webUi?.vorhanden ? <span style={{ color: MUTED, display: "inline-flex" }} title="IP fehlt"><Globe size={12} /></span> : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      {ctx && X.devById.get(ctx.id) && <DeviceContextMenu P={P} X={X} dev={X.devById.get(ctx.id)} x={ctx.x} y={ctx.y} status={status[ctx.id]} issues={devIssues(ctx.id)} onClose={closeCtx}
        onEdit={() => setSelection({ type: "dev", id: ctx.id })} onCheck={checkReach} onDelete={() => onDeleteDevice(ctx.id)} />}
      {sel && (
        <Section style={{ position: "sticky", top: 12, maxHeight: "calc(100vh - 140px)", overflowY: "auto" }}>
          <DeviceEditor key={sel.id} P={P} X={X} dev={sel} mutate={mutate} status={status[sel.id]} onCheck={checkReach} issues={devIssues(sel.id)} onClose={() => setSelection(null)} kopfAbstand={20}
            onSelectDevice={(id) => setSelection({ type: "dev", id })} onDelete={onDeleteDevice} onShowProto={onShowProto} onSaveVorlage={onSaveVorlage} onSaveBestand={onSaveBestand} onUmbauen={onUmbauen} onTypWaehlen={onTypWaehlen} bestand={bestand} />
        </Section>
      )}
    </div>
  );
}
