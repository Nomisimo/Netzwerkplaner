/* Gemeinsame Löschkaskaden und harte Prüfungen.
   Heute teils verteilt auf App.jsx, TopologieTab.jsx und VlanTab.jsx. Im Mehrbenutzerbetrieb
   führt der Server sie aus, damit alle Clients denselben aufgeräumten Stand bekommen. */

// Layout-Maps, deren Schlüssel Geräte-IDs sind (Mindmap und Frontplatte)
const GERAETE_MAPS = ["offsets", "fpOffsets", "pins", "fpPins", "pinned", "fix", "fpFix"];
// Layout-Maps, deren Schlüssel Verbindungs-IDs sind
const VERBINDUNGS_MAPS = ["knicke", "fpKnicke"];

export const removeConns = (P, ids) => {
  const weg = ids instanceof Set ? ids : new Set(ids);
  if (!weg.size) return;
  P.verbindungen = P.verbindungen.filter((c) => !weg.has(c.id));
  for (const k of VERBINDUNGS_MAPS) if (P.layout?.[k]) for (const id of weg) delete P.layout[k][id];
};

// Löscht Geräte samt Verbindungen, Layout-Einträgen, Stapel-Mitgliedschaften und Stromzielen.
export const removeDevices = (P, ids) => {
  const weg = ids instanceof Set ? ids : new Set(ids);
  if (!weg.size) return;
  P.geraete = P.geraete.filter((g) => !weg.has(g.id));
  removeConns(P, P.verbindungen.filter((c) => weg.has(c.a.dev) || weg.has(c.b.dev)).map((c) => c.id));
  const L = P.layout || (P.layout = {});
  if (weg.has(L.rootId)) L.rootId = null;
  for (const k of GERAETE_MAPS) if (L[k]) for (const id of weg) delete L[k][id];
  if (L.stapel) L.stapel = L.stapel.map((s) => ({ ...s, ids: s.ids.filter((x) => !weg.has(x)) })).filter((s) => s.ids.length > 1);
  for (const g of P.geraete) for (const s of g.stroeme || []) if (s.ziele?.some((z) => weg.has(z))) s.ziele = s.ziele.filter((z) => !weg.has(z));
};
export const removeDevice = (P, id) => removeDevices(P, [id]);

// Löscht ein VLAN; Ports und QinQ-Bezüge verlieren die Zuordnung.
export const removeVlan = (P, id) => {
  P.vlans = P.vlans.filter((x) => x.id !== id);
  P.vlans.forEach((x) => { if (x.svlan === id) x.svlan = null; });
  for (const g of P.geraete) g.ports.forEach((p) => {
    if (p.vlan === id) p.vlan = null;
    if (p.vlans?.includes(id)) p.vlans = p.vlans.filter((x) => x !== id);
  });
};

// Harte Invarianten: Liste von Verstößen (leer = in Ordnung). Der Server lehnt eine Transaktion ab,
// wenn sie neue Verstöße erzeugt; weiche Regeln bleiben bei validate() in model.js.
export const pruefeInvarianten = (P) => {
  const fehler = [];
  const devs = new Map(P.geraete.map((g) => [g.id, g]));
  const belegt = new Map();
  for (const c of P.verbindungen) for (const e of [c.a, c.b]) {
    const d = devs.get(e.dev);
    if (!d) { fehler.push({ art: "verbindung-ohne-geraet", conn: c.id, dev: e.dev }); continue; }
    if (!d.ports.some((p) => p.id === e.port)) { fehler.push({ art: "verbindung-ohne-port", conn: c.id, dev: e.dev, port: e.port }); continue; }
    const k = `${e.dev}/${e.port}`;
    if (belegt.has(k)) fehler.push({ art: "port-doppelt", conn: c.id, andere: belegt.get(k), dev: e.dev, port: e.port });
    else belegt.set(k, c.id);
  }
  const vlanIds = new Set(P.vlans.map((v) => v.id));
  for (const g of P.geraete) for (const p of g.ports) {
    if (p.vlan && !vlanIds.has(p.vlan)) fehler.push({ art: "vlan-fehlt", dev: g.id, port: p.id, vlan: p.vlan });
    for (const v of p.vlans || []) if (!vlanIds.has(v)) fehler.push({ art: "vlan-fehlt", dev: g.id, port: p.id, vlan: v });
  }
  const inStapel = new Map();
  for (const s of P.layout?.stapel || []) for (const id of s.ids) {
    if (inStapel.has(id)) fehler.push({ art: "mehrere-stapel", dev: id, stapel: [inStapel.get(id), s.id] });
    else inStapel.set(id, s.id);
  }
  return fehler;
};

// Schlüssel für Vergleiche „neu hinzugekommen?“
export const fehlerKey = (f) => JSON.stringify(f);
