import React, { useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED } from "../shared/constants.js";
import { otherEnd } from "../shared/model.js";
import { Modal } from "./ui.jsx";

/* Alle Anschlüsse eines Geräts belegt: fragen, welcher ersetzt werden soll.
   voll: ids der Geräte ohne freien Port. onOk({ [devId]: portId }). */
export default function PortTauschen({ P, X, voll, onOk, onClose }) {
  const [wahl, setWahl] = useState(() => Object.fromEntries(voll.map((id) => [id, X.devById.get(id)?.ports[0]?.id || null])));
  const fertig = voll.every((id) => wahl[id]);
  return (
    <Modal title="Keine freien Anschlüsse" width={520} onClose={onClose}
      footer={<>
        <button style={S.secondaryBtn} onClick={onClose}>Abbrechen</button>
        <button style={S.primaryBtn} disabled={!fertig} onClick={() => onOk(wahl)}>Ersetzen und verbinden</button>
      </>}>
      {voll.map((id) => {
        const dev = X.devById.get(id);
        if (!dev) return null;
        return (
          <div key={id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <b>{dev.name}</b> hat {dev.ports.length} {dev.ports.length === 1 ? "Anschluss" : "Anschlüsse"}, alle sind belegt. Welchen willst du ersetzen? Die bisherige Verbindung dort wird gelöscht.
            </div>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "2px 8px", maxHeight: 260, overflowY: "auto" }}>
              {dev.ports.map((p) => {
                const cons = X.connsByPort.get(`${dev.id}:${p.id}`) || [];
                const ziel = cons.map((c) => { const o = otherEnd(c, dev.id); const r = X.portRef.get(`${o.dev}:${o.port}`); return r ? `${r.dev.name} [${r.port.name}]` : "?"; }).join(", ");
                return (
                  <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 13, cursor: "pointer" }}>
                    <input type="radio" name={`port-${id}`} checked={wahl[id] === p.id} onChange={() => setWahl((w) => ({ ...w, [id]: p.id }))} style={{ accentColor: ACCENT }} />
                    <span style={{ minWidth: 90, fontWeight: 600 }}>{p.name}</span>
                    <span style={{ color: SUB, fontSize: 12 }}>{ziel ? `→ ${ziel}` : <span style={{ color: MUTED }}>frei</span>}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
      <div style={{ ...S.hint, color: MUTED }}>Mehr Anschlüsse bekommt ein Gerät nur im Editor mit „+ Port“, wenn es die wirklich hat.</div>
    </Modal>
  );
}
