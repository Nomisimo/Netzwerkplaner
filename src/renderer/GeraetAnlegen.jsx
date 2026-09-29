import React, { useMemo, useState } from "react";
import { S, TYPEN } from "../shared/constants.js";
import { emptyProject, buildIndex } from "../shared/model.js";
import { createDevice, snapshotDevice, uid } from "../shared/catalog.js";
import { Modal, Field } from "./ui.jsx";
import DeviceEditor from "./DeviceEditor.jsx";

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
      d.geraete[0] = { ...neu, netzname: alt.netzname, hersteller: alt.hersteller, modell: alt.modell, inventar: alt.inventar, notizen: alt.notizen };
    });
  };
  const speichern = () => {
    const g = snapshotDevice(dev, S0.vlans);
    if (ziel === "vorlage") { g.interfaces.forEach((i) => { i.ip = ""; i.mac = ""; }); g.netzname = ""; g.inventar = { nr: "", sn: "", case: "" }; }
    const now = new Date().toISOString();
    onSave({ id: uid(), name: dev.name, geraet: g, angelegt: now, geaendert: now });
  };
  return (
    <Modal title={ziel === "vorlage" ? "Neue Vorlage anlegen" : "Neues Gerät im Bestand anlegen"} width={760} onClose={onClose}
      footer={<>
        <button style={S.ghostBtn} onClick={onClose}>Abbrechen</button>
        <button style={S.primaryBtn} onClick={speichern}>{ziel === "vorlage" ? "Als Vorlage speichern" : "Im Bestand speichern"}</button>
      </>}>
      <Field label="Grundtyp" hint="Legt Ports und Interfaces vor. Alles lässt sich danach im Editor ändern.">
        <select style={{ ...S.select, maxWidth: 320 }} value={typ} onChange={(e) => neuerTyp(e.target.value)}>
          {Object.entries(TYPEN).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
      </Field>
      <div style={{ marginTop: 12 }}>
        <DeviceEditor P={S0} X={X0} dev={dev} mutate={mutate} compact={false} />
      </div>
    </Modal>
  );
}
