/* ── Trunks ───────────────────────────────────────────────────────────────
   Ein Trunk ist ein benanntes Bündel von VLANs (tagged), z. B. „Uplink Ton+Licht“ mit 10, 11, 20.
   Er wird im Setup wie ein VLAN angelegt (Haken „Ist ein Trunk“) und an Switch-Ports gewählt.
   Im Modell: P.trunks = [{ id, name, farbe, vlans: [VLAN-IDs], notiz }]; ein Switch-Port mit
   port.trunk = Trunk-ID ist im Modus „trunk“ und trägt genau die VLANs des Trunks.
   trunksAbgleichen hält das nach jeder Änderung stimmig (Mitglieder geändert, Trunk gelöscht). */
import { uid } from "./catalog.js";

export const newTrunk = (o = {}) => ({ id: uid(), name: "", farbe: "#8a94a0", vlans: [], notiz: "", ...o });

const managed = (d) => d?.isSwitch && d.typ !== "switch_unmanaged";

// Ports, die einen Trunk nutzen: [{ dev, port }]
export const trunkPorts = (P, trunkId) => {
  const out = [];
  for (const d of P.geraete || []) for (const p of d.ports || []) if (p.trunk === trunkId) out.push({ dev: d, port: p });
  return out;
};

// Ports mit Trunk-Profil auf dessen VLANs bringen; Verweise auf gelöschte Trunks entfernen. Ändert P.
export const trunksAbgleichen = (P) => {
  if (!Array.isArray(P.trunks)) P.trunks = [];
  const byId = new Map(P.trunks.map((t) => [t.id, t]));
  const vlanIds = new Set((P.vlans || []).map((v) => v.id));
  for (const t of P.trunks) {
    const rein = (t.vlans || []).filter((id) => vlanIds.has(id));
    if (rein.length !== (t.vlans || []).length) t.vlans = rein;
  }
  for (const d of P.geraete || []) for (const p of d.ports || []) {
    if (!p.trunk) continue;
    const t = byId.get(p.trunk);
    if (!t || !managed(d) || p.virtuell) { delete p.trunk; continue; }
    if (p.modus !== "trunk") p.modus = "trunk";
    const soll = t.vlans || [];
    const ist = p.vlans || [];
    if (soll.length !== ist.length || soll.some((id, i) => ist[i] !== id)) p.vlans = [...soll];
  }
  return P;
};

// Port auf einen Trunk stellen (port wird direkt geändert)
export const setzeTrunk = (port, t) => {
  port.modus = "trunk";
  port.trunk = t.id;
  port.vlans = [...(t.vlans || [])];
};

/* Haken „Ist ein Trunk“ an einem VLAN: das VLAN wird zum Trunk mit gleichem Namen und gleicher Farbe.
   Switch-Ports, die es als Access-VLAN hatten, werden Trunk-Ports mit diesem Trunk; aus den
   VLAN-Listen anderer Trunks und Trunk-Ports fällt es heraus. Ergebnis: der neue Trunk. */
export const vlanZuTrunk = (P, vlanId) => {
  const v = (P.vlans || []).find((x) => x.id === vlanId);
  if (!v) return null;
  if (!Array.isArray(P.trunks)) P.trunks = [];
  const t = newTrunk({ id: v.id, name: v.name || `Trunk ${v.vid}`, farbe: v.farbe, notiz: v.notiz || "" });
  P.vlans = P.vlans.filter((x) => x.id !== vlanId);
  for (const x of P.vlans) if (x.svlan === vlanId) x.svlan = null;
  for (const o of P.trunks) o.vlans = (o.vlans || []).filter((id) => id !== vlanId);
  for (const d of P.geraete || []) for (const p of d.ports || []) {
    p.vlans = (p.vlans || []).filter((id) => id !== vlanId);
    if (p.vlan !== vlanId) continue;
    p.vlan = null;
    if (managed(d) && !p.virtuell) setzeTrunk(p, t);
  }
  P.trunks.push(t);
  return t;
};

/* Haken raus: der Trunk wird wieder ein normales VLAN (nächste freie VLAN-ID). Ports mit dem
   Trunk behalten ihre VLAN-Liste als eigene Auswahl. Ergebnis: das neue VLAN. */
export const trunkZuVlan = (P, trunkId, newVlan) => {
  const t = (P.trunks || []).find((x) => x.id === trunkId);
  if (!t) return null;
  const vid = Math.max(0, ...(P.vlans || []).map((v) => +v.vid || 0)) + 1;
  const v = newVlan({ id: t.id, vid, name: t.name, farbe: t.farbe, notiz: t.notiz || "" });
  P.trunks = P.trunks.filter((x) => x.id !== trunkId);
  for (const d of P.geraete || []) for (const p of d.ports || []) if (p.trunk === trunkId) delete p.trunk;
  P.vlans.push(v);
  return v;
};

// Kurztext der VLANs eines Trunks, z. B. „10 · 11 · 20“
export const trunkVlanText = (t, vlans) => {
  const ids = new Set(t?.vlans || []);
  return (vlans || []).filter((v) => ids.has(v.id)).sort((a, b) => a.vid - b.vid).map((v) => v.vid).join(" · ") || "keine VLANs";
};
