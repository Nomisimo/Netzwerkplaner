/* Absichts-Operationen („Intents“) für den Mehrbenutzerbetrieb.
   Sie laufen auf dem Server gegen den aktuellen Stand, damit freie Ports, freie IPs, eindeutige
   Namen und neue IDs für alle gleich sind (Analyse 4.2, 4.5, 4.11, 4.12). Ohne Sitzung ruft die
   App dieselben Funktionen lokal auf. Jede Funktion verändert `P` und liefert ein Ergebnis-Objekt
   für Hinweise; `{ fehler }` heißt: nichts ändern, Transaktion ablehnen.
   Vorlagen und Bestand liegen pro Rechner, deshalb schickt der Client das fertige Objekt mit. */

import { addConnection, suggestIp } from "./model.js";
import { createDevice, geraetUmbauen } from "./catalog.js";
import { removeDevices, removeConns, removeVlan } from "./invarianten.js";

const itemQuelle = (item) => (item.kind === "vorlage" || item.kind === "bestand" ? item.objekt || null : null);

export const addDevice = (P, { item, connectTo = null, at = null }) => {
  const vorlage = itemQuelle(item);
  if ((item.kind === "vorlage" || item.kind === "bestand") && !vorlage) return { fehler: "Vorlage fehlt" };
  const vorher = new Set(P.vlans.map((v) => v.id));
  const dev = createDevice({ katalogId: item.kind === "katalog" ? item.key : null, typ: item.kind === "typ" ? item.key : null, vlans: P.vlans, eigeneVorlage: vorlage, mitAdressen: item.kind === "bestand" });
  let konflikte = [];
  if (item.kind === "bestand") {
    dev.bestandId = vorlage.id;
    const belegt = new Set(P.geraete.flatMap((g) => g.ports.map((i) => i.ip)).filter(Boolean));
    konflikte = dev.ports.filter((i) => i.ip && belegt.has(i.ip)).map((i) => i.ip);
  }
  // eindeutiger Name
  const names = new Set(P.geraete.map((g) => g.name));
  if (names.has(dev.name)) { let n = 2; while (names.has(`${dev.name} ${n}`)) n++; dev.name = `${dev.name} ${n}`; }
  // Ist ein Endgerät gewählt, an dessen Switch anschließen
  let parent = connectTo && P.geraete.find((g) => g.id === connectTo);
  if (parent && !parent.isSwitch) {
    const c = P.verbindungen.find((c) => (c.a.dev === parent.id || c.b.dev === parent.id) && P.geraete.find((g) => g.id === (c.a.dev === parent.id ? c.b.dev : c.a.dev))?.isSwitch);
    parent = c ? P.geraete.find((g) => g.id === (c.a.dev === parent.id ? c.b.dev : c.a.dev)) : null;
  }
  if (parent) dev.bereich = parent.bereich;
  P.geraete.push(dev);
  const neueVlans = P.vlans.filter((v) => !vorher.has(v.id)).map((v) => `${v.vid} ${v.name}`);
  let voll = null;
  if (parent && !addConnection(P, parent.id, dev.id)) voll = parent.name;
  else if (at) P.layout.pinned = { ...(P.layout.pinned || {}), [dev.id]: at };
  return { id: dev.id, konflikte, neueVlans, voll };
};

export const connect = (P, { from, to, opts = {} }) => {
  if (!P.geraete.some((g) => g.id === from) || !P.geraete.some((g) => g.id === to)) return { fehler: "Gerät wurde inzwischen gelöscht" };
  const id = addConnection(P, from, to, opts);
  return id ? { id } : { fehler: "Kein freier Anschluss (mehr)" };
};

export const allocIp = (P, { dev, port, vlan }) => {
  const d = P.geraete.find((g) => g.id === dev);
  const p = d?.ports.find((x) => x.id === port);
  if (!p) return { fehler: "Port wurde inzwischen gelöscht" };
  const v = P.vlans.find((x) => x.id === (vlan ?? p.vlan));
  const ip = suggestIp(P, v, p.id);
  if (!ip) return { fehler: "Keine freie Adresse im VLAN" };
  p.ip = ip;
  return { ip };
};

export const umbauen = (P, { dev, item }) => {
  if (!P.geraete.some((g) => g.id === dev)) return { fehler: "Gerät wurde inzwischen gelöscht" };
  const quelle = itemQuelle(item);
  const ausBestand = item.kind === "bestand" && !!quelle;
  const neu = createDevice({ katalogId: item.kind === "katalog" ? item.key : null, typ: item.kind === "typ" ? item.key : null, vlans: P.vlans, eigeneVorlage: quelle, mitAdressen: ausBestand });
  let konflikte = [];
  if (ausBestand) {
    neu.bestandId = quelle.id;
    const belegt = new Set(P.geraete.filter((g) => g.id !== dev).flatMap((g) => g.ports.map((i) => i.ip)).filter(Boolean));
    konflikte = neu.ports.filter((i) => i.ip && belegt.has(i.ip)).map((i) => i.ip);
  }
  geraetUmbauen(P, dev, neu, { ausBestand });
  return { konflikte };
};

export const loescheGeraete = (P, { ids }) => { removeDevices(P, ids); return {}; };
export const loescheVerbindungen = (P, { ids }) => { removeConns(P, ids); return {}; };
export const loescheVlan = (P, { id }) => { removeVlan(P, id); return {}; };

export const INTENTS = { addDevice, connect, allocIp, umbauen, loescheGeraete, loescheVerbindungen, loescheVlan };
