import { TYPEN } from "../shared/constants.js";
import { connVlan, otherEnd, unmanagedVlans } from "../shared/model.js";

// Anzeigename eines Ports: reine Nummern als „P12“, sonst der Name
export const portLabel = (port) => (!port ? "?" : /^\d+$/.test(port.name) ? `P${port.name}` : port.name || "?");

// VLAN-Belegung eines Verbindungsendes (wie am Port konfiguriert)
export const endInfo = (c, end, X) => {
  const r = X.portRef.get(`${end.dev}:${end.port}`);
  if (!r) return null;
  const { dev, port } = r;
  const managedSw = dev.isSwitch && dev.typ !== "switch_unmanaged";
  let kind = "access", ids = [];
  if (managedSw) {
    kind = port.modus === "trunk" ? "trunk" : "access";
    ids = kind === "trunk" ? port.vlans || [] : port.vlan ? [port.vlan] : [];
  } else if (dev.isSwitch) {
    // unmanaged: alle VLANs, die an ihm ankommen, liegen auf jedem Port (er trennt nichts)
    ids = unmanagedVlans(X, dev);
    if (!ids.length) ids = connVlan(c, X).vlans;
    if (ids.length > 1) kind = "mehrere";
  } else {
    ids = port.vlan ? [port.vlan] : [];
  }
  const vlans = ids.map((id) => X.vlanById.get(id)).filter(Boolean).sort((a, b) => a.vid - b.vid);
  return { dev, port, sw: !!dev.isSwitch, managed: managedSw, kind, vlans, ifc: dev.isSwitch ? null : port };
};

export const vlanKurz = (info) => {
  if (!info) return "";
  if (info.kind === "trunk") return info.vlans.length > 4 ? `Trunk ${info.vlans.length} VLANs` : `Trunk ${info.vlans.map((v) => v.vid).join("·") || "–"}`;
  if (info.kind === "mehrere") return `VLAN ${info.vlans.map((v) => v.vid).join("+")}`;
  return info.vlans[0] ? `VLAN ${info.vlans[0].vid}` : "kein VLAN";
};
export const vlanLang = (info) => {
  if (!info) return "";
  if (info.kind === "trunk") return `Trunk (tagged): ${info.vlans.map((v) => `${v.vid} ${v.name}`).join(", ") || "keine VLANs"}`;
  if (info.kind === "mehrere") return `Unmanaged, mehrere VLANs gemischt: ${info.vlans.map((v) => `${v.vid} ${v.name}`).join(", ")}`;
  return info.vlans[0] ? `VLAN ${info.vlans[0].vid} ${info.vlans[0].name} (untagged)` : "kein VLAN";
};

// Alle Ports eines Geräts mit Gegenstelle
export const portBelegung = (dev, X) => dev.ports.filter((p) => !p.virtuell).map((port) => {
  const c = (X.connsByPort.get(`${dev.id}:${port.id}`) || [])[0] || null;
  const self = c ? endInfo(c, c.a.dev === dev.id && c.a.port === port.id ? c.a : c.b, X) : null;
  const o = c ? otherEnd(c, dev.id) : null;
  const other = c ? endInfo(c, o, X) : null;
  return { port, c, self, other };
});

// Beschriftung eines Geräts in der Topologie. Ohne Netzwerknamen erscheint der Typ.
export const typName = (d) => d.modell || TYPEN[d.typ]?.label || "Gerät";
export const geraeteTitel = (d, modus) =>
  modus === "netzname" ? d.netzname || typName(d)
  : modus === "typ" ? typName(d)
  : modus?.startsWith("feld:") ? (d.felder || []).find((f) => f.id === modus.slice(5))?.wert || d.name
  : d.name;
