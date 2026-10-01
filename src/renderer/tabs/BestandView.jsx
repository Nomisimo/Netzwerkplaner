import React, { useState, useMemo, useRef } from "react";
import { S, LINE, SUB, MUTED, OK, KATEGORIEN, TYPEN, katColor } from "../../shared/constants.js";
import { uid, migrateBestand } from "../../shared/catalog.js";
import { Section } from "../ui.jsx";
import { IconView } from "../icons.jsx";
import { api } from "../api.js";
import { bestandZuCsv, csvZuBestand } from "../../shared/bestandcsv.js";
import GeraetAnlegen from "../GeraetAnlegen.jsx";
import { Download, X as XIcon, Check } from "lucide-react";

const datum = (iso) => (iso ? new Date(iso).toLocaleDateString("de-DE") : "");

/* Gerätebestand: konkrete eigene Geräte mit Name, IPs, MACs, Ports und eigenen Feldern,
   die sich direkt (inkl. Adressen) in ein Projekt einfügen lassen. */
export default function BestandView({ P, library, setLibrary, onAddDevice, onSelectDevice, onSaveAlleBestand, allIcons, notify }) {
  const [q, setQ] = useState("");
  const [kat, setKat] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [anlegen, setAnlegen] = useState(false);
  const fileRef = useRef(null);
  const bestand = library.bestand || [];
  const ql = q.toLowerCase();

  const imProjekt = useMemo(() => {
    const m = new Map();
    for (const d of P.geraete) if (d.bestandId) m.set(d.bestandId, d);
    return m;
  }, [P.geraete]);

  const list = useMemo(() => bestand.filter((b) => {
    const g = b.geraet;
    if (kat && g.kategorie !== kat) return false;
    return !ql || `${b.name} ${g.netzname || ""} ${g.hersteller} ${g.modell} ${g.ports.map((i) => (i.ip || "") + " " + (i.mac || "")).join(" ")} ${(g.felder || []).map((f) => f.wert).join(" ")}`.toLowerCase().includes(ql);
  }).sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true })), [bestand, ql, kat]);

  const setName = (id, name) => setLibrary((l) => ({ ...l, bestand: l.bestand.map((b) => (b.id === id ? { ...b, name, geraet: { ...b.geraet, name } } : b)) }));
  const remove = (ids) => {
    if (!confirm(ids.length > 1 ? `${ids.length} Geräte aus dem Bestand löschen?` : `„${bestand.find((b) => b.id === ids[0])?.name}“ aus dem Bestand löschen?`)) return;
    setLibrary((l) => ({ ...l, bestand: l.bestand.filter((b) => !ids.includes(b.id)) }));
    setSel(new Set());
  };
  const einfuegen = (ids) => {
    let last = null;
    for (const id of ids) last = onAddDevice({ kind: "bestand", key: id }, {}) || last;
    if (ids.length > 1) notify(`${ids.length} Geräte aus dem Bestand eingefügt.`);
    setSel(new Set());
    return last;
  };
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const exportJson = () => api.saveFile(JSON.stringify({ format: "netzwerkplaner-bestand", version: 1, bestand, icons: library.icons || [] }, null, 2), "Gerätebestand.json", [{ name: "JSON", extensions: ["json"] }], "utf8");
  const exportCsv = () => api.saveFile(bestandZuCsv(bestand, library.felder), "Gerätebestand.csv", [{ name: "CSV", extensions: ["csv"] }], "utf8");
  const importDatei = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      if (/\.(csv|txt|tsv)$/i.test(f.name) || !/^\s*\{/.test(r.result)) {
        const { bestand: neu, fehler } = csvZuBestand(r.result, P.vlans, library.felder);
        if (!neu.length) return notify("In der CSV wurden keine Geräte gefunden. Erste Zeile muss die Spaltennamen enthalten (mindestens „Name“).", "err");
        setLibrary((l) => ({ ...l, bestand: [...(l.bestand || []), ...neu] }));
        const ohne = neu.filter((b) => !b.geraet.katalogId).length;
        return notify(`${neu.length} Geräte aus CSV in den Bestand importiert${ohne ? `, ${ohne} ohne Katalogmodell (generischer Typ)` : ""}${fehler.length ? `, ${fehler.length} Zeilen übersprungen` : ""}.`);
      }
      try {
        const data = JSON.parse(r.result);
        const neu = migrateBestand((data.bestand || []).filter((b) => b?.geraet?.ports || b?.geraet?.interfaces)); // ältere Dateien mit getrennten Interfaces
        if (!neu.length) throw new Error("leer");
        setLibrary((l) => {
          const ids = new Set((l.bestand || []).map((b) => b.id));
          const icons = [...(l.icons || [])];
          for (const ic of data.icons || []) if (!icons.some((x) => x.id === ic.id)) icons.push(ic);
          return { ...l, icons, bestand: [...(l.bestand || []), ...neu.map((b) => (ids.has(b.id) ? { ...b, id: uid() } : b))] };
        });
        notify(`${neu.length} Geräte in den Bestand importiert.`);
      } catch { notify("Keine gültige Bestandsdatei.", "err"); }
    };
    r.readAsText(f);
  };

  const selIds = [...sel].filter((id) => bestand.some((b) => b.id === id));

  return (
    <Section title={`Gerätebestand (${bestand.length})`}
      subtitle="Deine eigenen Geräte mit Name, Netzwerkname, IPs, MACs, Ports und eigenen Feldern. Speichern im Geräte-Editor mit „In Bestand“. Beim Einfügen bleiben IPs und Einstellungen erhalten; VLANs werden über die VLAN-ID zugeordnet."
      right={<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button style={S.secondaryBtn} onClick={onSaveAlleBestand} title="Alle Geräte dieses Projekts, die noch nicht im Bestand sind, übernehmen"><Download size={14} /> Projektgeräte übernehmen</button>
        <button style={S.primaryBtn} onClick={() => setAnlegen(true)}>+ Neues Gerät</button>
        <button style={S.secondaryBtn} onClick={exportCsv} disabled={!bestand.length} title="Als CSV (Excel, andere Netzwerkplaner-Installationen)">Export CSV</button>
        <button style={S.secondaryBtn} onClick={exportJson} disabled={!bestand.length} title="Als JSON mit eigenen Icons">Export JSON</button>
        <button style={S.secondaryBtn} onClick={() => fileRef.current?.click()} title="CSV oder JSON aus einer anderen Installation oder einer eigenen Liste">Import</button>
        <input ref={fileRef} type="file" accept=".json,.csv,.tsv,.txt,application/json,text/csv" style={{ display: "none" }} onChange={importDatei} />
      </div>}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <input style={{ ...S.inputSm, flex: 1, minWidth: 180 }} placeholder="Name, IP, MAC, Modell, eigene Felder" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ ...S.selectSm, width: "auto" }} value={kat} onChange={(e) => setKat(e.target.value)}>
          <option value="">Alle Bereiche</option>{Object.keys(KATEGORIEN).map((k) => <option key={k}>{k}</option>)}
        </select>
        {selIds.length > 0 && <>
          <button style={S.primaryBtn} onClick={() => einfuegen(selIds)}>+ {selIds.length} ins Projekt</button>
          <button style={S.dangerBtn} onClick={() => remove(selIds)}><XIcon size={14} /> {selIds.length} löschen</button>
        </>}
      </div>
      {!bestand.length ? (
        <p style={S.empty}>Noch keine Geräte im Bestand. Öffne ein Gerät im Geräte-Editor und klicke „In Bestand“, oder übernimm alle Geräte dieses Projekts mit dem Knopf oben rechts.</p>
      ) : !list.length ? <p style={S.empty}>Kein Gerät passt zum Filter.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead><tr>
              <th style={{ ...S.th, width: 26 }}><input type="checkbox" checked={list.length > 0 && list.every((b) => sel.has(b.id))} onChange={(e) => setSel(e.target.checked ? new Set(list.map((b) => b.id)) : new Set())} /></th>
              <th style={{ ...S.th, width: 30 }}></th><th style={S.th}>Name</th><th style={S.th}>IPs</th><th style={S.th}>Eigene Felder</th><th style={S.th}>Stand</th><th style={S.th}></th>
            </tr></thead>
            <tbody>
              {list.map((b) => {
                const g = b.geraet;
                const drin = imProjekt.get(b.id);
                return (
                  <tr key={b.id} style={{ background: sel.has(b.id) ? "#ffffff08" : undefined }}>
                    <td style={S.td}><input type="checkbox" checked={sel.has(b.id)} onChange={() => toggle(b.id)} /></td>
                    <td style={S.td}><IconView icon={g.icon} customIcons={allIcons} color={katColor(g.kategorie)} size={20} /></td>
                    <td style={S.td}>
                      <input style={{ ...S.inputSm, fontWeight: 600, maxWidth: 220 }} value={b.name} onChange={(e) => setName(b.id, e.target.value)} />
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{[g.hersteller, g.modell].filter(Boolean).join(" ") || TYPEN[g.typ]?.label}{g.netzname ? ` · ${g.netzname}` : ""}</div>
                    </td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>
                      {g.ports.filter((i) => i.ip || i.dhcp).map((i) => <div key={i.id}>{i.dhcp ? "DHCP" : i.ip}<span style={{ color: MUTED }}>{i.vid != null ? ` · VLAN ${i.vid}` : ""} · {i.name}</span></div>)}
                      {!g.ports.some((i) => i.ip || i.dhcp) && <span style={{ color: MUTED }}>–</span>}
                    </td>
                    <td style={{ ...S.td, fontSize: 12 }}>
                      {(g.felder || []).filter((f) => f.wert).map((f, n) => <div key={f.id} style={n ? { color: SUB } : undefined}><span style={{ color: MUTED }}>{f.name}:</span> {f.wert}</div>)}
                    </td>
                    <td style={{ ...S.td, fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{datum(b.geaendert || b.angelegt)}</td>
                    <td style={{ ...S.td, whiteSpace: "nowrap", textAlign: "right" }}>
                      {drin
                        ? <button style={{ ...S.smallBtn, borderColor: OK + "88", color: OK }} onClick={() => onSelectDevice(drin.id)} title="Ist bereits im Projekt – zum Gerät springen"><Check size={14} /> im Projekt</button>
                        : <button style={S.smallBtn} onClick={() => einfuegen([b.id])}>+ ins Projekt</button>}
                      <button style={{ ...S.dangerBtn, marginLeft: 6, padding: "3px 8px" }} onClick={() => remove([b.id])}><XIcon size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {anlegen && <GeraetAnlegen P={P} ziel="bestand" onClose={() => setAnlegen(false)} onSave={(b) => { setLibrary((l) => ({ ...l, bestand: [...(l.bestand || []), b] })); setAnlegen(false); notify(`„${b.name}“ im Gerätebestand angelegt.`); }} />}
    </Section>
  );
}
