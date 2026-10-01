/* ── Patchliste: alle Geräte in Aufbau-Reihenfolge ─────────────────────────
   Je Gerät eine Zeile mit Netzwerkname, IPs, „gesteckt auf“ (Switch und Port),
   eigenen Feldern, Abteilung, Standort, allen Kabeln und Notizen.
   Reihenfolge wie beim Aufbau: vom Haupt-Switch aus durch den Baum, Endgeräte
   eines Switches nach dessen Portnummer, Geräte eines Stapels direkt
   hintereinander, Unter-Switches mit ihren Geräten an der Stelle ihres Ports.
   Eine von Hand gesetzte Reihenfolge (P.patchliste.reihenfolge) hat Vorrang;
   neue Geräte rücken an ihre automatische Stelle. */
import { buildTree, otherEnd, thisEnd, kabelLabel } from "./model.js";
import { ipPorts } from "./catalog.js";
import { TYPEN } from "./constants.js";

const portIndex = (dev, portId) => {
  const i = (dev?.ports || []).findIndex((p) => p.id === portId);
  return i < 0 ? 9999 : i;
};

/* Automatische Aufbau-Reihenfolge: Array von Geräte-IDs */
export const aufbauReihenfolge = (P, X, T = buildTree(P, X)) => {
  const stapel = P.layout?.stapel || [];
  const stapelVon = new Map();
  for (const s of stapel) for (const id of s.ids) stapelVon.set(id, s);
  const out = [], drin = new Set();
  const nimm = (id) => { if (!drin.has(id) && X.devById.has(id)) { drin.add(id); out.push(id); } };
  // Sortierschlüssel eines Kindes: Port am Elternteil, an dem es hängt
  const schluessel = (eltern, kind) => {
    const c = T.treeConn.get(kind);
    if (!c) return 9999;
    const e = c.a.dev === eltern ? c.a : c.b.dev === eltern ? c.b : null;
    return e ? portIndex(X.devById.get(eltern), e.port) : 9999;
  };
  const besuche = (id) => {
    if (drin.has(id)) return;
    // ganzer Stapel zusammen, in Stapel-Reihenfolge (oben zuerst)
    const s = stapelVon.get(id);
    const gruppe = s ? s.ids.filter((x) => X.devById.has(x)) : [id];
    for (const g of gruppe) nimm(g);
    for (const g of gruppe) {
      const kinder = [...(T.children.get(g) || [])].sort((a, b) => schluessel(g, a) - schluessel(g, b));
      for (const k of kinder) besuche(k);
    }
  };
  for (const r of T.roots) besuche(r);
  for (const d of P.geraete) besuche(d.id); // nicht verbundene Geräte zum Schluss
  return out;
};

/* Von Hand gesetzte Reihenfolge mit der automatischen zusammenführen */
export const patchReihenfolge = (P, X, T) => {
  const auto = aufbauReihenfolge(P, X, T);
  const manuell = (P.patchliste?.reihenfolge || []).filter((id) => X.devById.has(id));
  if (!manuell.length) return auto;
  const out = [...new Set(manuell)];
  const drin = new Set(out);
  auto.forEach((id, i) => {
    if (drin.has(id)) return;
    // hinter das Gerät, das in der automatischen Reihenfolge davor steht
    let pos = out.length;
    for (let k = i - 1; k >= 0; k--) { const j = out.indexOf(auto[k]); if (j >= 0) { pos = j + 1; break; } }
    out.splice(pos, 0, id);
    drin.add(id);
  });
  return out;
};

const portName = (X, end) => X.portRef.get(`${end.dev}:${end.port}`)?.port.name || "?";

/* Zeilen der Patchliste */
export const patchZeilen = (P, X) => {
  const T = buildTree(P, X);
  const stapelVon = new Map();
  for (const s of P.layout?.stapel || []) for (const id of s.ids) stapelVon.set(id, s);
  return patchReihenfolge(P, X, T).map((id, n) => {
    const d = X.devById.get(id);
    const up = T.treeConn.get(id);
    let gesteckt = "", aufSwitch = null;
    if (up) {
      const o = otherEnd(up, id), self = thisEnd(up, id);
      const od = X.devById.get(o.dev);
      aufSwitch = od?.id || null;
      gesteckt = `${od?.name || "?"} · Port ${portName(X, o)}${(d.ports || []).length > 1 ? ` ← ${portName(X, self)}` : ""}`;
    }
    // Kabel nach eigenem Port sortiert (Port 1, 2, 3 …)
    const conns = [...(X.connsByDev.get(id) || [])].sort((a, b) => portIndex(d, thisEnd(a, id).port) - portIndex(d, thisEnd(b, id).port));
    const kabel = conns.filter((c) => c !== up).map((c) => {
      const o = otherEnd(c, id), self = thisEnd(c, id);
      return `${portName(X, self)} → ${X.devById.get(o.dev)?.name || "?"} · ${portName(X, o)}`;
    });
    const alleKabel = conns.map((c) => {
      const o = otherEnd(c, id), self = thisEnd(c, id);
      return `${portName(X, self)} → ${X.devById.get(o.dev)?.name || "?"} · ${portName(X, o)} (${kabelLabel(c.kabel)}${c.label ? ", " + c.label : ""})`;
    });
    const ips = ipPorts(d).filter((i) => i.ip || i.dhcp).map((i) => {
      const v = X.vlanById.get(i.vlan);
      return `${ipPorts(d).length > 1 ? i.name + ": " : ""}${i.ip ? `${i.ip}/${i.prefix}` : "DHCP"}${v ? ` (VLAN ${v.vid})` : ""}`;
    });
    const s = stapelVon.get(id);
    return {
      nr: n + 1, id, name: d.name, netzname: d.netzname || "", modell: [d.hersteller, d.modell].filter(Boolean).join(" ") || TYPEN[d.typ]?.label || "",
      ips, gesteckt, aufSwitch, weitereKabel: kabel, kabel: alleKabel,
      felder: (d.felder || []).filter((f) => f.wert).map((f) => `${f.name}: ${f.wert}`),
      abteilung: d.kategorie || "", standort: d.bereich || "", stapel: s ? s.name || "Stapel" : "",
      notizen: d.notizen || "", isSwitch: !!d.isSwitch,
    };
  });
};

/* Flache Tabellenzeilen für Excel/CSV/PDF */
export const patchExportZeilen = (P, X) => patchZeilen(P, X).map((z) => ({
  "#": z.nr, Gerät: z.name, Netzwerkname: z.netzname, Modell: z.modell, "IPs / Interfaces": z.ips.join(", "),
  "Gesteckt auf": z.gesteckt, Kabel: z.kabel.join("; "), Stapel: z.stapel, Abteilung: z.abteilung, Standort: z.standort,
  Felder: z.felder.join("; "), Notizen: z.notizen, "Notizen vor Ort": "", Erledigt: "",
}));
