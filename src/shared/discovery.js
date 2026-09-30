/* ── Discovery ──────────────────────────────────────────────────────────────
   Führt die Funde der Live-Monitore (Netzwerkscan, Art-Net-Poll, sACN, Dante/NDI
   per mDNS, MA-Net, CITP, PTP) je IP zusammen. Gefundene Geräte, die nicht im
   Plan stehen, werden als generische Einträge eingefügt und lassen sich danach
   per „Modell zuweisen“ oder „Leeres Gerät anlegen“ genauer bestimmen. */
import { createDevice, newPort, ipPorts } from "./catalog.js";
import { inSubnet } from "./net.js";
import { findPlanned } from "./live.js";

// Dienste und TCP-Ports, die auf ein Protokoll oder einen Gerätetyp hinweisen
const PORT_HINWEIS = { 4440: ["Dante"], 5959: ["NDI"], 30021: ["MA-Net3"], 49280: ["Yamaha RCP"], 161: ["SNMP"] };
const CITP_TYP = { LightingConsole: "lichtpult", MediaServer: "medienserver", Visualizer: "pc" };
const hostname = (s) => String(s || "").replace(/\.local\.?$/i, "").split(".")[0];
const ndiHost = (label) => String(label || "").split(" (")[0];

export const sammleFunde = (snaps = {}) => {
  const byIp = new Map();
  const fund = (ip) => {
    if (!ip) return null;
    if (!byIp.has(ip)) byIp.set(ip, { ip, mac: "", namen: {}, protokolle: new Set(), typen: {}, quellen: new Set(), ports: [] });
    return byIp.get(ip);
  };
  const s = snaps;
  for (const h of s.scan?.hosts || []) {
    if (h.self) continue;
    const f = fund(h.ip);
    f.quellen.add("Scan");
    if (h.mac) f.mac = h.mac;
    if (h.name) f.namen.scan = hostname(h.name);
    f.ports = h.open || [];
    for (const p of f.ports) for (const x of PORT_HINWEIS[p] || []) f.protokolle.add(x);
    if (f.ports.includes(49280)) f.typen.scan = "mischpult";
  }
  for (const n of s.artnet?.nodes || []) {
    const f = fund(n.ip);
    f.quellen.add("Art-Net");
    f.protokolle.add("Art-Net");
    if (n.mac && !/^0{2}(:0{2}){5}$/.test(n.mac)) f.mac = f.mac || n.mac;
    f.namen.artnet = n.shortName || n.longName;
    f.typen.artnet = /grandma|console|pult/i.test(`${n.shortName} ${n.longName}`) ? "lichtpult" : "node";
  }
  for (const u of s.sacn?.universes || []) for (const q of u.sources || []) {
    const f = fund(q.ip);
    f.quellen.add("sACN"); f.protokolle.add("sACN (E1.31)");
    if (q.source) f.namen.sacn = q.source;
    f.typen.sacn = f.typen.sacn || "lichtpult";
  }
  for (const d of s.sacn?.discovery || []) {
    const f = fund(d.ip);
    f.quellen.add("sACN"); f.protokolle.add("sACN (E1.31)");
    if (d.source) f.namen.sacn = d.source;
    f.typen.sacn = f.typen.sacn || "lichtpult";
  }
  for (const i of s.dante?.instances || []) {
    const f = fund(i.ip);
    if (!f) continue;
    f.quellen.add("Dante"); f.protokolle.add("Dante");
    const kanal = String(i.service || "").startsWith("_netaudio-chan") && String(i.label).includes("@");
    const nm = kanal ? i.label.slice(i.label.lastIndexOf("@") + 1) : i.label;
    if (!kanal || !f.namen.dante) f.namen.dante = nm || hostname(i.host) || f.namen.dante;
  }
  for (const i of s.ndi?.instances || []) {
    const f = fund(i.ip);
    if (!f) continue;
    f.quellen.add("NDI"); f.protokolle.add("NDI");
    f.namen.ndi = f.namen.ndi || ndiHost(i.label) || hostname(i.host);
  }
  for (const fl of s.manet?.flows || []) {
    const f = fund(fl.ip);
    f.quellen.add("MA-Net"); f.protokolle.add(/3/.test(fl.netz || "") ? "MA-Net3" : fl.netz || "MA-Net");
    f.typen.manet = "lichtpult";
  }
  for (const p of s.citp?.peers || []) {
    const f = fund(p.ip);
    f.quellen.add("CITP"); f.protokolle.add("CITP");
    if (p.name) f.namen.citp = p.name;
    if (CITP_TYP[p.type]) f.typen.citp = CITP_TYP[p.type];
  }
  for (const c of s.ptp?.clocks || []) {
    const f = fund(c.ip);
    if (!f) continue;
    f.quellen.add("PTP"); f.protokolle.add("PTP");
  }
  return [...byIp.values()].map((f) => ({
    ip: f.ip, mac: f.mac,
    name: f.namen.dante || f.namen.artnet || f.namen.citp || f.namen.sacn || f.namen.ndi || f.namen.scan || "",
    protokolle: [...f.protokolle],
    typ: f.typen.citp || f.typen.artnet || f.typen.manet || f.typen.scan || f.typen.sacn || null,
    quellen: [...f.quellen],
    ports: f.ports,
  })).sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }));
};

// Funde mit dem Plan abgleichen: im Plan (per IP oder MAC) oder neu
export const fundeMitPlan = (P, funde) => funde.map((f) => ({ ...f, plan: findPlanned(P, { ip: f.ip, mac: f.mac }) }));

// Generisches Gerät aus einem Fund. „generisch“ zeigt im Editor nur „Modell zuweisen“ und „Leeres Gerät anlegen“.
export const fundZuGeraet = (f, vlans) => {
  const dev = createDevice({ typ: "sonstiges", vlans, name: f.name || `Gerät ${f.ip}` });
  let ifc = ipPorts(dev)[0];
  if (!ifc) { ifc = newPort({ name: "LAN" }); dev.ports.push(ifc); }
  ifc.ip = f.ip; ifc.mac = f.mac || "";
  const v = vlans.find((v) => v.subnetz && inSubnet(f.ip, v.subnetz));
  if (v) ifc.vlan = v.id;
  if (f.name) dev.netzname = f.name;
  dev.protokolle = f.protokolle;
  dev.generisch = true;
  if (f.typ) dev.typVorschlag = f.typ;
  dev.notizen = `Per Discovery gefunden (${f.quellen.join(", ")}) am ${new Date().toLocaleDateString("de-DE")}.`;
  return dev;
};
