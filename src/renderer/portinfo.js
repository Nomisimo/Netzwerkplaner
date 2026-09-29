import { connVlan, otherEnd } from "../shared/model.js";

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
    ids = connVlan(c, X).vlans; // unmanaged: VLAN ergibt sich aus der Gegenstelle
  } else {
    const ifc = port.iface ? X.ifaceById.get(port.iface)?.iface : null;
    ids = ifc?.vlan ? [ifc.vlan] : [];
  }
  const vlans = ids.map((id) => X.vlanById.get(id)).filter(Boolean).sort((a, b) => a.vid - b.vid);
  const ifc = port.iface ? X.ifaceById.get(port.iface)?.iface : null;
  return { dev, port, sw: !!dev.isSwitch, managed: managedSw, kind, vlans, ifc };
};

export const vlanKurz = (info) => {
  if (!info) return "";
  if (info.kind === "trunk") return info.vlans.length > 4 ? `Trunk ${info.vlans.length} VLANs` : `Trunk ${info.vlans.map((v) => v.vid).join("·") || "–"}`;
  return info.vlans[0] ? `VLAN ${info.vlans[0].vid}` : "kein VLAN";
};
export const vlanLang = (info) => {
  if (!info) return "";
  if (info.kind === "trunk") return `Trunk (tagged): ${info.vlans.map((v) => `${v.vid} ${v.name}`).join(", ") || "keine VLANs"}`;
  return info.vlans[0] ? `VLAN ${info.vlans[0].vid} ${info.vlans[0].name} (untagged)` : "kein VLAN";
};

// Alle Ports eines Geräts mit Gegenstelle
export const portBelegung = (dev, X) => dev.ports.map((port) => {
  const c = (X.connsByPort.get(`${dev.id}:${port.id}`) || [])[0] || null;
  const self = c ? endInfo(c, c.a.dev === dev.id && c.a.port === port.id ? c.a : c.b, X) : null;
  const o = c ? otherEnd(c, dev.id) : null;
  const other = c ? endInfo(c, o, X) : null;
  return { port, c, self, other };
});
