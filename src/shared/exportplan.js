/* ── Bausteine für die Exporte (ohne DOM, damit sie testbar bleiben) ────────
   - Planversion: Vorschlag für die nächste Version beim Export
   - Exporte immer hell: Farben der dunklen Oberfläche im SVG auf die helle umstellen
   - Gruppen fürs PDF: IPs je VLAN, Geräte je Standort, Ports je Switch */
import { ipPorts, physPorts } from "./catalog.js";
import { otherEnd, webUrl } from "./model.js";
import { ipSort } from "./net.js";
import { vlanBaum, aeusseresVlan } from "./qinq.js";
import { TYPEN } from "./constants.js";

/* ── Planversion ───────────────────────────────────────────────────────── */

// Letzte Zahl hochzählen: "1" → "2", "1.0" → "1.1", "v2.3" → "v2.4", "A" → "A.1"
export const naechsteVersion = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return "1";
  const m = s.match(/^(.*?)(\d+)(\D*)$/);
  return m ? `${m[1]}${+m[2] + 1}${m[3]}` : `${s}.1`;
};

// Fingerabdruck des Plans ohne die Angaben, die der Export selbst setzt
export const planStand = (P) => {
  const { meta, gespeichert, app, ...rest } = P || {};
  const { version, datum, letzterExport, ...m } = meta || {};
  const s = JSON.stringify({ ...rest, meta: m });
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/* Vorschlag im Export-Dialog: wurde diese Version schon exportiert und der Plan hat sich
   seitdem geändert, kommt die nächste Nummer. Sonst bleibt die Version. */
export const versionsVorschlag = (P) => {
  const v = P?.meta?.version || "1";
  const l = P?.meta?.letzterExport;
  const geaendert = !!l && l.version === v && l.stand !== planStand(P);
  return { version: geaendert ? naechsteVersion(v) : v, geaendert, letzter: l || null };
};

/* ── Exporte immer hell ────────────────────────────────────────────────── */

/* Ersetzt im SVG die Flächen- und Textfarben der dunklen Palette durch die hellen (auch mit
   Alpha-Anteil, z. B. #3a424c88). Statusfarben (OK, WARN, ERR, INFO) bleiben, weil VLANs und
   Gewerke dieselben Töne nutzen. Nur aufrufen, wenn die Oberfläche dunkel ist – helle und
   dunkle Palette teilen sich Werte. */
const NEUTRAL = ["DARK", "PANEL", "BG", "CARD", "INPUT", "BTN", "CANVAS", "GRID", "LINE", "LINE2", "MID", "MUTED", "SUB", "TEXT", "TEXT2", "STRONG", "LINK", "TRUNK"];
export const hellMachen = (svg, dunkel, hell, extra = {}) => {
  const map = new Map();
  for (const k of NEUTRAL) { const d = dunkel[k]?.toLowerCase(); if (d && hell[k] && !map.has(d)) map.set(d, hell[k]); }
  for (const [d, h] of Object.entries(extra)) map.set(d.toLowerCase(), h);
  return svg.replace(/#([0-9a-f]{6})([0-9a-f]{2})?(?![0-9a-f])/gi, (all, rgb, a) => {
    const h = map.get("#" + rgb.toLowerCase());
    return h ? h + (a || "") : all;
  });
};

/* ── Gruppen fürs PDF ──────────────────────────────────────────────────── */

const optionen = (v, P) => [
  v.igmp && "IGMP", v.qos && "QoS", v.dhcp?.aktiv && "DHCP", v.eeeAus && "EEE aus",
  aeusseresVlan(v, P.vlans) && `in S-VLAN ${aeusseresVlan(v, P.vlans).vid}`,
].filter(Boolean).join(" · ");

// VLAN-Liste mit den IP-Adressen je VLAN (eine Gruppe je VLAN, zum Schluss „ohne VLAN“)
export const vlanGruppen = (P, X) => {
  const je = new Map();
  for (const d of P.geraete) for (const i of ipPorts(d)) {
    if (!i.ip && !i.dhcp) continue;
    const k = X.vlanById.has(i.vlan) ? i.vlan : null;
    if (!je.has(k)) je.set(k, []);
    je.get(k).push({ ip: i.ip || "DHCP", prefix: i.prefix, geraet: d.name, port: ipPorts(d).length > 1 ? i.name : "", mac: i.mac || "", standort: d.bereich || "", web: webUrl(d) || "" });
  }
  for (const l of je.values()) l.sort((a, b) => ipSort(a.ip, b.ip));
  const gruppen = vlanBaum(P.vlans).map(({ v }) => ({
    vlan: v, vid: v.vid, name: v.name || "", subnetz: v.subnetz || "", gateway: v.gateway || "", zweck: v.zweck || "",
    optionen: optionen(v, P), ips: je.get(v.id) || [],
  }));
  if (je.has(null)) gruppen.push({ vlan: null, vid: "", name: "Ohne VLAN", subnetz: "", gateway: "", zweck: "", optionen: "", ips: je.get(null) });
  return gruppen;
};

// Geräte je Standort, Standorte in der Reihenfolge des Projekts, zum Schluss „ohne Standort“
export const standortGruppen = (P) => {
  const reihe = [...new Set([...(P.bereiche || []), ...P.geraete.map((d) => (d.bereich || "").trim()).filter(Boolean)])];
  const je = new Map(reihe.map((b) => [b, []]));
  const ohne = [];
  for (const d of P.geraete) (je.get((d.bereich || "").trim()) || ohne).push(d);
  const zeile = (d) => ({
    name: d.name, netzname: d.netzname || "", modell: [d.hersteller, d.modell].filter(Boolean).join(" ") || TYPEN[d.typ]?.label || "",
    gewerk: d.kategorie || "", web: webUrl(d) || (d.webUi?.vorhanden ? "ja (IP fehlt)" : ""), protokolle: (d.protokolle || []).join(", "),
    notizen: [...(d.felder || []).filter((f) => f.wert).map((f) => `${f.name}: ${f.wert}`), d.notizen].filter(Boolean).join("\n"),
    isSwitch: !!d.isSwitch,
  });
  const sort = (a, b) => (b.isSwitch - a.isSwitch) || a.name.localeCompare(b.name, "de", { numeric: true });
  const out = reihe.map((b) => ({ standort: b, geraete: je.get(b).map(zeile).sort(sort) })).filter((g) => g.geraete.length);
  if (ohne.length) out.push({ standort: "Ohne Standort", geraete: ohne.map(zeile).sort(sort) });
  return out;
};

// Switch-Konfiguration: je Switch alle Ports mit Modus, VLANs, PoE und Gegenstelle
export const switchGruppen = (P, X) => P.geraete.filter((d) => d.isSwitch).map((sw) => {
  const mgmt = ipPorts(sw).find((i) => i.ip);
  return {
    name: sw.name, modell: [sw.hersteller, sw.modell].filter(Boolean).join(" ") || TYPEN[sw.typ]?.label || "", standort: sw.bereich || "",
    ip: mgmt ? `${mgmt.ip}/${mgmt.prefix}` : "", unmanaged: sw.typ === "switch_unmanaged",
    ports: physPorts(sw).map((p) => {
      const cs = X.connsByPort.get(`${sw.id}:${p.id}`) || [];
      const o = cs[0] ? otherEnd(cs[0], sw.id) : null;
      const od = o ? X.portRef.get(`${o.dev}:${o.port}`) : null;
      const trunk = p.modus === "trunk";
      const vids = trunk ? (p.vlans || []).map((id) => X.vlanById.get(id)?.vid).filter((x) => x != null).sort((a, b) => a - b).join(", ") : X.vlanById.get(p.vlan)?.vid ?? "";
      return { port: p.name, typ: p.typ || "", modus: trunk ? "Trunk" : "Access", vlan: String(vids), poe: p.poe ? "PoE" : "", gegenstelle: od ? `${od.dev.name}${physPorts(od.dev).length > 1 ? ` [${od.port.name}]` : ""}` : "" };
    }),
  };
});

