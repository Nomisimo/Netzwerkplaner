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
const SPUR = 7, MAX_SPALTEN = 6, RAUM_KOPF = 34, RAUM_RAND = 22, GRUPPE_ABSTAND = 46, RAUM_ABSTAND = 70;

const mische = (hex, anteil = 0.55) => {
  const n = parseInt(hex.slice(1), 16);
  const k = (v) => Math.round(v + (255 - v) * anteil);
  return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => k(v).toString(16).padStart(2, "0")).join("");
};
const textB = (s, px) => String(s || "").length * px * 0.56;
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

export const cleanCatLayout = (P, X, { farbe = "dante", zeigeIp = true } = {}) => {
  const BOX_H = zeigeIp ? 52 : 40;
  const raumVon = (d) => (d.bereich || "").trim() || "Ohne Standort";
  const box = (d) => {
    const sub = [d.hersteller, d.modell].filter(Boolean).join(" ") || "";
    const ip = zeigeIp ? ipPorts(d).map((p) => p.ip).filter(Boolean).slice(0, 2).join(" · ") : "";
    const w = Math.max(d.isSwitch ? 150 : 124, Math.min(250, Math.max(textB(d.name, 12.5), textB(sub, 9.5), textB(ip, 9.5)) + 26));
    const fill = d.isSwitch ? "#fff176" : mische((KATEGORIEN[d.kategorie] || KATEGORIEN.Sonstiges).color, 0.5);
    return { id: d.id, name: d.name, sub, ip, w, h: BOX_H, fill, isSwitch: !!d.isSwitch, kategorie: d.kategorie };
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
  namen.sort((a, b) => rang(a) - rang(b) || a.localeCompare(b, "de"));

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
    let col = CC_FARBEN.sonst, text = "";
    if (farbe === "vlan") {
      const p = end ? portVon(end) : null;
      const v = p && X.vlanById.get(p.vlan);
      col = v ? v.farbe : A.isSwitch && B.isSwitch ? CC_FARBEN.trunk : CC_FARBEN.sonst;
      text = v ? `${v.vid} ${v.name}` : A.isSwitch && B.isSwitch ? "Trunk" : "";
    } else if (rolle) { col = CC_FARBEN[rolle]; text = rolle === "primary" ? "Dante Primary" : "Dante Secondary"; }
    else if (istGlas(c)) col = CC_FARBEN.glas;
    else if (A.isSwitch && B.isSwitch) col = CC_FARBEN.trunk;
    return { col, text, dash: c.kabel === "wlan" ? "4 4" : c.kabel === "p2p" ? "8 3 2 3" : "" };
  };

  /* ── Räume aufbauen ── */
  let x0 = 0;
  const trunkEnden = []; // { c, devId, x, yAus (Raumunterkante des Ausgangs), raum }
  for (const rn of namen) {
    const devs = P.geraete.filter((d) => raumVon(d) === rn);
    const switches = devs.filter((d) => d.isSwitch).sort((a, b) => (vonDev.get(b.id)?.length || 0) - (vonDev.get(a.id)?.length || 0) || a.name.localeCompare(b.name, "de"));
    const lose = devs.filter((d) => !d.isSwitch && gruppeVon.get(d.id) === "lose:" + rn);
    const gruppen = switches.map((s) => ({ sw: s, oben: devs.filter((d) => !d.isSwitch && gruppeVon.get(d.id) === s.id) }));
    if (lose.length) gruppen.push({ sw: null, lose });
    const sortK = (a, b) => (a.kategorie || "").localeCompare(b.kategorie || "") || a.name.localeCompare(b.name, "de");

    // Gruppen vorbereiten: Reihen, Spalten, Spuren zählen
    for (const g of gruppen) {
      g.oben = (g.oben || []).sort(sortK);
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
      if (g.sw) { const nA = g.wege.filter((w) => w.art === "lokal").length; g.unten[0].b.w = Math.max(g.unten[0].b.w, nA * 12 + 30, Math.min(obenW, 260)); }
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
    const raumW = Math.max(gx - GRUPPE_ABSTAND - x0 + RAUM_RAND, textB(rn, 14) + 60);
    // Räume ohne Gruppenbreite (nur Titel) zentrieren nichts; Boxen bleiben links
    const raum = { name: rn, x: x0, y: kopfY, w: raumW, unterY, gruppen, trunkY: unterY + BOX_H + 18, spurTrunk: 0 };
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
      linien.push({ id: p.w.c.id, pts: p.pts, ...st, labels: [
        st.text && textAufLinie(p.pts, st.text),
        swPort && { x: xs - 2, y: sb.y - 3, t: swPort.name, rot: true },
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
      const kab = c.label || (istGlas(c) ? KABEL[c.kabel]?.label : "");
      if (kab) labels.push({ x: (ax + bx) / 2, y: y - 3, t: kab, anchor: "middle" });
      else if (st.text) { const t = textAufLinie(pts, st.text); if (t) labels.push(t); }
      linien.push({ id: c.id, pts, ...st, labels: [...labels, ...endLabels(A, portA, dev(c.a.dev)), ...endLabels(B, portB, dev(c.b.dev))] });
    } else busLinien.push({ c, A, B, st, portA, portB });
  }
  function endLabels(E, port, d) {
    if (!port || !d || !d.isSwitch) return []; // nur Switch-Ports beschriften, Endgeräte tragen Dante Primary/Secondary an der Linie
    const [x, y] = E.pts[0];
    return [{ x: x + 3, y: y + 10, t: d.isSwitch ? port.name : port.name, anchor: "start" }];
  }
  // Raumhöhen festlegen
  for (const r of raeume) { r.h = r.trunkY + Math.max(1, r.spurTrunk) * SPUR + 16; }
  const busY0 = Math.max(...raeume.map((r) => r.h), 0) + 30;
  busLinien.forEach(({ c, A, B, st, portA, portB }, i) => {
    const y = busY0 + i * (SPUR + 4);
    const ax = A.pts[A.pts.length - 1][0], bx = B.pts[B.pts.length - 1][0];
    const pts = [...A.pts, [ax, y], [bx, y], ...[...B.pts].reverse()];
    const kab = [c.label, KABEL[c.kabel]?.label, c.laenge ? `${c.laenge} m` : ""].filter(Boolean).join(" · ");
    linien.push({ id: c.id, pts, ...st, col: farbe === "dante" && !st.text ? (istGlas(c) ? CC_FARBEN.glas : CC_FARBEN.trunk) : st.col,
      labels: [{ x: (ax + bx) / 2, y: y - 3, t: kab, anchor: "middle" }, ...endLabels(A, portA, dev(c.a.dev)), ...endLabels(B, portB, dev(c.b.dev))] });
  });
  const h = busLinien.length ? busY0 + busLinien.length * (SPUR + 4) + 20 : Math.max(0, ...raeume.map((r) => r.h)) + 10;
  const w = Math.max(0, x0 - RAUM_ABSTAND);
  return {
    w, h,
    raeume: raeume.map(({ name, x, y, w: rw, h: rh }) => ({ name, x, y, w: rw, h: rh })),
    boxen: [...boxen.entries()].map(([id, b]) => ({ ...b, id })),
    linien,
  };
};

// Anzahl Ports eines Geräts (für Tests und Hinweise)
export const ccPortZahl = (d) => physPorts(d).length;
