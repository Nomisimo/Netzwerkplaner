import React, { useState, useMemo } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, OK, INFO, WARN, TYPEN, katColor, DARK, INPUT, TEXT } from "../../shared/constants.js";
import { KATALOG, KATALOG_GERAETE, PROTOKOLLE, findProtokoll, uid, ipPorts, physPorts } from "../../shared/catalog.js";
import { Section, KatChip, Toggle } from "../ui.jsx";
import { IconView, ICON_NAMES } from "../icons.jsx";
import { api } from "../api.js";
import BestandView from "./BestandView.jsx";
import GeraetAnlegen from "../GeraetAnlegen.jsx";
import { newFeld, feldUmbenennen, feldEntfernen } from "../../shared/felder.js";
import { Link, Check, X as XIcon, ChevronUp, ChevronDown } from "lucide-react";

const FLAG_LABELS = [
  ["p2p", "Punkt-zu-Punkt, nicht über Switch", ERR],
  ["kein_ip", "kein IP", ERR],
  ["multicast", "Multicast/Broadcast", INFO],
  ["igmp", "IGMP nötig", WARN],
  ["ptp", "PTP-Takt", INFO],
  ["eee", "EEE aus", WARN],
  ["l2", "nur Layer 2", WARN],
  ["lokal", "nur lokal (nicht routbar)", MUTED],
];

export function ProtokollDetail({ p, P, onSelectDevice }) {
  const r = p.raw;
  const inProject = P.geraete.filter((d) => (d.protokolle || []).some((s) => findProtokoll(s)?.id === p.id));
  const inKatalog = KATALOG_GERAETE.filter((g) => (g.raw.Protokolle || "").split(/,(?![^(]*\))/).some((s) => findProtokoll(s.trim())?.id === p.id));
  const fields = ["Hersteller / Gremium", "Lizenz", "Norm / Version", "Schicht / Transport", "Ports", "Multicast / Broadcast", "Discovery (mDNS, SLP …)", "Takt / Sync", "Funktionsweise", "Netzwerk-Anforderungen", "Default-IP / Adressierung", "Über Switch / routbar?", "Web-UI / Tools"];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ ...S.h2, fontSize: 19 }}>{p.name}</h2>
        <span style={S.chip}>{p.kategorie}</span>
        <span style={{ ...S.badge, background: p.flags.geprueft ? OK + "22" : WARN + "22", color: p.flags.geprueft ? OK : WARN }}>{r.Datenstand}</span>
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "10px 0" }}>
        {FLAG_LABELS.filter(([k]) => p.flags[k]).map(([k, l, c]) => <span key={k} style={{ ...S.chip, borderColor: c + "99", color: c }}>{l}</span>)}
      </div>
      <table style={{ ...S.table, marginTop: 0 }}><tbody>
        {fields.map((f) => r[f] && r[f] !== "–" ? (
          <tr key={f}><td style={{ ...S.td, color: SUB, width: 190, verticalAlign: "top", fontSize: 12 }}>{f}</td><td style={{ ...S.td, fontSize: 13, lineHeight: 1.45, fontFamily: f === "Ports" ? "Consolas,monospace" : undefined }}>{r[f]}</td></tr>
        ) : null)}
        {r.Dokumentation && <tr><td style={{ ...S.td, color: SUB, fontSize: 12 }}>Dokumentation</td><td style={S.td}><a style={{ color: ACCENT, cursor: "pointer", wordBreak: "break-all" }} onClick={() => api.openExternal(r.Dokumentation)}>{r.Dokumentation}</a></td></tr>}
      </tbody></table>
      {inProject.length > 0 && <>
        <div className="sp-section-label" style={{ marginTop: 16 }}>Im Projekt ({inProject.length})</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{inProject.map((d) => <span key={d.id} style={{ ...S.chip, cursor: "pointer" }} onClick={() => onSelectDevice(d.id)}>{d.name}</span>)}</div>
      </>}
      {inKatalog.length > 0 && <>
        <div className="sp-section-label" style={{ marginTop: 16 }}>Geräte im Katalog ({inKatalog.length})</div>
        <div style={{ fontSize: 12, color: SUB, lineHeight: 1.6 }}>{inKatalog.map((g) => `${g.hersteller} ${g.modell}`).join(" · ")}</div>
      </>}
    </div>
  );
}

export default function BibliothekTab({ P, mutate, library, setLibrary, protoId, setProtoId, onAddDevice, onSelectDevice, sub, setSub, allIcons, onSaveAlleBestand, notify }) {
  const [q, setQ] = useState("");
  const [kat, setKat] = useState("");
  const [herst, setHerst] = useState("");
  const [nurFokus, setNurFokus] = useState(true);
  const [open, setOpen] = useState(null);
  const [neueVorlage, setNeueVorlage] = useState(false);
  const ql = q.toLowerCase();

  const protos = useMemo(() => PROTOKOLLE.filter((p) => (!kat || p.kategorie === kat) && (!ql || `${p.name} ${p.raw.Ports} ${p.raw["Hersteller / Gremium"]}`.toLowerCase().includes(ql))), [ql, kat]);
  const geraete = useMemo(() => KATALOG_GERAETE.filter((g) => (!nurFokus || g.fokus) && (!herst || g.hersteller === herst) && (!kat || g.kategorie === kat) && (!ql || `${g.hersteller} ${g.modell} ${g.geraetetyp} ${g.raw.Protokolle}`.toLowerCase().includes(ql))), [ql, herst, kat]);
  const cur = PROTOKOLLE.find((p) => p.id === protoId) || protos[0];
  const hersteller = [...new Set(KATALOG_GERAETE.filter((g) => !nurFokus || g.fokus).map((g) => g.hersteller))].sort((a, b) => a.localeCompare(b, "de"));

  const uploadIcon = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 300 * 1024) return alert("Icon ist zu groß (max. 300 KB).");
    const r = new FileReader();
    r.onload = () => {
      const icon = { id: uid(), name: f.name.replace(/\.[^.]+$/, ""), data: r.result };
      setLibrary((l) => ({ ...l, icons: [...(l.icons || []), icon] }));
      mutate((d) => d.icons.push(icon));
    };
    r.readAsDataURL(f);
  };

  const TABS = [["bestand", `Gerätebestand (${library.bestand?.length || 0})`], ["vorlagen", `Eigene Vorlagen (${library.vorlagen?.length || 0})`], ["katalog", `Herstellergeräte (${KATALOG_GERAETE.length})`], ["protokolle", `Protokolle (${PROTOKOLLE.length})`], ["felder", `Eigene Felder (${library.felder?.length || 0})`], ["icons", "Icons"]];

  return (
    <>
      <div style={S.boxTabs}>
        {TABS.map(([k, l]) => <button key={k} style={{ ...S.boxTab, ...(sub === k ? S.boxTabActive : {}) }} onClick={() => { setSub(k); setKat(""); setQ(""); }}>{l}</button>)}
      </div>

      {sub === "protokolle" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
          <Section style={{ position: "sticky", top: 12, maxHeight: "calc(100vh - 170px)", display: "flex", flexDirection: "column", padding: 14 }}>
            <input style={{ ...S.inputSm, marginBottom: 6 }} placeholder="Protokoll oder Port (z. B. 6454)" value={q} onChange={(e) => setQ(e.target.value)} />
            <select style={{ ...S.selectSm, marginBottom: 8 }} value={kat} onChange={(e) => setKat(e.target.value)}>
              <option value="">Alle Kategorien</option>{[...new Set(PROTOKOLLE.map((p) => p.kategorie))].map((k) => <option key={k}>{k}</option>)}
            </select>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {protos.map((p) => (
                <div key={p.id} onClick={() => setProtoId(p.id)} style={{ padding: "6px 8px", borderRadius: 5, cursor: "pointer", fontSize: 13, background: cur?.id === p.id ? ACCENT : "transparent", color: cur?.id === p.id ? DARK : TEXT, fontWeight: cur?.id === p.id ? 700 : 400, display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  {p.flags.p2p && <span title="Punkt-zu-Punkt" style={{ display: "inline-flex" }}><Link size={12} /></span>}
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{p.kategorie}</span>
                </div>
              ))}
            </div>
          </Section>
          <Section>{cur ? <ProtokollDetail p={cur} P={P} onSelectDevice={onSelectDevice} /> : <p style={S.empty}>Kein Protokoll gefunden.</p>}</Section>
        </div>
      )}

      {sub === "katalog" && (
        <Section title="Herstellergeräte" subtitle={`Stand ${KATALOG.stand} · ${geraete.length} Modelle. Fokus-Hersteller (${(KATALOG.fokus || []).join(", ")}) sind gegen Herstellerdoku recherchiert; der Datenstand steht je Modell in den Details.`}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input style={{ ...S.inputSm, flex: 1, minWidth: 200 }} placeholder="Hersteller, Modell, Typ, Protokoll" value={q} onChange={(e) => setQ(e.target.value)} />
            <select style={{ ...S.selectSm, width: "auto" }} value={herst} onChange={(e) => setHerst(e.target.value)}><option value="">Alle Hersteller</option>{hersteller.map((h) => <option key={h}>{h}</option>)}</select>
            <select style={{ ...S.selectSm, width: "auto" }} value={kat} onChange={(e) => setKat(e.target.value)}><option value="">Alle Bereiche</option>{["Ton", "Licht", "Bild", "Netzwerk", "Bühne", "Intercom"].map((k) => <option key={k}>{k}</option>)}</select>
            <Toggle checked={nurFokus} onChange={(c) => { setNurFokus(c); setHerst(""); }} label="nur Fokus-Hersteller" />
          </div>
          <table style={S.table}>
            <thead><tr><th style={S.th}></th><th style={S.th}>Hersteller / Modell</th><th style={S.th}>Typ</th><th style={S.th}>Ports</th><th style={S.th}>Web-UI</th><th style={S.th}></th></tr></thead>
            <tbody>
              {geraete.map((g) => (
                <React.Fragment key={g.id}>
                  <tr style={{ cursor: "pointer" }} onClick={() => setOpen(open === g.id ? null : g.id)}>
                    <td style={S.td}><IconView icon={TYPEN[g.typ]?.icon} color={katColor(g.kategorie)} size={20} /></td>
                    <td style={S.td}><div style={{ fontWeight: 600 }}>{g.modell}{g.fokus && /geprüft/i.test(g.raw.Datenstand || "") && <span title={g.raw.Datenstand} style={{ color: OK, marginLeft: 6, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 3 }}><Check size={12} /> geprüft</span>}</div><div style={{ fontSize: 11, color: MUTED }}>{g.hersteller}</div></td>
                    <td style={{ ...S.td, fontSize: 12 }}>{g.geraetetyp}</td>
                    <td style={{ ...S.td, fontSize: 12 }}>{g.raw["Netzwerkports (Anzahl)"]}</td>
                    <td style={{ ...S.td, fontSize: 12 }}>{g.raw["Web-UI"]}</td>
                    <td style={S.td}><button style={S.smallBtn} onClick={(e) => { e.stopPropagation(); onAddDevice({ kind: "katalog", key: g.id }, {}); }}>+ ins Projekt</button></td>
                  </tr>
                  {open === g.id && (
                    <tr><td colSpan="6" style={{ ...S.td, background: INPUT }}>
                      <table style={{ ...S.table, marginTop: 0, fontSize: 12 }}><tbody>
                        {Object.entries(g.raw).filter(([k, v]) => v && !["Hersteller", "Modell"].includes(k)).map(([k, v]) => (
                          <tr key={k}><td style={{ ...S.td, color: SUB, width: 190 }}>{k}</td><td style={S.td}>{k === "Protokolle" ? v.split(/,(?![^(]*\))/).map((s) => s.trim()).map((s, i) => {
                            const r = findProtokoll(s);
                            return <span key={i} style={{ ...S.chip, marginRight: 4, marginBottom: 3, cursor: r ? "pointer" : "default", borderColor: r ? ACCENT + "66" : LINE }} onClick={() => r && (setProtoId(r.id), setSub("protokolle"))}>{s}</span>;
                          }) : v}</td></tr>
                        ))}
                      </tbody></table>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {sub === "bestand" && <BestandView P={P} library={library} setLibrary={setLibrary} onAddDevice={onAddDevice} onSelectDevice={onSelectDevice} onSaveAlleBestand={onSaveAlleBestand} allIcons={allIcons} notify={notify} />}

      {sub === "vorlagen" && (
        <Section title="Eigene Vorlagen" right={<button style={S.primaryBtn} onClick={() => setNeueVorlage(true)}>+ Neue Vorlage</button>} subtitle="Vorlagen sind Gerätetypen ohne Adressen (Ports, VLANs, Protokolle). Für konkrete Geräte mit IPs gibt es den Gerätebestand. Mit „+ Neue Vorlage“ anlegen oder im Geräte-Editor mit „Vorlage“ speichern. Vorlagen liegen im Katalog der App und stehen in jedem Projekt zur Verfügung.">
          {neueVorlage && <GeraetAnlegen P={P} ziel="vorlage" onClose={() => setNeueVorlage(false)} onSave={(v) => { setLibrary((l) => ({ ...l, vorlagen: [...(l.vorlagen || []), v] })); setNeueVorlage(false); notify(`Vorlage „${v.name}“ angelegt.`); }} />}
          {!(library.vorlagen || []).length && <p style={S.empty}>Noch keine eigenen Vorlagen.</p>}
          {(library.vorlagen || []).map((v) => (
            <div key={v.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
              <IconView icon={v.geraet.icon} customIcons={allIcons} color={katColor(v.geraet.kategorie)} />
              <input style={{ ...S.inputSm, maxWidth: 300 }} value={v.name} onChange={(e) => setLibrary((l) => ({ ...l, vorlagen: l.vorlagen.map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x)) }))} />
              <span style={{ fontSize: 11, color: MUTED, flex: 1 }}>{v.geraet.hersteller} {v.geraet.modell} · {physPorts(v.geraet).length} Ports · {ipPorts(v.geraet).filter((i) => i.ip || i.dhcp || i.virtuell).length} mit IP</span>
              <button style={S.smallBtn} onClick={() => onAddDevice({ kind: "vorlage", key: v.id }, {})}>+ ins Projekt</button>
              <button style={S.dangerBtn} onClick={() => confirm(`Vorlage „${v.name}“ löschen?`) && setLibrary((l) => ({ ...l, vorlagen: l.vorlagen.filter((x) => x.id !== v.id) }))}><XIcon size={14} /></button>
            </div>
          ))}
        </Section>
      )}

      {sub === "felder" && <FelderView P={P} mutate={mutate} library={library} setLibrary={setLibrary} />}

      {sub === "icons" && (
        <Section title="Icons" subtitle="Mitgelieferte Geräte-Icons und eigene Uploads (SVG oder PNG, max. 300 KB). Eigene Icons werden im Katalog und in der Projektdatei gespeichert, damit das Projekt auf anderen Rechnern gleich aussieht."
          right={<label style={{ ...S.primaryBtn, display: "inline-block" }}>+ Icon hochladen<input type="file" accept=".svg,.png,image/svg+xml,image/png" style={{ display: "none" }} onChange={uploadIcon} /></label>}>
          <div className="sp-section-label">Mitgeliefert ({ICON_NAMES.length})</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 8 }}>
            {ICON_NAMES.map((n) => (
              <div key={n} style={{ background: INPUT, border: `1px solid ${LINE}`, borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <IconView icon={n} size={32} color={TEXT} /><span style={{ fontSize: 10, color: SUB }}>{n}</span>
              </div>
            ))}
          </div>
          <div className="sp-section-label" style={{ marginTop: 18 }}>Eigene ({allIcons.length})</div>
          {!allIcons.length && <p style={S.empty}>Noch keine eigenen Icons.</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 8 }}>
            {allIcons.map((ic) => (
              <div key={ic.id} style={{ background: INPUT, border: `1px solid ${LINE}`, borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <img src={ic.data} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
                <span style={{ fontSize: 10, color: SUB, textAlign: "center", wordBreak: "break-all" }}>{ic.name}</span>
                <button style={{ ...S.dangerBtn, padding: "1px 6px", fontSize: 10 }} onClick={() => {
                  if (!confirm(`Icon „${ic.name}“ entfernen? Geräte damit bekommen wieder ihr Standard-Icon.`)) return;
                  setLibrary((l) => ({ ...l, icons: (l.icons || []).filter((x) => x.id !== ic.id) }));
                  mutate((d) => { d.icons = d.icons.filter((x) => x.id !== ic.id); d.geraete.forEach((g) => { if (g.icon === "custom:" + ic.id) g.icon = TYPEN[g.typ]?.icon || "sonstiges"; }); });
                }}>entfernen</button>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/* Eigene Felder: frei benannte Gerätefelder (z. B. Inventar-Nr., Seriennummer, Case), die im
   Geräte-Editor eingefügt und ausgefüllt werden. Umbenennen und Löschen wirkt auf Projekt und Bestand. */
function FelderView({ P, mutate, library, setLibrary }) {
  const [neu, setNeu] = useState("");
  const felder = library.felder || [];
  const libGeraete = (l) => [...(l.bestand || []).map((b) => b.geraet), ...(l.vorlagen || []).map((v) => v.geraet)];
  const nutzung = (id) => {
    const imProjekt = P.geraete.filter((g) => (g.felder || []).some((f) => f.id === id)).length;
    const imKatalog = libGeraete(library).filter((g) => (g?.felder || []).some((f) => f.id === id)).length;
    return { imProjekt, imKatalog };
  };
  const anlegen = () => {
    const name = neu.trim();
    if (!name) return;
    if (felder.some((f) => f.name.toLowerCase() === name.toLowerCase())) return alert(`Das Feld „${name}“ gibt es schon.`);
    setLibrary((l) => ({ ...l, felder: [...(l.felder || []), newFeld(name)] }));
    setNeu("");
  };
  const umbenennen = (id, name) => {
    setLibrary((l) => {
      const n = JSON.parse(JSON.stringify(l));
      n.felder = n.felder.map((f) => (f.id === id ? { ...f, name } : f));
      feldUmbenennen(libGeraete(n), id, name);
      return n;
    });
    mutate((d) => feldUmbenennen(d.geraete, id, name));
  };
  const loeschen = (f) => {
    const { imProjekt, imKatalog } = nutzung(f.id);
    const wo = [imProjekt && `${imProjekt} Projektgerät${imProjekt > 1 ? "en" : ""}`, imKatalog && `${imKatalog} Gerät${imKatalog > 1 ? "en" : ""} in Bestand/Vorlagen`].filter(Boolean).join(" und ");
    if (!confirm(`Feld „${f.name}“ löschen?${wo ? `\nEs wird mit seinen Werten aus ${wo} entfernt.` : ""}`)) return;
    setLibrary((l) => {
      const n = JSON.parse(JSON.stringify(l));
      n.felder = n.felder.filter((x) => x.id !== f.id);
      feldEntfernen(libGeraete(n), f.id);
      return n;
    });
    if (imProjekt) mutate((d) => feldEntfernen(d.geraete, f.id));
  };
  const verschieben = (i, r) => setLibrary((l) => {
    const a = [...(l.felder || [])];
    const j = i + r;
    if (j < 0 || j >= a.length) return l;
    [a[i], a[j]] = [a[j], a[i]];
    return { ...l, felder: a };
  });
  return (
    <Section title="Eigene Felder" subtitle="Eigene Felder legst du einmal hier an und fügst sie im Geräte-Editor unter „Eigene Felder“ bei den Geräten ein, die sie brauchen, z. B. Inventar-Nr., Seriennummer, Case, Eigentümer oder Prüfdatum. Die Werte stehen in der Projektdatei, im Gerätebestand, in den Exporten und können als Titel in der Topologie erscheinen.">
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input style={{ ...S.inputSm, maxWidth: 300 }} placeholder="Name des neuen Felds, z. B. Seriennummer" value={neu} onChange={(e) => setNeu(e.target.value)} onKeyDown={(e) => e.key === "Enter" && anlegen()} />
        <button style={S.primaryBtn} onClick={anlegen} disabled={!neu.trim()}>+ Feld anlegen</button>
      </div>
      {!felder.length && <p style={S.empty}>Noch keine eigenen Felder.</p>}
      {felder.map((f, i) => {
        const { imProjekt, imKatalog } = nutzung(f.id);
        return (
          <div key={f.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
            <input style={{ ...S.inputSm, maxWidth: 300 }} value={f.name} onChange={(e) => umbenennen(f.id, e.target.value)} />
            <span style={{ fontSize: 11, color: MUTED, flex: 1 }}>{imProjekt} im Projekt · {imKatalog} in Bestand/Vorlagen</span>
            <button style={{ ...S.smallBtn, padding: "3px 7px" }} disabled={i === 0} onClick={() => verschieben(i, -1)} title="nach oben"><ChevronUp size={12} /></button>
            <button style={{ ...S.smallBtn, padding: "3px 7px" }} disabled={i === felder.length - 1} onClick={() => verschieben(i, 1)} title="nach unten"><ChevronDown size={12} /></button>
            <button style={S.dangerBtn} onClick={() => loeschen(f)}><XIcon size={14} /></button>
          </div>
        );
      })}
    </Section>
  );
}
