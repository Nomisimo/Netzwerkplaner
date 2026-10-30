// Vorschlag für VLAN-Schnittstellen am eigenen Rechner (Live › VLANs am Rechner, macOS):
// je geplantem VLAN eine freie feste IP aus dem Subnetz, sonst DHCP, falls im VLAN aktiv.
import { suggestIp } from "./model.js";
import { parseCidr, prefixToMaskStr, subnetsOverlap } from "./net.js";

// interfaces: Netzwerkkarten des Rechners ({ name, cidr }), eigeneDevs: Geräte der schon angelegten App-VLANs (vlan0 …)
export function vlanPcVorschlag(P, interfaces = [], eigeneDevs = []) {
  return [...(P.vlans || [])].sort((a, b) => a.vid - b.vid).map((v) => {
    const c = parseCidr(v.subnetz || "");
    const ip = c ? suggestIp(P, v) : null;
    const ueber = c && interfaces.find((i) => !eigeneDevs.includes(i.name) && i.cidr && subnetsOverlap(i.cidr, c.cidr));
    const dhcp = !ip && !!v.dhcp?.aktiv;
    const moeglich = !!ip || dhcp;
    let hinweis = "";
    if (v.vid === 1) hinweis = "VLAN 1 ist am Trunk meist ungetaggt; dafür reicht die Netzwerkkarte selbst.";
    else if (ueber) hinweis = `Schon über ${ueber.name} (${ueber.cidr}) erreichbar.`;
    else if (!moeglich) hinweis = c ? "Keine freie IP im Subnetz." : "Kein Subnetz eingetragen.";
    return {
      vlanId: v.id, vid: v.vid, name: v.name, farbe: v.farbe, subnetz: c?.cidr || "",
      ip: ip || "", mask: c ? prefixToMaskStr(c.prefix) : "", dhcp, dhcpMoeglich: !!v.dhcp?.aktiv,
      an: moeglich && v.vid !== 1 && !ueber, hinweis,
    };
  });
}
