import React, { useMemo, useState } from "react";
import { S, TYPEN, LINE, SUB, ERR, VLAN_FARBEN } from "../shared/constants.js";
import { emptyProject, buildIndex, newVlan } from "../shared/model.js";
import { createDevice, snapshotDevice, uid, ipPorts, physPorts } from "../shared/catalog.js";
import { Modal, Field } from "./ui.jsx";
import DeviceEditor from "./DeviceEditor.jsx";
import { Plus } from "lucide-react";

/* Neues Gerät direkt im Katalog anlegen, ohne es in ein Projekt einzufügen.
   Der Geräte-Editor arbeitet dafür auf einem kleinen Übungsprojekt mit den
   VLANs des offenen Projekts. Ergebnis: Eintrag im Gerätebestand (mit IPs) oder
   eigene Vorlage (ohne Adressen). */
export default function GeraetAnlegen({ P, ziel, onSave, onClose }) {
  const [typ, setTyp] = useState("sonstiges");
  const [S0, setS0] = useState(() => {
    const p = emptyProject();
    p.vlans = JSON.parse(JSON.stringify(P.vlans));
    p.icons = P.icons || [];
    p.feldKatalog = P.feldKatalog || [];
    p.geraete = [createDevice({ typ: "sonstiges", vlans: p.vlans, name: "Neues Gerät" })];
    return p;
  });
  const X0 = useMemo(() => buildIndex(S0), [S0]);
  const mutate = (fn) => setS0((s) => { const d = JSON.parse(JSON.stringify(s)); fn(d); return d; });
  const dev = S0.geraete[0];
  const neuerTyp = (t) => {
    setTyp(t);
    mutate((d) => {
      const alt = d.geraete[0];
      const neu = createDevice({ typ: t, vlans: d.vlans, name: alt.name });
      d.geraete[0] = { ...neu, netzname: alt.netzname, hersteller: alt.hersteller, modell: alt.modell, felder: alt.felder || [], notizen: alt.notizen };
    });
  };
  const speichern = () => {
    const g = snapshotDevice(dev, S0.vlans);
    if (ziel === "vorlage") { g.ports.forEach((i) => { i.ip = ""; i.mac = ""; }); g.netzname = ""; (g.felder || []).forEach((f) => { f.wert = ""; }); }
    const now = new Date().toISOString();
    onSave({ id: uid(), name: dev.name, geraet: g, angelegt: now, geaendert: now });
  };
  return (
    <Modal title={ziel === "vorlage" ? "Neue Vorlage anlegen" : "Neues Gerät im Bestand anlegen"} width={760} onClose={onClose}
      footer={<>
        <button style={S.ghostBtn} onClick={onClose}>Abbrechen</button>
        <button style={S.primaryBtn} onClick={speichern}>{ziel === "vorlage" ? "Als Vorlage speichern" : "Im Bestand speichern"}</button>
      </>}>
      <Field label="Grundtyp" hint="Legt die Ports vor. Alles lässt sich danach im Editor ändern.">
        <select style={{ ...S.select, maxWidth: 320 }} value={typ} onChange={(e) => neuerTyp(e.target.value)}>
          {Object.entries(TYPEN).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
      </Field>
      <NeuesVlan key={typ} S0={S0} dev={dev} mutate={mutate} />
      <div style={{ marginTop: 12 }}>
        <DeviceEditor P={S0} X={X0} dev={dev} mutate={mutate} compact={false} />
      </div>
    </Modal>
  );
}

/* Neues VLAN direkt beim Anlegen des Geräts erzeugen und zuweisen. Das VLAN
   wird mit dem Gerät gespeichert und beim Einfügen in ein Projekt angelegt,
   wenn es dort noch keine VLAN mit dieser ID gibt. */
function NeuesVlan({ S0, dev, mutate }) {
  const naechste = () => { let n = 100; const belegt = new Set(S0.vlans.map((v) => +v.vid)); while (belegt.has(n)) n++; return n; };
  const [vid, setVid] = useState(naechste);
  const [name, setName] = useState("");
  const [ziel, setZiel] = useState(dev.isSwitch ? "ports" : ipPorts(dev)[0] ? "if:0" : "nur");
  const [info, setInfo] = useState("");
  const vorhanden = S0.vlans.find((v) => +v.vid === +vid);
  const ungueltig = !(+vid >= 1 && +vid <= 4094);
  const anlegen = () => {
    if (ungueltig) return;
    mutate((d) => {
      let v = d.vlans.find((x) => +x.vid === +vid && !x.svlan);
      if (!v) { v = newVlan({ vid: +vid, name: name.trim() || `VLAN ${vid}`, farbe: VLAN_FARBEN[d.vlans.length % VLAN_FARBEN.length], subnetz: +vid < 256 ? `10.10.${vid}.0/24` : "" }); d.vlans.push(v); }
      const g = d.geraete[0];
      if (ziel === "ports") physPorts(g).forEach((p) => { if (p.modus !== "trunk") p.vlan = v.id; });
      else if (ziel.startsWith("if:")) { const i = ipPorts(g)[+ziel.slice(3)]; if (i) i.vlan = v.id; }
    });
    setInfo(vorhanden ? `VLAN ${vid} gab es schon und ist jetzt zugewiesen.` : `VLAN ${vid} angelegt${ziel === "nur" ? ". Im Editor unten den Ports zuweisen." : " und zugewiesen."}`);
    setName(""); setVid(naechste() === +vid ? +vid + 1 : naechste());
  };
  return (
    <div style={{ marginTop: 12, border: `1px solid ${LINE}`, borderRadius: 8, padding: 10 }}>
      <div className="sp-section-label" style={{ marginTop: 0 }}>Neues VLAN für dieses Gerät</div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field label="VLAN-ID"><input type="number" min="1" max="4094" style={{ ...S.inputSm, width: 90 }} value={vid} onChange={(e) => setVid(e.target.value)} /></Field>
        <Field label="Name"><input style={{ ...S.inputSm, width: 180 }} value={vorhanden ? vorhanden.name : name} disabled={!!vorhanden} placeholder={`VLAN ${vid}`} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Zuweisen an">
          <select style={{ ...S.selectSm, width: 220 }} value={ziel} onChange={(e) => setZiel(e.target.value)}>
            {physPorts(dev).length > 0 && <option value="ports">Alle Ports (Access)</option>}
            {ipPorts(dev).map((i, n) => <option key={i.id} value={`if:${n}`}>Port „{i.name}“</option>)}
            <option value="nur">Nur anlegen</option>
          </select>
        </Field>
        <button style={S.primaryBtn} disabled={ungueltig} onClick={anlegen}>{vorhanden ? "Zuweisen" : <><Plus size={14} /> Anlegen und zuweisen</>}</button>
      </div>
      {ungueltig && <div style={{ color: ERR, fontSize: 12, marginTop: 6 }}>Die VLAN-ID muss zwischen 1 und 4094 liegen.</div>}
      {info && <div style={{ color: SUB, fontSize: 12, marginTop: 6 }}>{info}</div>}
      <div style={{ ...S.hint, marginTop: 6 }}>Das VLAN wird mit dem Gerät gespeichert. Beim Einfügen in ein Projekt ohne diese VLAN-ID legt der Netzwerkplaner es dort an.</div>
    </div>
  );
}
