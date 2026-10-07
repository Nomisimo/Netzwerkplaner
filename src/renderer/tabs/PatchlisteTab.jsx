import React, { useMemo, useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, katColor, STRONG } from "../../shared/constants.js";
import { patchZeilen, steckZiele, steckeUm, setzeFeld } from "../../shared/patchliste.js";
import { feldSpalten, feldWert } from "../../shared/felder.js";
import { ip2int } from "../../shared/net.js";
import { StatusDot, AuswahlFeld } from "../ui.jsx";
import { IconView } from "../icons.jsx";
import { GripVertical, ChevronUp, ChevronDown, RotateCcw, Printer, FileSpreadsheet, TriangleAlert, Cable } from "lucide-react";

/* Patch-Ansicht der Geräteliste: alle Geräte in Aufbau-Reihenfolge, per Ziehen oder Pfeilen umsortierbar.
   Kompakt und direkt bearbeitbar: IP-Adressen, Switch und Port („gesteckt auf“), Standort,
   eigene Felder und Notizen. Im Druck gibt es zusätzlich leere Zeilen für Notizen vor Ort
   und ein Kästchen zum Abhaken. Weitere Kabel (z. B. Dante Secondary) stehen hier nicht. */
const ein = { ...S.inputSm, padding: "2px 5px", fontSize: 11.5, height: 22, minHeight: 0 };
const mono = { fontFamily: "ui-monospace,monospace" };
const ZEILE = 24; // Höhe einer IP-Zeile, „Gesteckt auf“ richtet sich danach aus
const PORT_W = 74; // feste Breite der Portnamen, damit alle IP-Felder untereinander stehen

export default function PatchTabelle({ P, X, mutate, onSelectDevice, notify, sichtbar = null, status = {}, issues = [], aktivId = null }) {
  const alle = useMemo(() => patchZeilen(P, X), [P, X]);
  const zeilen = useMemo(() => (sichtbar ? alle.filter((z) => sichtbar.has(z.id)) : alle), [alle, sichtbar]);
  const felder = useMemo(() => feldSpalten(P.geraete, P.feldKatalog), [P.geraete, P.feldKatalog]);
  const standorte = useMemo(() => [...new Set([...(P.bereiche || []), ...P.geraete.map((d) => (d.bereich || "").trim()).filter(Boolean)])], [P.bereiche, P.geraete]);
  const manuell = (P.patchliste?.reihenfolge || []).length > 0;
  const [zieht, setZieht] = useState(null); // id der gezogenen Zeile
  const [ueber, setUeber] = useState(null);
  const [alleIps, setAlleIps] = useState(() => new Set()); // Geräte, bei denen auch leere IP-Ports offen sind

  const setzeReihenfolge = (ids) => mutate((d) => { d.patchliste = { ...(d.patchliste || {}), reihenfolge: ids }; });
  const verschiebe = (id, ziel) => {
    const ids = alle.map((z) => z.id).filter((x) => x !== id);
    const i = ziel == null ? ids.length : ids.indexOf(ziel);
    ids.splice(i < 0 ? ids.length : i, 0, id);
    setzeReihenfolge(ids);
  };
  // Mit dem sichtbaren Nachbarn tauschen (bei aktivem Filter liegen dazwischen evtl. ausgeblendete Geräte)
  const schritt = (i, d) => {
    const nb = zeilen[i + d];
    if (!nb) return;
    const ids = alle.map((z) => z.id);
    const a = ids.indexOf(zeilen[i].id), b = ids.indexOf(nb.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    setzeReihenfolge(ids);
  };
  const devIssues = (id) => issues.filter((x) => x.dev === id || (x.devs || []).includes(id));
  const geraet = (fn, id) => mutate((d) => { const g = d.geraete.find((x) => x.id === id); if (g) fn(g, d); });
  const umstecken = (z, switchId, portId) => {
    let ok = true;
    mutate((d) => { ok = steckeUm(d, z.id, { upConn: z.upConn, switchId, portId, eigenerPort: z.eigenerPort }); });
    if (!ok) notify?.("Kein freier Anschluss: Am Gerät oder am Switch ist kein passender Port frei.", "warn");
  };

  return (
    <>
      {manuell && <div style={{ ...S.hint, marginTop: 0, marginBottom: 6 }}>Reihenfolge von Hand angepasst. Neue Geräte erscheinen an ihrer automatischen Stelle.</div>}
      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead><tr>
            {["", "#", "", "Name", "IP", "Gesteckt auf", "Standort", ...(felder.length ? ["Felder"] : []), "Notiz"].map((h, i) => <th key={i} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {zeilen.map((z, i) => {
              const neueGruppe = i > 0 && (z.isSwitch || (z.aufSwitch !== zeilen[i - 1].aufSwitch && !zeilen[i - 1].isSwitch));
              const dev = X.devById.get(z.id);
              const ziele = steckZiele(P, z.id, z);
              const ziel = ziele.find((s) => s.id === z.aufSwitch);
              const td = (extra) => ({ ...S.td, padding: "3px 6px", verticalAlign: "top", ...extra });
              // Kompakt: nur belegte Ports zeigen (und den gesteckten), leere erst auf Klick; mindestens ein Feld bleibt sichtbar
              const belegt = z.ipPorts.filter((p) => p.ip || p.dhcp || p.id === z.eigenerPort);
              const sicht = alleIps.has(z.id) ? z.ipPorts : belegt.length ? belegt : z.ipPorts.slice(0, 1);
              const rest = z.ipPorts.length - sicht.length;
              // „Gesteckt auf“ steht auf Höhe des Ports, über den das Gerät am Switch hängt
              const steckZeile = Math.max(0, sicht.findIndex((p) => p.id === z.eigenerPort));
              return (
                <tr key={z.id} draggable onDragStart={(e) => { if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; setZieht(z.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", z.id); }}
                  onDragOver={(e) => { if (zieht) { e.preventDefault(); setUeber(z.id); } }} onDragLeave={() => setUeber((u) => (u === z.id ? null : u))}
                  onDrop={(e) => { e.preventDefault(); if (zieht && zieht !== z.id) verschiebe(zieht, z.id); setZieht(null); setUeber(null); }}
                  onDragEnd={() => { setZieht(null); setUeber(null); }}
                  style={{ background: aktivId === z.id ? ACCENT + "1c" : undefined, opacity: zieht === z.id ? 0.4 : 1, boxShadow: ueber === z.id && zieht !== z.id ? `inset 0 2px 0 ${ACCENT}` : undefined, borderTop: neueGruppe ? `2px solid ${LINE}` : undefined }}>
                  <td style={td({ width: 46, whiteSpace: "nowrap", color: MUTED })}>
                    <span style={{ cursor: "grab", display: "inline-flex", verticalAlign: "middle" }} title="Ziehen zum Umsortieren"><GripVertical size={13} /></span>
                    <button style={{ ...S.smallBtn, padding: "0 1px", background: "none", border: "none" }} disabled={i === 0} onClick={() => schritt(i, -1)} title="Nach oben"><ChevronUp size={11} /></button>
                    <button style={{ ...S.smallBtn, padding: "0 1px", background: "none", border: "none" }} disabled={i === zeilen.length - 1} onClick={() => schritt(i, 1)} title="Nach unten"><ChevronDown size={11} /></button>
                  </td>
                  <td style={td({ color: SUB, width: 22 })}>{z.nr}</td>
                  <td style={td({ width: 28 })}>{dev && <IconView icon={dev.icon} customIcons={P.icons} color={katColor(dev.kategorie)} size={20} />}</td>
                  <td style={td({ minWidth: 150, cursor: "pointer" })} title={z.abteilung} onClick={() => onSelectDevice(z.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <StatusDot st={status[z.id]} size={8} />
                      <span style={{ fontWeight: z.isSwitch ? 800 : 600, whiteSpace: "nowrap", color: STRONG }}>{z.name}</span>
                      {(() => { const iss = devIssues(z.id); const sev = iss.some((x) => x.sev === "error") ? ERR : iss.some((x) => x.sev === "warn") ? WARN : null;
                        return sev && <span style={{ color: sev, display: "inline-flex" }} title={iss.map((x) => x.msg).join("\n")}><TriangleAlert size={14} /></span>; })()}
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{[z.modell, z.netzname, z.stapel && `Stapel ${z.stapel}`].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td style={td({ whiteSpace: "nowrap" })}>
                    {z.ipPorts.length === 0 && <span style={{ color: MUTED }}>–</span>}
                    {sicht.map((p) => {
                      const falsch = p.ip && ip2int(p.ip) === null;
                      const gesteckt = z.aufSwitch && p.id === z.eigenerPort && z.ipPorts.length > 1;
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, height: ZEILE }}>
                          <span style={{ fontSize: 10, color: gesteckt ? STRONG : MUTED, fontWeight: gesteckt ? 700 : 400, width: PORT_W, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", display: "inline-flex", alignItems: "center", gap: 3 }}
                            title={gesteckt ? `${p.name}: steckt am Switch` : p.name}>{gesteckt && <Cable size={10} style={{ flexShrink: 0 }} />}{z.ipPorts.length > 1 ? p.name : ""}</span>
                          {p.dhcp ? <span style={{ fontSize: 11, color: SUB }}>DHCP</span>
                            : <input style={{ ...ein, ...mono, width: 112, ...(falsch ? { borderColor: ERR } : {}) }} value={p.ip} placeholder="IP" title={falsch ? "Keine gültige IPv4-Adresse" : undefined}
                                onChange={(e) => { const v = e.target.value.trim(); geraet((g) => { const port = g.ports.find((x) => x.id === p.id); if (port) port.ip = v; }, z.id); }} />}
                          {p.vlan != null && <span style={{ fontSize: 10, color: MUTED }}>V{p.vlan}</span>}
                        </div>
                      );
                    })}
                    {rest > 0 && <button style={{ background: "none", border: "none", padding: 0, marginLeft: PORT_W + 4, fontSize: 10, color: MUTED, cursor: "pointer" }} title="Weitere Ports ohne IP zeigen"
                      onClick={() => setAlleIps((s) => new Set(s).add(z.id))}>+ {rest} weitere</button>}
                  </td>
                  <td style={td({ whiteSpace: "nowrap", paddingTop: 3 + steckZeile * ZEILE })}>
                    <select style={{ ...ein, width: 120 }} value={z.aufSwitch || ""} title="Switch"
                      onChange={(e) => { const sw = ziele.find((s) => s.id === e.target.value); umstecken(z, e.target.value, sw?.ports[0]?.id); }}>
                      <option value="">– nicht gesteckt –</option>
                      {ziele.map((s) => <option key={s.id} value={s.id} disabled={!s.ports.length && s.id !== z.aufSwitch}>{s.name}{!s.ports.length ? " (voll)" : ""}</option>)}
                    </select>
                    {z.aufSwitch && <select style={{ ...ein, width: 62, marginLeft: 3 }} value={z.aufPort || ""} title="Port am Switch"
                      onChange={(e) => umstecken(z, z.aufSwitch, e.target.value)}>
                      {(ziel?.ports || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>}
                    {z.aufSwitch && (dev?.ports || []).length > 1 && <div style={{ fontSize: 10, color: MUTED }}>am Gerät: {dev.ports.find((p) => p.id === z.eigenerPort)?.name || "?"}</div>}
                  </td>
                  <td style={td()}>
                    <AuswahlFeld style={{ ...ein, width: 96 }} optionen={standorte} value={dev?.bereich || ""} placeholder="Standort"
                      onChange={(v) => geraet((g) => { g.bereich = v; }, z.id)} />
                  </td>
                  {felder.length > 0 && <td style={td()}>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(felder.length, 3)}, 92px)`, gap: 2 }}>
                      {felder.map((f) => <input key={f.id} style={ein} value={feldWert(dev, f.id)} placeholder={f.name} title={f.name}
                        onChange={(e) => { const v = e.target.value; geraet((g) => setzeFeld(g, f, v), z.id); }} />)}
                    </div>
                  </td>}
                  <td style={td({ minWidth: 160 })}>
                    <input style={{ ...ein, width: "100%" }} value={z.notizen} placeholder="Notiz …"
                      onChange={(e) => { const v = e.target.value; geraet((g) => { g.notizen = v; }, z.id); }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!zeilen.length && <div style={S.empty}>{alle.length ? "Kein Gerät passt zum Filter." : "Noch keine Geräte."}</div>}
      <div style={S.hint}>Aufbau-Reihenfolge vom Haupt-Switch aus, Geräte eines Switches nach Portnummer, Stapel zusammen. Zum Umsortieren ziehen oder die Pfeile nutzen. Umstecken nimmt Kabelart, Länge und Label mit. Im PDF bekommt jede Zeile Platz für Notizen vor Ort und ein Kästchen zum Abhaken.</div>
    </>
  );
}

// Knöpfe für den Kopf der Geräteliste, solange die Patch-Ansicht offen ist
export function PatchKnoepfe({ P, mutate, onExport }) {
  const manuell = (P.patchliste?.reihenfolge || []).length > 0;
  return <>
    <button style={S.ghostBtn} disabled={!manuell} onClick={() => mutate((d) => { delete d.patchliste; })} title="Von Hand gesetzte Reihenfolge verwerfen und wieder nach Aufbau-Logik sortieren"><RotateCcw size={14} />Automatisch sortieren</button>
    <button style={S.ghostBtn} onClick={() => onExport("patch-pdf")} title="Patchliste als PDF zum Ausdrucken, mit Platz für Notizen vor Ort"><Printer size={14} />PDF</button>
    <button style={S.ghostBtn} onClick={() => onExport("patch-csv")} title="Patchliste als CSV (Excel, Numbers)"><FileSpreadsheet size={14} />CSV</button>
  </>;
}
