/* Fester Schlüssel für Bestandsgeräte.
   Importieren zwei Rechner denselben Bestand, bekommt jedes Gerät dieselbe ID. So erkennen App und
   Mehrbenutzer-Server, dass es dasselbe physische Gerät ist (z. B. „steht doppelt im Plan“).
   Reihenfolge: Inventar-Nr., sonst Hersteller + Seriennummer, sonst erste MAC-Adresse. */

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const feld = (g, id, name) => norm((g.felder || []).find((f) => f.id === id || norm(f.name) === norm(name))?.wert);

export const bestandSchluessel = (g) => {
  if (!g) return null;
  const inv = feld(g, "inventar-nr", "Inventar-Nr.");
  if (inv) return `inv:${inv}`;
  const sn = feld(g, "seriennummer", "Seriennummer");
  if (sn) return `sn:${norm(g.hersteller)}|${sn}`;
  const mac = (g.ports || []).map((p) => String(p.mac || "").toLowerCase().replace(/[^0-9a-f]/g, "")).find((m) => m.length === 12);
  return mac ? `mac:${mac}` : null;
};

// Geräte im Plan, die dasselbe Bestandsgerät sind: Liste von Gruppen (je ≥ 2 Geräte)
export const doppelteBestandsgeraete = (P) => {
  const m = new Map();
  for (const d of P.geraete) {
    const k = bestandSchluessel(d) || (d.bestandId ? `id:${d.bestandId}` : null);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(d);
  }
  return [...m.values()].filter((g) => g.length > 1);
};
