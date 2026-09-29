import { emptyProject, addConnection, suggestIp } from "./model.js";
import { createDevice, KATALOG_GERAETE } from "./catalog.js";
import { newStream } from "./analyse.js";

// Beispielprojekt: kleines Open Air mit Ton, Licht, Video und Intercom
export const demoProject = () => {
  const P = emptyProject();
  P.meta = { ...P.meta, veranstaltung: "Beispiel Open Air 2026", ort: "Festwiese", ersteller: "", version: "1", notiz: "Beispielprojekt – frei veränderbar." };
  const V = (vid) => P.vlans.find((v) => v.vid === vid);
  const kat = (s) => KATALOG_GERAETE.find((g) => `${g.hersteller} ${g.modell}`.toLowerCase().includes(s.toLowerCase()))?.id || null;
  const add = (name, bereich, { katalog, typ } = {}) => {
    const d = createDevice({ katalogId: katalog ? kat(katalog) : null, typ, vlans: P.vlans, name });
    d.bereich = bereich;
    P.geraete.push(d);
    return d;
  };
  const ip = (d, idx = 0) => {
    const i = d.interfaces[idx];
    if (!i) return;
    const v = P.vlans.find((x) => x.id === i.vlan);
    const a = suggestIp(P, v, i.id);
    if (a) i.ip = a;
  };

  const core = add("CORE Bühne", "Bühne", { katalog: "GigaCore 16Xt" });
  const foh = add("SW FOH", "FOH", { katalog: "GigaCore 10" });
  const mon = add("SW Monitor", "Monitor", { katalog: "GigaCore 10" });
  const sec = add("SW Dante Secondary", "Bühne", { typ: "switch_unmanaged" });
  [core, foh, mon].forEach((s) => { ip(s); s.poeBudget = 0; });
  P.layout.rootId = core.id;

  const cl5 = add("FOH CL5", "FOH", { katalog: "Yamaha CL5" });
  const rio1 = add("Rio A", "Bühne", { katalog: "Rio3224" });
  const rio2 = add("Rio B", "Bühne", { katalog: "Rio3224" });
  const monPult = add("MON QL5", "Monitor", { katalog: "Yamaha QL5" });
  const ulxd = add("ULX-D 1-4", "Monitor", { katalog: "ULXD4Q" });
  const ds10 = add("d&b DS10", "Bühne", { katalog: "DS10" });
  const d80 = add("Amp Rack L", "Bühne", { katalog: "D80" });
  const ma = add("grandMA3 light", "FOH", { katalog: "grandMA3 light" });
  const pu = add("MA3 PU L", "FOH", { katalog: "processing unit L" });
  const node1 = add("Node Truss 1", "Bühne", { katalog: "LumiNode 12" });
  const node2 = add("Node Truss 2", "Bühne", { katalog: "LumiNode 4" });
  const laptop = add("Laptop FOH", "FOH", { typ: "pc" });
  const ap = add("WLAN FOH", "FOH", { katalog: "U7 Pro" });
  const atem = add("ATEM Mini Extreme", "Video-Regie", { katalog: "ATEM Mini" });
  const cam = add("PTZ 1", "FOH", { katalog: "AW-UE150" });
  const gg = add("Green-GO MCX", "Monitor", { katalog: "Green-GO" });

  [cl5, rio1, rio2, monPult, ulxd, ds10, d80, ma, pu, node1, node2, ap, atem, cam, gg].forEach((d) => d.interfaces.forEach((_, i) => ip(d, i)));
  // Laptop: zwei Interfaces (Dante Controller + Management)
  laptop.interfaces[0].name = "Dante";
  laptop.interfaces[0].vlan = V(10).id;
  ip(laptop, 0);
  laptop.protokolle = ["Dante", "OSC"];

  addConnection(P, core.id, foh.id, { kabel: "fiber_sm", label: "FIB-FOH-01" });
  addConnection(P, core.id, mon.id, { kabel: "ethercon", label: "NET-MON-01" });
  for (const [d, sw, m] of [[cl5, foh, 3], [ma, foh, 2], [pu, foh, 2], [laptop, foh, 2], [ap, foh, 3], [cam, foh, 5], [atem, foh, 3],
    [rio1, core, 2], [rio2, core, 2], [ds10, core, 2], [d80, core, 5], [node1, core, 15], [node2, core, 25],
    [monPult, mon, 2], [ulxd, mon, 2], [gg, mon, 2]]) addConnection(P, sw.id, d.id, { kabel: "ethercon" });
  // Dante Secondary auf eigenem Switch
  for (const d of [cl5, rio1, rio2, monPult]) {
    const s = d.ports.find((p) => p.name === "Secondary");
    if (s) addConnection(P, sec.id, d.id, { portB: "Secondary", kabel: "ethercon" });
  }
  core.ports.slice(0, 4).forEach((p) => { if (p.modus === "access") p.poe = true; });
  // Datenströme (was jedes Gerät sendet)
  const strom = (d, o) => { d.stroeme = [...(d.stroeme || []), newStream(o)]; };
  strom(rio1, { proto: "dante", menge: 32, mc: true, ziele: [cl5.id, monPult.id] });
  strom(rio2, { proto: "dante", menge: 32, mc: true, ziele: [cl5.id, monPult.id] });
  strom(cl5, { proto: "dante", menge: 16, ziele: [ds10.id, d80.id] });
  strom(monPult, { proto: "dante", menge: 24, ziele: [rio2.id] });
  strom(ulxd, { proto: "dante", menge: 4, mc: true, ziele: [cl5.id, monPult.id] });
  strom(ma, { proto: "manet", menge: 8 });
  strom(pu, { proto: "sacn", menge: 24 });
  strom(cam, { proto: "ndi", menge: 1, param: { variante: "full", format: "1080p50" } });
  strom(laptop, { proto: "osc", menge: 20 });
  const v20 = V(20); v20.querier = "CORE Bühne";
  const v10 = V(10); v10.querier = "CORE Bühne";
  return P;
};
