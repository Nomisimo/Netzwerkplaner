/* ── Clean Cat: aufgeräumter Signalfluss-Plan ──────────────────────────────
   Räume (Standort/Ast) als gestrichelte Bereiche, Geräte als farbige Blöcke,
   Leitungen rechtwinklig mit Dante Primary rot und Secondary grün. Je Raum
   bildet jeder Switch eine Gruppe: seine Endgeräte stehen in Reihen darüber, die
   Leitungen laufen in eigenen Spuren durch die Lücken. Alles andere (Switch zu
   Switch, Geräte an Switches in anderen Räumen) läuft unter dem Raum entlang;
   Verbindungen zwischen Räumen über eine gemeinsame Trasse unter allen Räumen.
   Ergebnis in Weltkoordinaten: { w, h, raeume, boxen, linien }. */
import { KATEGORIEN, KABEL } from "./constants.js";
import { physPorts, ipPorts } from "./catalog.js";

export const CC_FARBEN = { primary: "#e53935", secondary: "#2e9e44", glas: "#c05bd6", trunk: "#3a3f45", sonst: "#55595f" };
export const CC_SWITCH_FILL = "#fff176";
export const ccKatFill = (kat) => mische((KATEGORIEN[kat] || KATEGORIEN.Sonstiges).color, 0.5);
const SPUR = 7, MAX_SPALTEN = 6, RAUM_KOPF = 34, RAUM_RAND = 22, GRUPPE_ABSTAND = 46, RAUM_ABSTAND = 70;

const mische = (hex, anteil = 0.55) => {
  const n = parseInt(hex.slice(1), 16);
  const k = (v) => Math.round(v + (255 - v) * anteil);
  return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => k(v).toString(16).padStart(2, "0")).join("");
};
const textB = (s, px, mono = false) => String(s || "").length * px * (mono ? 0.62 : 0.56);

/* Text passend für eine Breite: erst kleiner (bis minPx), dann mit „…“ kürzen.
   Die Zeichnung misst danach noch einmal genau und staucht notfalls (textLength). */
export const passeText = (t, px, maxW, minPx = px, mono = false) => {
  const s = String(t || "");
  if (textB(s, px, mono) <= maxW) return { t: s, fs: px };
  const fs = Math.max(minPx, Math.floor((px * maxW) / textB(s, px, mono) * 10) / 10);
  if (textB(s, fs, mono) <= maxW) return { t: s, fs };
  let k = s;
  while (k.length > 1 && textB(k + "…", fs, mono) > maxW) k = k.slice(0, -1);
  return { t: k.trimEnd() + "…", fs, voll: s };
};

/* Text auf höchstens maxZeilen Zeilen umbrechen; was nicht passt, endet mit „…“. */
export const umbrechen = (t, px, maxW, maxZeilen = 2) => {
  const woerter = String(t || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const zeilen = [];
  let z = "";
  for (let i = 0; i < woerter.length; i++) {
    const w = woerter[i], neu = z ? z + " " + w : w;
    if (textB(neu, px) <= maxW || !z) { z = neu; continue; }
    zeilen.push(z); z = w;
    if (zeilen.length === maxZeilen) { z = ""; break; }
  }
  if (z) zeilen.push(z);
  const rest = zeilen.length === maxZeilen && zeilen.join(" ").length < woerter.join(" ").length;
  return zeilen.map((zl, i) => {
    const f = passeText(rest && i === zeilen.length - 1 ? zl + " …" : zl, px, maxW, px);
    return f.t;
  });
};

/* Feste Größen: alle Endgeräte gleich breit, Switches nach Portzahl
   (gleiches Modell = gleiche Größe, egal wie viel angeschlossen ist). */
export const CC_BOX_W = 150;
export const ccBoxBreite = (d) => (d.isSwitch ? Math.max(170, Math.min(340, physPorts(d).length * 8 + 40)) : CC_BOX_W);
const INNEN = 10; // Textabstand links und rechts in der Box
// Zeichenfläche des A3-Blatts (siehe ccBlatt), nach ihr richtet sich die Reihenaufteilung
const CC_FLAECHE = { w: 1572, h: 928 };
const istGlas = (c) => /fiber|opticalcon/.test(c.kabel || "");

// Text mittig über das längste waagrechte Stück einer Leitung (wenn er hinpasst)
const textAufLinie = (pts, t) => {
  let best = null;
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    if (Math.abs(a[1] - b[1]) > 0.01) continue;
    const l = Math.abs(a[0] - b[0]);
    if (!best || l > best.l) best = { l, x: (a[0] + b[0]) / 2, y: a[1] };
  }
  return best && best.l > textB(t, 8) + 10 ? { x: best.x, y: best.y - 2.5, t, anchor: "middle" } : null;
};

export const ccRolle = (port) => (/primary|\bpri\b/i.test(port?.name || "") ? "primary" : /secondary|\bsec\b/i.test(port?.name || "") ? "secondary" : null);

/* ordnung: Reihenfolge von Standorten, Switch-Gruppen je Raum und Geräten je Gruppe
   (von cleanCatOptimieren). */
const nachListe = (arr, liste, key = (x) => x.id) => {
  if (!liste) return arr;
  const i = new Map(liste.map((id, k) => [id, k]));
  return arr.map((x, k) => [x, k]).sort((a, b) => (i.get(key(a[0])) ?? 1e6 + a[1]) - (i.get(key(b[0])) ?? 1e6 + b[1])).map((x) => x[0]);
};
// Anmerkung zu einem Standort (Projektseite); erscheint nur in Clean Cat
export const ccAnmerkung = (P, name) => String(P.standortInfo?.[name]?.anmerkung || "").trim();
const NOTIZ_PX = 8.5, NOTIZ_ZEILE = 10.5, ANM_PX = 10, ANM_ZEILE = 12.5;
export const cleanCatLayout = (P, X, { farbe = "dante", zeigeIp = true, ordnung = null } = {}) => {
  const genutzt = { standorte: [], gruppen: {}, oben: {} };
  // Alle Boxen gleich hoch: gibt es irgendwo eine Notiz, bekommen alle Platz für zwei Notizzeilen
  const BASIS_H = zeigeIp ? 52 : 40;
  const mitNotiz = P.geraete.some((d) => String(d.notizen || "").trim());
  const BOX_H = BASIS_H + (mitNotiz ? 2 * NOTIZ_ZEILE + 5 : 0);
  /* Räume: je Standort, darin je Stack ein eigener Unterraum. Schlüssel eines
     Stack-Raums = Standort + \u0001 + Stack-ID; alles andere liegt im Standort selbst. */
  const standortVon = (d) => (d.bereich || "").trim() || "Ohne Standort";
  const stapelListe = (P.layout?.stapel || []).filter((st) => st.ids.length > 1);
  const stapelVonId = new Map();
  stapelListe.forEach((st, i) => st.ids.forEach((id) => stapelVonId.set(id, { st, nr: i + 1 })));
  const raumVon = (d) => { const x = stapelVonId.get(d.id); return x ? `${standortVon(d)}\u0001${x.st.id}` : standortVon(d); };
  const raumInfo = new Map(); // Schlüssel → { standort, stapel (Titel oder null), rang }
  for (const d of P.geraete) {
    const k = raumVon(d), x = stapelVonId.get(d.id);
    if (!raumInfo.has(k)) raumInfo.set(k, { standort: standortVon(d), stapel: x ? x.st.name || `Stack ${x.nr}` : null, rang: x ? x.nr : 0 });
  }
  const box = (d) => {
    const sub = [d.hersteller, d.modell].filter(Boolean).join(" ") || "";
    const ip = zeigeIp ? ipPorts(d).map((p) => p.ip).filter(Boolean).slice(0, 2).join(" · ") : "";
    const w = ccBoxBreite(d), frei = w - INNEN * 2;
    const fill = d.isSwitch ? CC_SWITCH_FILL : ccKatFill(d.kategorie);
    const notiz = String(d.notizen || "").trim();
    return { id: d.id, name: d.name, sub, ip, w, h: BOX_H, basisH: BASIS_H, fill, isSwitch: !!d.isSwitch, kategorie: d.kategorie,
      notiz: notiz ? umbrechen(notiz, NOTIZ_PX, frei, 2) : null, notizVoll: notiz || null,
      tName: passeText(d.name, 12.5, frei, 9.5), tSub: sub ? passeText(sub, 9.5, frei, 8) : null, tIp: ip ? passeText(ip, 9.5, frei, 7.5, true) : null };
  };

  // Verbindungen je Gerät
  const conns = P.verbindungen.filter((c) => X.devById.has(c.a.dev) && X.devById.has(c.b.dev) && c.a.dev !== c.b.dev);
  const vonDev = new Map();
  for (const c of conns) for (const e of [c.a, c.b]) { if (!vonDev.has(e.dev)) vonDev.set(e.dev, []); vonDev.get(e.dev).push(c); }
  const anderes = (c, id) => (c.a.dev === id ? c.b : c.a);
  const eigenes = (c, id) => (c.a.dev === id ? c.a : c.b);

  // Räume in Reihenfolge der Projekt-Standorte, dann alphabetisch, „Ohne Standort“ zuletzt
  const namen = [...new Set(P.geraete.map(raumVon))];
  const rang = (n) => (n === "Ohne Standort" ? 1e6 : P.bereiche.indexOf(n) >= 0 ? P.bereiche.indexOf(n) : 1e3);
  const sInfo = (k) => raumInfo.get(k);
  const oRang = (st) => { const i = ordnung?.standorte?.indexOf(st) ?? -1; return i >= 0 ? i - 1e6 : rang(st); };
  namen.sort((a, b) => oRang(sInfo(a).standort) - oRang(sInfo(b).standort) || sInfo(a).standort.localeCompare(sInfo(b).standort, "de") || sInfo(a).rang - sInfo(b).rang);
  for (const n of namen) if (!genutzt.standorte.includes(sInfo(n).standort)) genutzt.standorte.push(sInfo(n).standort);

  // Gruppen: je Switch eine, Endgeräte zum Switch ihres Primary-/ersten Anschlusses im selben Raum
  const gruppeVon = new Map(); // devId → switchId (oder "lose:raum")
  for (const d of P.geraete) {
    if (d.isSwitch) { gruppeVon.set(d.id, d.id); continue; }
    const cs = (vonDev.get(d.id) || []).map((c) => ({ c, mein: eigenes(c, d.id), ziel: X.devById.get(anderes(c, d.id).dev) }))
      .filter((x) => x.ziel.isSwitch && raumVon(x.ziel) === raumVon(d));
    cs.sort((x, y) => (ccRolle(x.mein && d.ports.find((p) => p.id === x.mein.port)) === "primary" ? -1 : 0) - (ccRolle(y.mein && d.ports.find((p) => p.id === y.mein.port)) === "primary" ? -1 : 0));
    gruppeVon.set(d.id, cs[0] ? cs[0].ziel.id : "lose:" + raumVon(d));
  }
  // Lokal: Endgerät ↔ Switch seiner Gruppe
  const lokal = (c) => {
    const A = X.devById.get(c.a.dev), B = X.devById.get(c.b.dev);
    return (!A.isSwitch && B.isSwitch && gruppeVon.get(A.id) === B.id) || (!B.isSwitch && A.isSwitch && gruppeVon.get(B.id) === A.id);
  };

  const boxen = new Map(), raeume = [], linien = [];
  const portVon = (e) => X.portRef.get(`${e.dev}:${e.port}`)?.port;

  // Farbe und Beschriftung einer Leitung
  const stil = (c) => {
    const A = X.devById.get(c.a.dev), B = X.devById.get(c.b.dev);
    const end = !A.isSwitch ? c.a : !B.isSwitch ? c.b : null;
    const rolle = end ? ccRolle(portVon(end)) : null;
    let col = CC_FARBEN.sonst, text = "", leg = "Sonstige Verbindung";
    if (farbe === "vlan") {
      const p = end ? portVon(end) : null;
      const v = p && X.vlanById.get(p.vlan);
      col = v ? v.farbe : A.isSwitch && B.isSwitch ? CC_FARBEN.trunk : CC_FARBEN.sonst;
      text = v ? `${v.vid} ${v.name}` : A.isSwitch && B.isSwitch ? "Trunk" : "";
      leg = v ? `VLAN ${v.vid} ${v.name}` : A.isSwitch && B.isSwitch ? "Trunk (Switch zu Switch)" : "Ohne VLAN";
    } else if (rolle) { col = CC_FARBEN[rolle]; text = rolle === "primary" ? "Dante Primary" : "Dante Secondary"; leg = text; }
    else if (istGlas(c)) { col = CC_FARBEN.glas; leg = "Glasfaser"; }
    else if (A.isSwitch && B.isSwitch) { col = CC_FARBEN.trunk; leg = "Switch zu Switch"; }
    return { col, text, leg, dash: c.kabel === "wlan" ? "4 4" : c.kabel === "p2p" ? "8 3 2 3" : "" };
  };

  /* ── Räume aufbauen ── */
  let x0 = 0;
  const trunkEnden = []; // { c, devId, x, yAus (Raumunterkante des Ausgangs), raum }
  for (const rn of namen) {
    const devs = P.geraete.filter((d) => raumVon(d) === rn);
    const switches = nachListe(devs.filter((d) => d.isSwitch).sort((a, b) => (vonDev.get(b.id)?.length || 0) - (vonDev.get(a.id)?.length || 0) || a.name.localeCompare(b.name, "de")), ordnung?.gruppen?.[rn]);
    genutzt.gruppen[rn] = switches.map((d) => d.id);
    const lose = devs.filter((d) => !d.isSwitch && gruppeVon.get(d.id) === "lose:" + rn);
    const gruppen = switches.map((s) => ({ sw: s, oben: devs.filter((d) => !d.isSwitch && gruppeVon.get(d.id) === s.id) }));
    if (lose.length) gruppen.push({ sw: null, lose });
    const sortK = (a, b) => (a.kategorie || "").localeCompare(b.kategorie || "") || a.name.localeCompare(b.name, "de");

    // Gruppen vorbereiten: Reihen, Spalten, Spuren zählen
    for (const g of gruppen) {
      const gk = g.sw ? g.sw.id : "lose:" + rn;
      g.oben = nachListe((g.oben || []).sort(sortK), ordnung?.oben?.[gk]);
      genutzt.oben[gk] = g.oben.map((d) => d.id);
      const n = g.oben.length;
      g.spalten = Math.min(Math.max(n, 1), MAX_SPALTEN);
      g.reihen = n ? Math.ceil(n / g.spalten) : 0;
      g.zellen = g.oben.map((d, i) => ({ d, b: box(d), r: Math.floor(i / g.spalten), s: i % g.spalten }));
      g.spurReihe = Array(g.reihen).fill(0); // Spuren in der Lücke unter Reihe r (r = reihen-1: Lücke zum Switch)
      g.spurSpalte = Array(g.spalten + 1).fill(0); // Spuren in Spaltenlücke k (zwischen Spalte k-1 und k)
      g.spurRand = 0;
      g.unten = g.sw ? [{ d: g.sw, b: box(g.sw) }] : (g.lose || []).sort(sortK).map((d) => ({ d, b: box(d) }));
      g.wege = []; // je Leitung, die in dieser Gruppe beginnt
      for (const z of g.zellen) {
        for (const c of vonDev.get(z.d.id) || []) {
          if (lokal(c)) {
            const unten = z.r === g.reihen - 1;
            const sp = z.s === g.spalten - 1 && g.spalten > 1 ? z.s : z.s + 1; // Lücke rechts, bei der letzten Spalte links
            g.wege.push({ c, z, art: "lokal", gapR: z.r, spalteGap: unten ? null : sp });
            if (!unten) { g.spurReihe[z.r]++; g.spurSpalte[sp]++; }
            g.spurReihe[g.reihen - 1]++;
          } else { g.wege.push({ c, z, art: "trunk" }); g.spurReihe[z.r]++; g.spurRand++; }
        }
      }
    }
    // Spaltenbreiten und Gruppenbreiten
    let gx = x0 + RAUM_RAND;
    const kopfY = 0, obenY = RAUM_KOPF + 10;
    const reihenH = (g) => g.spurReihe.map((n) => 26 + n * SPUR);
    const obenHoehe = (g) => (g.reihen ? g.reihen * BOX_H + reihenH(g).reduce((a, b) => a + b, 0) : 0);
    const maxOben = Math.max(0, ...gruppen.map(obenHoehe));
    const unterY = obenY + maxOben; // Oberkante der Switch-Reihe
    for (const g of gruppen) {
      const spW = Array.from({ length: g.spalten }, (_, s) => Math.max(0, ...g.zellen.filter((z) => z.s === s).map((z) => z.b.w)));
      const gapW = g.spurSpalte.map((n, k) => (k === 0 || k === g.spalten ? 0 : 30 + n * SPUR));
      const randW = g.spurRand ? 14 + g.spurRand * SPUR : 0; // links und rechts je eine Randzone
      const obenW = spW.reduce((a, b) => a + b, 0) + gapW.reduce((a, b) => a + b, 0);
      const untenW = g.unten.reduce((a, u) => a + u.b.w, 0) + Math.max(0, g.unten.length - 1) * 24;
      // Switch breit genug für seine Anschlüsse
      const untenW2 = g.unten.reduce((a, u) => a + u.b.w, 0) + Math.max(0, g.unten.length - 1) * 24;
      const innenW = Math.max(obenW, untenW2, untenW);
      g.x = gx; g.w = randW * 2 + innenW; g.randX = gx; g.randXr = gx + randW + innenW; // Randspuren links und rechts
      // Zellen platzieren (bündig nach unten)
      const startY = unterY - obenHoehe(g);
      const rh = reihenH(g);
      let ox = gx + randW + (innenW - obenW) / 2;
      const spaltenX = [];
      for (let s = 0; s < g.spalten; s++) { ox += gapW[s]; spaltenX[s] = ox; ox += spW[s]; }
      g.gapX = g.spurSpalte.map((_, k) => (k === 0 ? spaltenX[0] : k === g.spalten ? spaltenX[g.spalten - 1] + spW[g.spalten - 1] : spaltenX[k] - gapW[k])); // linke Kante der Lücke
      g.gapW = gapW;
      let ry = startY;
      g.reiheY = [];
      for (let r = 0; r < g.reihen; r++) { g.reiheY[r] = ry; ry += BOX_H + rh[r]; }
      g.gapY = g.reiheY.map((y) => y + BOX_H); // Oberkante der Lücke unter Reihe r
      for (const z of g.zellen) {
        const x = spaltenX[z.s] + (spW[z.s] - z.b.w) / 2;
        boxen.set(z.d.id, { ...z.b, x, y: g.reiheY[z.r] });
      }
      let ux = gx + randW + (innenW - untenW2) / 2;
      for (const u of g.unten) { boxen.set(u.d.id, { ...u.b, x: ux, y: unterY }); ux += u.b.w + 24; }
      gx += g.w + GRUPPE_ABSTAND;
    }
    const info = sInfo(rn);
    const raumW = Math.max(gx - GRUPPE_ABSTAND - x0 + RAUM_RAND, textB(info.stapel || info.standort, 14) + 60);
    // Räume ohne Gruppenbreite (nur Titel) zentrieren nichts; Boxen bleiben links
    const raum = { name: rn, standort: info.standort, stapel: info.stapel, x: x0, y: kopfY, w: raumW, unterY, gruppen, trunkY: unterY + BOX_H + 18, spurTrunk: 0 };
    raeume.push(raum);
    x0 += raumW + RAUM_ABSTAND;
  }

  /* ── Leitungen ── */
  const dev = (id) => X.devById.get(id);
  const raumVonId = (id) => raeume.find((r) => r.name === raumVon(dev(id)));
  // Anschlusspunkte an Box-Unterkante bzw. -Oberkante gleichmäßig verteilen
  const verteile = (b, n, i) => b.x + (b.w * (i + 1)) / (n + 1);
  const ausgaenge = new Map(); // devId → Zähler für Unterkante
  const unterAnz = new Map();
  for (const c of conns) for (const e of [c.a, c.b]) unterAnz.set(e.dev, (unterAnz.get(e.dev) || 0) + 1);
  const unterX = (id) => { const b = boxen.get(id); const i = ausgaenge.get(id) || 0; ausgaenge.set(id, i + 1); return verteile(b, unterAnz.get(id), i); };

  // Lokale Leitungen je Gruppe
  for (const r of raeume) for (const g of r.gruppen) {
    if (!g.sw) continue;
    const sb = boxen.get(g.sw.id);
    const lok = g.wege.filter((w) => w.art === "lokal");
    const zaehlR = Array(g.reihen).fill(0), zaehlS = Array(g.spalten + 1).fill(0);
    const pfade = lok.map((w) => {
      const b = boxen.get(w.z.d.id);
      const xe = unterX(w.z.d.id);
      const pts = [[xe, b.y + b.h]];
      let xNah = xe;
      if (w.spalteGap != null) {
        const yR = g.gapY[w.z.r] + 12 + zaehlR[w.z.r]++ * SPUR;
        const k = w.spalteGap;
        const xG = g.gapX[k] + 15 + zaehlS[k]++ * SPUR;
        pts.push([xe, yR], [xG, yR]);
        xNah = xG;
      }
      return { w, pts, xNah };
    });
    // Am Switch nach x sortiert anschließen
    pfade.sort((a, b) => a.xNah - b.xNah);
    const letzte = g.reihen - 1;
    pfade.forEach((p, i) => {
      const xs = verteile(sb, pfade.length, i);
      // Spur in der Lücke zum Switch: weiter außen liegende Leitungen tiefer, damit sie sich nicht kreuzen
      const yS = g.gapY[letzte] + 12 + (p.xNah < xs ? i : pfade.length - 1 - i) * SPUR;
      const last = p.pts[p.pts.length - 1];
      p.pts.push([last[0], yS], [xs, yS], [xs, sb.y]);
      const st = stil(p.w.c);
      const swPort = portVon(eigenes(p.w.c, g.sw.id));
      const nz = String(p.w.c.notiz || "").trim();
      const tl = (nz && textAufLinie(p.pts, [st.text, nz].filter(Boolean).join(" · "))) || (st.text && textAufLinie(p.pts, st.text));
      linien.push({ id: p.w.c.id, raum: r.name, von: p.w.z.d.id, bis: g.sw.id, pts: p.pts, ...st, labels: [
        tl,
        swPort && { x: xs - 2, y: sb.y - 3, t: swPort.name, rot: true, an: g.sw.id },
      ].filter(Boolean) });
    });
  }

  // Trunk-Leitungen: jedes Ende in die Trunk-Zone unter seinem Raum
  const randZaehl = new Map(), reiheZaehl = new Map();
  const endeNachUnten = (devId, c) => {
    const b = boxen.get(devId);
    const partner = boxen.get(anderes(c, devId).dev);
    const r = raumVonId(devId);
    const g = r.gruppen.find((gg) => (gg.zellen || []).some((z) => z.d.id === devId));
    const xe = unterX(devId);
    const pts = [[xe, b.y + b.h]];
    if (g) { // Gerät in einer oberen Reihe: zur Randspur links der Gruppe
      const z = g.zellen.find((zz) => zz.d.id === devId);
      const kR = `${g.x}:${z.r}`; const nR = reiheZaehl.get(kR) || 0; reiheZaehl.set(kR, nR + 1);
      const yR = g.gapY[z.r] + 12 + (g.spurReihe[z.r] - 1 - nR) * SPUR;
      const rechts = partner && partner.x + partner.w / 2 > b.x + b.w / 2;
      const kRand = g.x + (rechts ? "r" : "l");
      const nRand = randZaehl.get(kRand) || 0; randZaehl.set(kRand, nRand + 1);
      const xR = rechts ? g.randXr + 6 + nRand * SPUR : g.randX + 8 + nRand * SPUR;
      pts.push([xe, yR], [xR, yR]);
    }
    return { pts, r, c };
  };
  const busLinien = [];
  for (const c of conns) {
    if (lokal(c)) continue;
    const A = endeNachUnten(c.a.dev, c), B = endeNachUnten(c.b.dev, c);
    const st = stil(c);
    const labels = [];
    const portA = portVon(c.a), portB = portVon(c.b);
    if (A.r === B.r) {
      const y = A.r.trunkY + A.r.spurTrunk++ * SPUR;
      const ax = A.pts[A.pts.length - 1][0], bx = B.pts[B.pts.length - 1][0];
      const pts = [...A.pts, [ax, y], [bx, y], ...[...B.pts].reverse()];
      const kab = [c.label || (istGlas(c) ? KABEL[c.kabel]?.label : ""), String(c.notiz || "").trim()].filter(Boolean).join(" · ");
      if (kab) labels.push({ x: (ax + bx) / 2, y: y - 3, t: kab, anchor: "middle" });
      else if (st.text) { const t = textAufLinie(pts, st.text); if (t) labels.push(t); }
      linien.push({ id: c.id, raum: A.r.name, von: c.a.dev, bis: c.b.dev, pts, ...st, labels: [...labels, ...endLabels(A, portA, dev(c.a.dev)), ...endLabels(B, portB, dev(c.b.dev))] });
    } else busLinien.push({ c, A, B, st, portA, portB });
  }
  function endLabels(E, port, d) {
    if (!port || !d || !d.isSwitch) return []; // nur Switch-Ports beschriften, Endgeräte tragen Dante Primary/Secondary an der Linie
    const [x, y] = E.pts[0];
    return [{ x: x + 3, y: y + 10, t: port.name, anchor: "start", an: d.id }];
  }
  // Raumhöhen festlegen
  for (const r of raeume) { r.h = r.trunkY + Math.max(1, r.spurTrunk) * SPUR + 16; }

  /* ── Standorte in Reihen anordnen, damit das A3-Blatt gut gefüllt ist ──
     Ein Standort ist ein Block: ohne Stacks genau sein Raum, mit Stacks ein Rahmen
     um seine Unterräume (erst die Geräte ohne Stack, dann die Stacks). Verbindungen
     zwischen Unterräumen desselben Standorts bleiben in dessen Rahmen (eigene Trasse
     unten im Rahmen). Verbindungen zwischen Standorten laufen in einer Trasse unter
     ihrer Reihe; zwischen zwei Reihen zusätzlich durch einen Schacht links. */
  const BLOCK_RAND = 14, BLOCK_KOPF = 32, STAPEL_ABSTAND = 26;
  const bloecke = [];
  for (const r of raeume) {
    let b = bloecke[bloecke.length - 1];
    if (!b || b.standort !== r.standort) { b = { standort: r.standort, subs: [] }; bloecke.push(b); }
    b.subs.push(r);
  }
  const blockVon = new Map();
  for (const b of bloecke) for (const r of b.subs) blockVon.set(r.name, b);
  const innen = (bl) => blockVon.get(bl.A.r.name) === blockVon.get(bl.B.r.name);
  for (const b of bloecke) {
    b.rahmen = b.subs.length > 1 || b.subs.some((r) => r.stapel);
    const innenW = b.subs.reduce((a, r) => a + r.w, 0) + (b.subs.length - 1) * STAPEL_ABSTAND;
    b.w = b.rahmen ? Math.max(innenW + 2 * BLOCK_RAND, textB(b.standort, 14) + 60) : innenW;
    b.subH = Math.max(...b.subs.map((r) => r.h));
    b.innenSpuren = busLinien.filter((bl) => innen(bl) && blockVon.get(bl.A.r.name) === b).length;
    const trasseH = b.innenSpuren ? 10 + b.innenSpuren * SPUR + 4 : 0;
    const anm = ccAnmerkung(P, b.standort);
    b.anmerkung = anm ? umbrechen(anm, ANM_PX, b.w - 16, 3) : null;
    b.anmH = b.anmerkung ? b.anmerkung.length * ANM_ZEILE + 6 : 0;
    b.kopf = (b.rahmen ? BLOCK_KOPF : 0) + b.anmH;
    b.h = b.rahmen ? b.kopf + b.subH + trasseH + BLOCK_RAND : b.anmH + b.subs[0].h;
  }
  const planen = (grenze) => {
    const reihen = [[]];
    let breite = 0;
    for (const b of bloecke) {
      const zeile = reihen[reihen.length - 1];
      if (zeile.length && breite + RAUM_ABSTAND + b.w > grenze) { reihen.push([b]); breite = b.w; }
      else { zeile.push(b); breite += (zeile.length > 1 ? RAUM_ABSTAND : 0) + b.w; }
    }
    const idx = new Map(); reihen.forEach((z, i) => z.forEach((b) => b.subs.forEach((r) => idx.set(r.name, i))));
    const spuren = reihen.map(() => 0);
    let schacht = 0;
    for (const bl of busLinien) {
      if (innen(bl)) continue;
      const ia = idx.get(bl.A.r.name), ib = idx.get(bl.B.r.name);
      spuren[ia]++; if (ib !== ia) { spuren[ib]++; schacht++; }
    }
    const schachtW = schacht ? 28 + schacht * (SPUR + 2) : 0;
    const zeilenW = reihen.map((z) => z.reduce((a, b) => a + b.w, 0) + (z.length - 1) * RAUM_ABSTAND);
    const zeilenH = reihen.map((z, i) => Math.max(...z.map((b) => b.h)) + (spuren[i] ? 30 + spuren[i] * (SPUR + 4) + 10 : 0));
    const W = schachtW + Math.max(...zeilenW), H = zeilenH.reduce((a, b) => a + b, 0) + (reihen.length - 1) * RAUM_ABSTAND;
    return { reihen, idx, spuren, schachtW, zeilenH, W, H, k: Math.min(CC_FLAECHE.w / W, CC_FLAECHE.h / H) };
  };
  const gesamt = bloecke.reduce((a, b) => a + b.w, 0) + Math.max(0, bloecke.length - 1) * RAUM_ABSTAND;
  const breitester = Math.max(0, ...bloecke.map((b) => b.w));
  let plan = null;
  for (let n = 1; n <= Math.max(1, bloecke.length); n++) {
    const p = planen(Math.max(breitester, gesamt / n + 1));
    if (!plan || p.k > plan.k + 1e-9) plan = p;
  }
  // Blöcke platzieren, Räume, Boxen und Leitungen im Raum mitverschieben
  const versatz = new Map();
  let yZeile = 0;
  plan.reihen.forEach((z, i) => {
    let x = plan.schachtW;
    for (const b of z) {
      b.x = x; b.y = yZeile;
      let sx = x + (b.rahmen ? BLOCK_RAND : 0);
      for (const r of b.subs) {
        versatz.set(r.name, { dx: sx - r.x, dy: yZeile + b.kopf - r.y });
        sx += r.w + STAPEL_ABSTAND;
      }
      x += b.w + RAUM_ABSTAND;
    }
    z.trasseY = yZeile + Math.max(...z.map((b) => b.h)) + 30;
    yZeile += plan.zeilenH[i] + RAUM_ABSTAND;
  });
  const schiebePt = (pt, v) => [pt[0] + v.dx, pt[1] + v.dy];
  for (const r of raeume) { const v = versatz.get(r.name); r.x += v.dx; r.y += v.dy; }
  for (const [id, b] of boxen) { const v = versatz.get(raumVon(dev(id))); b.x += v.dx; b.y += v.dy; }
  for (const l of linien) {
    const v = versatz.get(l.raum);
    l.pts = l.pts.map((pt) => schiebePt(pt, v));
    l.labels = l.labels.map((t) => ({ ...t, x: t.x + v.dx, y: t.y + v.dy }));
  }
  // Leitungen zwischen Räumen
  const spurZaehl = plan.reihen.map(() => 0);
  const innenZaehl = new Map();
  let schachtZaehl = 0;
  for (const bl of busLinien) {
    const { c, A, B, st, portA, portB } = bl;
    const ia = plan.idx.get(A.r.name), ib = plan.idx.get(B.r.name);
    const aPts = A.pts.map((pt) => schiebePt(pt, versatz.get(A.r.name))), bPts = B.pts.map((pt) => schiebePt(pt, versatz.get(B.r.name)));
    const ax = aPts[aPts.length - 1][0], bx = bPts[bPts.length - 1][0];
    let pts, lab;
    if (innen(bl)) { // im selben Standort: Trasse unten im Standort-Rahmen
      const b = blockVon.get(A.r.name), n = innenZaehl.get(b) || 0;
      innenZaehl.set(b, n + 1);
      const y = b.y + b.kopf + b.subH + 10 + n * SPUR;
      pts = [...aPts, [ax, y], [bx, y], ...[...bPts].reverse()];
      lab = { x: (ax + bx) / 2, y: y - 3 };
    } else if (ia === ib) {
      const yA = plan.reihen[ia].trasseY + spurZaehl[ia]++ * (SPUR + 4);
      pts = [...aPts, [ax, yA], [bx, yA], ...[...bPts].reverse()];
      lab = { x: (ax + bx) / 2, y: yA - 3 };
    } else {
      const yA = plan.reihen[ia].trasseY + spurZaehl[ia]++ * (SPUR + 4);
      const yB = plan.reihen[ib].trasseY + spurZaehl[ib]++ * (SPUR + 4);
      const xs = 14 + schachtZaehl++ * (SPUR + 2);
      pts = [...aPts, [ax, yA], [xs, yA], [xs, yB], [bx, yB], ...[...bPts].reverse()];
      lab = Math.abs(bx - xs) >= Math.abs(ax - xs) ? { x: (xs + bx) / 2, y: yB - 3 } : { x: (xs + ax) / 2, y: yA - 3 };
    }
    const kab = [c.label, KABEL[c.kabel]?.label, c.laenge ? `${c.laenge} m` : "", String(c.notiz || "").trim()].filter(Boolean).join(" · ");
    const umf = farbe === "dante" && !st.text;
    linien.push({ id: c.id, von: c.a.dev, bis: c.b.dev, pts, ...st, col: umf ? (istGlas(c) ? CC_FARBEN.glas : CC_FARBEN.trunk) : st.col, leg: umf ? (istGlas(c) ? "Glasfaser" : "Switch zu Switch") : st.leg,
      labels: [{ ...lab, t: kab, anchor: "middle" }, ...endLabels({ pts: aPts }, portA, dev(c.a.dev)), ...endLabels({ pts: bPts }, portB, dev(c.b.dev))] });
  }
  const h = raeume.length ? plan.H : 0;
  const w = raeume.length ? plan.W : 0;
  // Legende: nur, was im Plan vorkommt
  const legL = new Map();
  for (const l of linien) if (!legL.has(l.col + l.leg)) legL.set(l.col + l.leg, { col: l.col, t: l.leg });
  const reihenfolge = ["Dante Primary", "Dante Secondary", "Glasfaser", "Switch zu Switch", "Trunk (Switch zu Switch)"];
  const legLinien = [...legL.values()].sort((a, b) => ((reihenfolge.indexOf(a.t) + 1 || 99) - (reihenfolge.indexOf(b.t) + 1 || 99)) || a.t.localeCompare(b.t, "de", { numeric: true }));
  if (conns.some((c) => c.kabel === "wlan")) legLinien.push({ col: CC_FARBEN.sonst, t: "WLAN", dash: "4 4" });
  if (conns.some((c) => c.kabel === "p2p")) legLinien.push({ col: CC_FARBEN.sonst, t: "Punkt-zu-Punkt", dash: "8 3 2 3" });
  const legBoxen = [];
  if (P.geraete.some((d) => d.isSwitch)) legBoxen.push({ fill: CC_SWITCH_FILL, t: "Switch" });
  const mitStapel = raeume.some((r) => r.stapel);
  for (const k of [...new Set(P.geraete.filter((d) => !d.isSwitch).map((d) => d.kategorie || "Sonstiges"))].sort((a, b) => a.localeCompare(b, "de")))
    legBoxen.push({ fill: ccKatFill(k), t: k });
  return {
    w, h,
    // Standort-Rahmen (mit Stacks: um alle Unterräume) und Stack-Rahmen darin
    raeume: bloecke.map((b) => ({ name: b.standort, x: b.x, y: b.y, w: b.w, h: b.h, anmerkung: b.anmerkung })),
    stapel: raeume.filter((r) => r.stapel).map(({ stapel: name, standort, x, y, w: rw, h: rh }) => ({ name, standort, x, y, w: rw, h: rh })),
    boxen: [...boxen.entries()].map(([id, b]) => ({ ...b, id })),
    linien,
    legende: { linien: legLinien, boxen: legBoxen, stapel: mitStapel },
    ordnung: genutzt,
  };
};

/* ── A3-Blatt (quer, 420 × 297 mm, 4 px je mm) ──────────────────────────────
   Rahmen, unten links die Legende, unten rechts der Plankopf, darüber die
   Zeichnung, auf die freie Fläche eingepasst (nie größer als 1,6-fach). */
export const A3 = { w: 1680, h: 1188, mm: 4 };
export const ccBlatt = (L) => {
  const rand = 10 * A3.mm, fuss = 38 * A3.mm, luft = 14;
  const kopfW = 175 * A3.mm;
  const flaeche = { x: rand + luft, y: rand + luft, w: A3.w - 2 * (rand + luft), h: A3.h - 2 * rand - fuss - 2 * luft };
  const k = L.w > 0 && L.h > 0 ? Math.min(1.6, flaeche.w / L.w, flaeche.h / L.h) : 1;
  return {
    ...A3, rand, k,
    x: flaeche.x + (flaeche.w - L.w * k) / 2, y: flaeche.y + (flaeche.h - L.h * k) / 2,
    flaeche,
    fuss: { y: A3.h - rand - fuss, h: fuss },
    kopf: { x: A3.w - rand - kopfW, y: A3.h - rand - fuss, w: kopfW, h: fuss },
    legende: { x: rand, y: A3.h - rand - fuss, w: A3.w - 2 * rand - kopfW, h: fuss },
  };
};

// Anzahl Ports eines Geräts (für Tests und Hinweise)
export const ccPortZahl = (d) => physPorts(d).length;

/* ── Automatisch anordnen: möglichst kurze Kabelwege ─────────────────────────
   Tauscht benachbarte Standorte, Switch-Gruppen und Geräte, solange die Summe
   aller Leitungslängen kleiner wird. Begrenzte Anzahl Versuche, damit es auch
   bei großen Projekten flott bleibt; gleiche Eingabe gibt immer dasselbe Ergebnis. */
export const ccLaenge = (L) => L.linien.reduce((s, l) => s + l.pts.reduce((a, p, i) => (i ? a + Math.abs(p[0] - l.pts[i - 1][0]) + Math.abs(p[1] - l.pts[i - 1][1]) : 0), 0), 0);
export const cleanCatOptimieren = (P, X, opts = {}) => {
  const basis = cleanCatLayout(P, X, opts);
  const ord = JSON.parse(JSON.stringify(basis.ordnung));
  const start = ccLaenge(basis);
  let best = start, n = 0;
  const maxEval = Math.max(20, Math.min(300, Math.floor(6000 / Math.max(1, P.geraete.length))));
  const listen = [ord.standorte, ...Object.values(ord.gruppen), ...Object.values(ord.oben)].filter((l) => l.length > 1);
  for (let runde = 0; runde < 6 && n < maxEval; runde++) {
    let besser = false;
    for (const l of listen) for (let i = 0; i < l.length - 1 && n < maxEval; i++) {
      [l[i], l[i + 1]] = [l[i + 1], l[i]];
      n++;
      const c = ccLaenge(cleanCatLayout(P, X, { ...opts, ordnung: ord }));
      if (c < best - 0.5) { best = c; besser = true; } else [l[i], l[i + 1]] = [l[i + 1], l[i]];
    }
    if (!besser) break;
  }
  return { ordnung: ord, laenge: best, start };
};
