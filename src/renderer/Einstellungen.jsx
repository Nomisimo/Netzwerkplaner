import React, { useState, useMemo } from "react";
import { S, ACCENT, LINE, SUB, MUTED, STRONG, THEME_KEY, themeWahl, systemHell, HELL } from "../shared/constants.js";
import { Modal, Toggle } from "./ui.jsx";
import { KATALOG_GERAETE } from "../shared/catalog.js";
import { useEinstellungen, setzeEinstellungen, istFokus, TOPO_STANDARD } from "./einstellungen.js";
import { Monitor, Sun, Moon } from "lucide-react";

/* Einstellungen der App (gelten für diesen Rechner, nicht fürs Projekt).
   Erscheinungsbild: System (Standard), Hell oder Dunkel. Ein Wechsel lädt die
   Oberfläche neu; das Projekt ist vorher automatisch gespeichert. */
const ARTEN = [["system", "Wie das System", Monitor], ["hell", "Hell", Sun], ["dunkel", "Dunkel", Moon]];

export const themeSetzen = (w, vorReload) => {
  try { localStorage.setItem(THEME_KEY, w); } catch { /* ohne Speicher */ }
  const hell = w === "hell" || (w === "system" && systemHell());
  if (hell === HELL) return false; // sieht schon so aus
  vorReload?.();
  location.reload();
  return true;
};

// Auswahl als Kacheln (wie beim Erscheinungsbild)
function Kacheln({ wert, optionen, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${optionen.length},1fr)`, gap: 8 }}>
      {optionen.map(([k, l, sub]) => {
        const an = wert === k;
        return (
          <button key={k} onClick={() => onChange(k)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: an ? 700 : 500,
            border: `2px solid ${an ? ACCENT : LINE}`, background: an ? ACCENT + "1f" : "transparent", color: an ? STRONG : SUB }}>
            {l}{sub && <span style={{ fontSize: 11, fontWeight: 400, color: MUTED }}>{sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

function FokusHersteller({ e }) {
  const liste = useMemo(() => {
    const m = new Map();
    for (const g of KATALOG_GERAETE) { const x = m.get(g.hersteller) || { n: 0, recherchiert: false }; x.n++; if (g.fokus) x.recherchiert = true; m.set(g.hersteller, x); }
    return [...m].sort((a, b) => a[0].localeCompare(b[0], "de"));
  }, []);
  const gewaehlt = new Set(liste.filter(([h]) => istFokus({ hersteller: h, fokus: liste.find((x) => x[0] === h)[1].recherchiert }, e)).map(([h]) => h));
  const setzen = (h, an) => setzeEinstellungen((x) => {
    const s = new Set(gewaehlt);
    if (an) s.add(h); else s.delete(h);
    x.fokusHersteller = [...s].sort((a, b) => a.localeCompare(b, "de"));
  });
  return <>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: SUB, flex: 1 }}>{gewaehlt.size} von {liste.length} Herstellern im Fokus{Array.isArray(e.fokusHersteller) ? "" : " (recherchierte Fokus-Hersteller)"}</span>
      <button style={S.ghostBtn} disabled={!Array.isArray(e.fokusHersteller)} onClick={() => setzeEinstellungen((x) => { x.fokusHersteller = null; })}>Recherchierte</button>
      <button style={S.ghostBtn} onClick={() => setzeEinstellungen((x) => { x.fokusHersteller = []; })}>Keine</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "2px 10px", maxHeight: 220, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px" }}>
      {liste.map(([h, x]) => (
        <label key={h} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: gewaehlt.has(h) ? STRONG : SUB, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={`${h} · ${x.n} Modelle${x.recherchiert ? " · gegen Herstellerdoku recherchiert" : ""}`}>
          <input type="checkbox" checked={gewaehlt.has(h)} onChange={(ev) => setzen(h, ev.target.checked)} style={{ accentColor: ACCENT }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{h}</span><span style={{ color: MUTED, fontSize: 10.5 }}>{x.n}</span>
        </label>
      ))}
    </div>
  </>;
}

function TopoStandard({ e, onAnwenden }) {
  const t = e.topo;
  const set = (k, v) => setzeEinstellungen((x) => { x.topo[k] = v; });
  const sel = { ...S.selectSm, width: "auto" };
  return <>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select style={sel} value={t.ansicht} onChange={(ev) => set("ansicht", ev.target.value)}>
        <option value="mindmap">Ansicht: Mindmap</option><option value="front">Ansicht: Anschlüsse</option><option value="cleancat">Ansicht: Plott</option>
      </select>
      <select style={sel} value={t.linien} onChange={(ev) => set("linien", ev.target.value)}>
        <option value="rund">Linien: rund</option><option value="eckig">Linien: eckig</option><option value="direkt">Linien: direkt</option>
      </select>
      <select style={sel} value={t.farbe} onChange={(ev) => set("farbe", ev.target.value)}>
        <option value="vlan">Farbe: VLAN</option><option value="kat">Farbe: Bereich</option><option value="kabel">Farbe: Kabeltyp</option>
      </select>
      <select style={sel} value={t.titel} onChange={(ev) => set("titel", ev.target.value)}>
        <option value="name">Titel: Gerätename</option><option value="netzname">Titel: Netzwerkname</option><option value="typ">Titel: Typ / Modell</option>
      </select>
    </div>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
      <Toggle checked={t.einrasten} onChange={(v) => set("einrasten", v)} label="Einrasten" />
      <Toggle checked={t.autoAnordnen} onChange={(v) => set("autoAnordnen", v)} label="Auto-Anordnen" />
      <Toggle checked={t.kabelBuendel} disabled={t.linien !== "eckig"} onChange={(v) => set("kabelBuendel", v)} label="Kabel bündeln" title="Nur bei „Linien: eckig“" />
      <Toggle checked={t.portVlan} onChange={(v) => set("portVlan", v)} label="Port & VLAN" />
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
      <span style={{ ...S.hint, flex: 1, margin: 0 }}>Gilt für neue Projekte und überall, wo das Projekt selbst nichts eingestellt hat.</span>
      <button style={S.ghostBtn} onClick={() => setzeEinstellungen((x) => { x.topo = { ...TOPO_STANDARD }; })}>Zurücksetzen</button>
      {onAnwenden && <button style={S.ghostBtn} onClick={onAnwenden} title="Ansicht, Linien, Titel, Einrasten und Kabel bündeln im offenen Projekt auf diese Standards setzen">Auf offenes Projekt anwenden</button>}
    </div>
  </>;
}

export default function Einstellungen({ onClose, vorReload, inSitzung, onTopoAnwenden }) {
  const [wahl, setWahl] = useState(themeWahl);
  const e = useEinstellungen();
  return (
    <Modal title="Einstellungen" width={640} onClose={onClose} footer={<button style={S.primaryBtn} onClick={onClose}>Fertig</button>}>
      <div className="sp-section-label">Erscheinungsbild</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {ARTEN.map(([k, l, Ic]) => {
          const an = wahl === k;
          return (
            <button key={k} onClick={() => { setWahl(k); if (inSitzung && !confirm("Zum Umschalten lädt die Oberfläche neu, und du verlässt dabei die laufende Sitzung. Trotzdem umschalten?")) { try { localStorage.setItem(THEME_KEY, k); } catch { /* */ } return; } themeSetzen(k, vorReload); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: an ? 700 : 500,
                border: `2px solid ${an ? ACCENT : LINE}`, background: an ? ACCENT + "1f" : "transparent", color: an ? STRONG : SUB }}>
              <Ic size={22} />{l}
            </button>
          );
        })}
      </div>
      <div style={{ ...S.hint, marginTop: 10 }}>
        „Wie das System“ übernimmt Hell oder Dunkel vom Betriebssystem beim Start der App{wahl === "system" ? ` (gerade ${systemHell() ? "hell" : "dunkel"})` : ""}.
        Beim Umschalten lädt die Oberfläche kurz neu; das Projekt bleibt erhalten.
      </div>

      <div className="sp-section-label" style={{ marginTop: 18 }}>Port-Lasche an Geräten (Anschlüsse)</div>
      <Kacheln wert={e.lasche} onChange={(v) => setzeEinstellungen((x) => { x.lasche = v; })} optionen={[
        ["standard", "Standard", "nur der Port, über den das Gerät hängt, z. B. „Port 3 → LAN 1“"],
        ["erweitert", "Erweitert", "alle belegten Ports des Geräts, z. B. „Port 3 → LAN 1 · Port 4 → LAN 2“"],
      ]} />

      <div className="sp-section-label" style={{ marginTop: 18 }}>Fokus im Katalog</div>
      <div style={{ ...S.hint, marginTop: 0, marginBottom: 8 }}>Diese Hersteller zeigt der Filter „nur Fokus“ im Katalog und beim Gerät-Hinzufügen.</div>
      <FokusHersteller e={e} />

      <div className="sp-section-label" style={{ marginTop: 18 }}>Topologie: Standard-Anzeige</div>
      <TopoStandard e={e} onAnwenden={onTopoAnwenden} />

      <div style={{ fontSize: 11, color: MUTED, marginTop: 14 }}>Alle Einstellungen gelten nur auf diesem Rechner.</div>
    </Modal>
  );
}
