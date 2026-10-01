import React, { useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, OK, WARN } from "../../shared/constants.js";
import { KERN, defaultParams } from "../../shared/kernprotokolle.js";
import { KATALOG } from "../../shared/catalog.js";
import { ARTIKEL } from "../../shared/wissen.js";
import { fmtMbit } from "../../shared/analyse.js";
import { Section, Dot } from "../ui.jsx";
import { api } from "../api.js";
import ProtokollPoster from "../ProtokollPoster.jsx";
import { ExternalLink } from "lucide-react";

// Wikipedia-Artikel, soweit vorhanden
const WIKI = {
  dante: "https://en.wikipedia.org/wiki/Dante_(networking)",
  artnet: "https://en.wikipedia.org/wiki/Art-Net",
  sacn: "https://en.wikipedia.org/wiki/Architecture_for_Control_Networks",
  ndi: "https://en.wikipedia.org/wiki/Network_Device_Interface",
  osc: "https://de.wikipedia.org/wiki/Open_Sound_Control",
  igmp: "https://de.wikipedia.org/wiki/Internet_Group_Management_Protocol",
  qos: "https://de.wikipedia.org/wiki/Differentiated_Services",
  ptp: "https://de.wikipedia.org/wiki/Precision_Time_Protocol",
  eee: "https://en.wikipedia.org/wiki/Energy-Efficient_Ethernet",
  stp: "https://de.wikipedia.org/wiki/Spanning_Tree_Protocol",
  vlan: "https://de.wikipedia.org/wiki/Virtual_Local_Area_Network",
  jumbo: "https://de.wikipedia.org/wiki/Jumbo_Frame",
  osi: "https://de.wikipedia.org/wiki/OSI-Modell",
  mdns: "https://de.wikipedia.org/wiki/Zeroconf",
};
const WikiLink = ({ id }) => WIKI[id] ? <a href="#" style={{ color: "#8ec5ff", fontSize: 12, fontWeight: 400, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }} onClick={(e) => { e.preventDefault(); api.openExternal(WIKI[id]); }}>Wikipedia <ExternalLink size={12} /></a> : null;

// Recherche-Einträge (hardware/fokus) je Kernprotokoll
const RECHERCHE_NAMEN = { dante: ["Dante"], manet: ["MA-Net3", "MA-Net2", "MA-Net1"], artnet: ["Art-Net 4"], sacn: ["sACN (ANSI E1.31)"], ndi: ["NDI (NDI 5/6)"], osc: ["OSC (Open Sound Control)"], citp: ["CITP / MSEx"] };
const recherche = (id) => (RECHERCHE_NAMEN[id] || []).map((n) => (KATALOG.kernprotokolle || []).find((r) => r.Protokoll === n)).filter(Boolean);
const FELDER = [["Ports", "Ports"], ["Multicast", "Multicast / Broadcast"], ["Discovery", "Discovery"], ["Takt", "Takt"], ["Bandbreite_Formel", "Bandbreite (Rechenweg)"], ["Bandbreite_Beispiele", "Beispiele"], ["Paketrate", "Paketrate"], ["Latenz", "Latenz"], ["IGMP", "IGMP"], ["QoS_DSCP", "QoS / DSCP"], ["PTP", "PTP"], ["EEE", "EEE"], ["Analyse_Tools", "Analyse-Werkzeuge"], ["Stolpersteine", "Stolpersteine"]];
const ANF = [["igmp", "IGMP-Snooping"], ["qos", "QoS / DSCP"], ["ptp", "PTP"], ["eee", "EEE"], ["jumbo", "Jumbo-Frames"], ["stp", "Spanning Tree"]];

const Tabelle = ({ kopf, zeilen }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ ...S.table, fontSize: 12.5 }}>
      <thead><tr>{kopf.map((k) => <th key={k} style={S.th}>{k}</th>)}</tr></thead>
      <tbody>{zeilen.map((z, i) => <tr key={i}>{z.map((c, j) => <td key={j} style={{ ...S.td, verticalAlign: "top", fontWeight: j === 0 ? 600 : 400 }}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

const Links = ({ text }) => (
  <div style={{ fontSize: 11.5, lineHeight: 1.6 }}>
    {String(text).split(/\s*;\s*/).filter(Boolean).map((u, i) => /^https?:\/\//.test(u)
      ? <div key={i}><a href="#" style={{ color: "#8ec5ff", wordBreak: "break-all" }} onClick={(e) => { e.preventDefault(); api.openExternal(u); }}>{u}</a></div>
      : <div key={i}>{u}</div>)}
  </div>
);

function Block({ b }) {
  const P = { fontSize: 13.5, lineHeight: 1.6, color: "#dfe3e8", margin: "8px 0", maxWidth: 900 };
  if (b.t === "p") return <p style={P}>{b.x}</p>;
  if (b.t === "h") return <h3 style={{ fontSize: 14, color: ACCENT, margin: "18px 0 6px" }}>{b.x}</h3>;
  if (b.t === "ul") return <ul style={{ ...P, paddingLeft: 20 }}>{b.x.map((x, i) => <li key={i} style={{ marginBottom: 4 }}>{x}</li>)}</ul>;
  if (b.t === "hint") return <div style={{ ...P, borderLeft: `3px solid ${WARN}`, background: "#2a2418", padding: "8px 12px", borderRadius: 4 }}>{b.x}</div>;
  if (b.t === "table" && b.zeilen === "refs") return <Tabelle kopf={b.kopf} zeilen={(KATALOG.kernprotokolle || []).map((r) => [r.Protokoll, r.Ports, r.Multicast, r.Discovery || "–"])} />;
  if (b.t === "table") return <Tabelle kopf={b.kopf} zeilen={b.zeilen} />;
  if (b.t === "poster") return <ProtokollPoster />;
  if (b.t === "mdns") return <Tabelle kopf={["Service-Typ", "Protokoll", "Zweck"]} zeilen={(KATALOG.mdns || []).map((m) => [<span style={{ fontFamily: "monospace" }}>{m["Service-Typ"]}</span>, m.Protokoll, m.Zweck])} />;
  if (b.t === "infra") return <Tabelle kopf={["Protokoll", "Port / Schicht", "Rolle im Veranstaltungsnetz"]} zeilen={(KATALOG.infrastruktur || []).map((m) => [m.Protokoll, m["Port / Schicht"], m["Rolle im Veranstaltungsnetz"]])} />;
  if (b.t === "qos") return <Tabelle kopf={["System", "DSCP", "Hinweis"]} zeilen={(KATALOG.qos || []).map((q) => [q.System, q["DSCP-Werte"], q.Hinweis])} />;
  return null;
}

function ProtokollSeite({ k }) {
  const rs = recherche(k.id);
  const p = defaultParams(k.id);
  const beispiele = [1, 4, 16, 64].map((f) => Math.max(1, Math.round((k.menge * f) / 4)));
  return (
    <>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: 900 }}>{k.kurz}</p>
      <h3 style={{ fontSize: 14, color: ACCENT, margin: "18px 0 6px" }}>Anforderungen an das Netz</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 8 }}>
        {ANF.map(([key, l]) => (
          <div key={key} style={{ ...S.card, margin: 0, padding: "8px 12px" }}>
            <div style={{ fontSize: 10.5, color: SUB, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{l}</div>
            <div style={{ fontSize: 12.5, marginTop: 3 }}>{k.anforderungen[key] || "–"}</div>
          </div>
        ))}
      </div>
      <h3 style={{ fontSize: 14, color: ACCENT, margin: "18px 0 6px" }}>Bandbreite (Standardwerte)</h3>
      <Tabelle kopf={[k.einheit, "Last", "Anteil an 1 Gbit/s"]} zeilen={beispiele.map((n) => { const r = k.rechne(n, p); return [n, fmtMbit(r.mbit), `${((r.mbit / 1000) * 100).toFixed(1)} %`]; })} />
      <h3 style={{ fontSize: 14, color: ACCENT, margin: "18px 0 6px" }}>Latenz</h3>
      <Tabelle kopf={["Wert", "Bedeutung"]} zeilen={k.latenz} />
      {k.id === "dante" && <div style={{ fontSize: 12.5, borderLeft: `3px solid ${WARN}`, background: "#2a2418", padding: "8px 12px", borderRadius: 4, marginTop: 8, maxWidth: 900 }}>Die Fokus-Recherche nennt vorsichtigere Hop-Zahlen (0,25 ms bei 1 Hop, 0,5 ms bei 3, 1 ms bei 5, 2 ms bei 10). Im Zweifel die höhere Latenz wählen und in Dante Controller auf späte Pakete prüfen.</div>}
      {k.varianten && <>
        <h3 style={{ fontSize: 14, color: ACCENT, margin: "18px 0 6px" }}>Varianten</h3>
        <Tabelle kopf={["Variante", "Beschreibung", "Datenstand"]} zeilen={k.varianten} />
      </>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 20 }}>
        <div>
          <h3 style={{ fontSize: 14, color: ACCENT, margin: "18px 0 6px" }}>Analyse-Werkzeuge</h3>
          <Tabelle kopf={["Werkzeug", "Wofür"]} zeilen={k.tools} />
        </div>
        <div>
          <h3 style={{ fontSize: 14, color: ACCENT, margin: "18px 0 6px" }}>Stolpersteine</h3>
          <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 20 }}>{k.stolpersteine.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      </div>
      {rs.map((r) => (
        <div key={r.Protokoll} style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 14, color: ACCENT, margin: "0 0 6px" }}>Recherche: {r.Protokoll} <span style={{ fontSize: 11, fontWeight: 400, color: /geprüft/i.test(r.Datenstand) ? OK : WARN }}>· {r.Datenstand}</span></h3>
          <table style={{ ...S.table, fontSize: 12.5 }}><tbody>
            {FELDER.filter(([f]) => r[f]).map(([f, l]) => <tr key={f}><td style={{ ...S.td, color: SUB, width: 170, verticalAlign: "top" }}>{l}</td><td style={S.td}>{r[f]}</td></tr>)}
            {r.Quellen && <tr><td style={{ ...S.td, color: SUB, verticalAlign: "top" }}>Quellen</td><td style={S.td}><Links text={r.Quellen} /></td></tr>}
          </tbody></table>
        </div>
      ))}
    </>
  );
}

function SwitchSeite() {
  const gruppen = new Map();
  for (const e of KATALOG.switch_empfehlungen || []) {
    const g = e["Hersteller/System"];
    if (!gruppen.has(g)) gruppen.set(g, []);
    gruppen.get(g).push(e);
  }
  if (!gruppen.size) return <p style={S.empty}>Keine Switch-Empfehlungen im Katalog.</p>;
  return [...gruppen].map(([g, l]) => (
    <div key={g} style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, color: ACCENT, margin: "12px 0 6px" }}>{g}</h3>
      <table style={{ ...S.table, fontSize: 12.5 }}><tbody>
        {l.map((e, i) => <tr key={i}><td style={{ ...S.td, width: 150, fontWeight: 600, verticalAlign: "top" }}>{e.Einstellung}</td><td style={S.td}>{e.Wert}</td><td style={{ ...S.td, width: 60, textAlign: "right" }}>{/^https?:/.test(e.Quelle || "") && <a href="#" style={{ color: "#8ec5ff", fontSize: 11 }} onClick={(ev) => { ev.preventDefault(); api.openExternal(e.Quelle.split(/\s*;\s*/)[0]); }}>Quelle</a>}</td></tr>)}
      </tbody></table>
    </div>
  ));
}

export default function WissenTab() {
  const [sel, setSel] = useState("matrix");
  const art = ARTIKEL.find((a) => a.id === sel);
  const k = KERN.find((x) => "p-" + x.id === sel);
  const Nav = ({ id, children, color }) => (
    <button onClick={() => setSel(id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: sel === id ? ACCENT + "26" : "none", border: "none", borderLeft: `3px solid ${sel === id ? ACCENT : "transparent"}`, color: sel === id ? "#fff" : "#c8d0d8", padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>
      {color && <Dot color={color} size={8} />}{children}
    </button>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 20, alignItems: "start" }}>
      <div style={{ ...S.section, padding: "10px 0", position: "sticky", top: 12 }}>
        <div className="sp-section-label" style={{ padding: "0 12px" }}>Grundlagen</div>
        {ARTIKEL.map((a) => <Nav key={a.id} id={a.id}>{a.titel}</Nav>)}
        <Nav id="switches">Switch-Einstellungen</Nav>
        <div className="sp-section-label" style={{ padding: "0 12px", marginTop: 12 }}>Kernprotokolle</div>
        {KERN.map((x) => <Nav key={x.id} id={"p-" + x.id} color={x.farbe}>{x.name}</Nav>)}
      </div>
      <Section title={art?.titel || k?.name || "Switch-Einstellungen je Hersteller"} right={<WikiLink id={art?.id || k?.id} />} subtitle={art?.kurz || (k ? `${k.kategorie} · Werte mit „≈“ sind Richtwerte für die Planung.` : "Empfehlungen aus der Fokus-Recherche mit Quelle. Werte vor dem Einsatz am konkreten Modell prüfen.")}>
        {art && art.bloecke.map((b, i) => <Block key={i} b={b} />)}
        {k && <ProtokollSeite k={k} />}
        {sel === "switches" && <SwitchSeite />}
      </Section>
    </div>
  );
}
