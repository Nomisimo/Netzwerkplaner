/* ── Signalfluss je Verbindung ────────────────────────────────────────────────
   Für den Druckplan: läuft das Signal über ein Kabel nur in eine Richtung (z. B. ein
   AES67- oder Dante-Sender zu seinen Empfängern) oder in beide? Von Hand gesetzt
   (conn.fluss = "ab" | "ba" | "beide") gilt das. Sonst ergibt es sich aus den
   Datenströmen: jeder Strom mit Zielen läuft im Netz vom Sender zum Empfänger,
   je VLAN des Stroms (Dante Primary und Secondary getrennt).
   Ergebnis: Map connId → { ab, ba, quelle: "hand" | "stroeme" }. Verbindungen ohne
   Angabe und ohne Strom fehlen in der Map (Richtung unbekannt). */
import { pfad, streamVlans } from "./analyse.js";

export const FLUSS = { "": "Automatisch (aus den Datenströmen)", beide: "In beide Richtungen", ab: "Nur A → B", ba: "Nur B → A" };

export const flussRichtungen = (P, X) => {
  const out = new Map();
  const merke = (c, von) => {
    const f = out.get(c.id) || { ab: false, ba: false, quelle: "stroeme" };
    if (c.a.dev === von) f.ab = true; else f.ba = true;
    out.set(c.id, f);
  };
  // Verbindung zwischen zwei Nachbarn im Pfad (bei mehreren: die mit passendem VLAN zuerst)
  const zwischen = (u, v) => (X.connsByDev.get(u) || []).filter((c) => (c.a.dev === u && c.b.dev === v) || (c.b.dev === u && c.a.dev === v));
  const pfade = new Map();
  for (const d of P.geraete) for (const s of d.stroeme || []) {
    const ziele = (s.ziele || []).filter((z) => z !== d.id && X.devById.has(z));
    if (!ziele.length) continue;
    const vlans = streamVlans(d, s);
    for (const z of ziele) for (const v of vlans.length ? vlans : [null]) {
      const key = `${d.id}|${z}|${v}`;
      if (!pfade.has(key)) pfade.set(key, pfad(P, X, d.id, z, v));
      const p = pfade.get(key);
      if (!p) continue;
      for (let i = 0; i + 1 < p.length; i++) {
        const cs = zwischen(p[i], p[i + 1]);
        const c = cs.find((x) => !v || [x.a, x.b].some((e) => X.portRef.get(`${e.dev}:${e.port}`)?.port?.vlan === v)) || cs[0];
        if (c) merke(c, p[i]);
      }
    }
  }
  for (const c of P.verbindungen) {
    if (c.fluss === "ab") out.set(c.id, { ab: true, ba: false, quelle: "hand" });
    else if (c.fluss === "ba") out.set(c.id, { ab: false, ba: true, quelle: "hand" });
    else if (c.fluss === "beide") out.set(c.id, { ab: true, ba: true, quelle: "hand" });
  }
  return out;
};

// Kurzer Text für den Verbindungs-Editor
export const flussText = (f, nameA, nameB) => {
  if (!f) return "keine Datenströme über dieses Kabel";
  if (f.ab && f.ba) return "in beide Richtungen";
  return f.ab ? `${nameA} → ${nameB}` : `${nameB} → ${nameA}`;
};
