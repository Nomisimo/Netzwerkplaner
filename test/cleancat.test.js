import test from "node:test";
import assert from "node:assert/strict";
import { cleanCatLayout, CC_FARBEN, CC_BOX_W, ccBlatt, passeText, cleanCatOptimieren, ccLaenge, ccKreuzungen, CC_KREUZUNG, ccEcken, CC_ECKE, plottGroesse } from "../src/shared/cleancat.js";
import { emptyProject } from "../src/shared/model.js";
import { demoProject } from "../src/shared/demo.js";
import { buildIndex } from "../src/shared/model.js";

const ueberlapp = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("Plott: Räume, Blöcke ohne Überlappung, eine Leitung je Verbindung", () => {
  const P = demoProject(), X = buildIndex(P);
  const L = cleanCatLayout(P, X);
  assert.equal(L.boxen.length, P.geraete.length);
  assert.equal(L.linien.length, P.verbindungen.length);
  assert.deepEqual(L.raeume.map((r) => r.name).sort(), [...new Set(P.geraete.map((d) => d.bereich))].sort());
  for (let i = 0; i < L.boxen.length; i++) for (let j = i + 1; j < L.boxen.length; j++) assert.ok(!ueberlapp(L.boxen[i], L.boxen[j]), `${L.boxen[i].name} / ${L.boxen[j].name}`);
  // Jedes Gerät liegt in seinem Raum
  for (const b of L.boxen) {
    const d = P.geraete.find((g) => g.id === b.id);
    const r = L.raeume.find((x) => x.name === d.bereich);
    assert.ok(b.x >= r.x && b.x + b.w <= r.x + r.w && b.y >= r.y && b.y + b.h <= r.y + r.h, `${d.name} in ${r.name}`);
  }
  // nur rechtwinklige Segmente
  for (const l of L.linien) for (let i = 1; i < l.pts.length; i++) {
    const [a, b] = [l.pts[i - 1], l.pts[i]];
    assert.ok(Math.abs(a[0] - b[0]) < 0.01 || Math.abs(a[1] - b[1]) < 0.01, "rechtwinklig");
  }
  // Dante: Rio A Primary rot, Secondary grün
  const rio = P.geraete.find((d) => d.name === "Rio A");
  const farben = P.verbindungen.filter((c) => c.a.dev === rio.id || c.b.dev === rio.id).map((c) => L.linien.find((l) => l.id === c.id).col);
  assert.ok(farben.includes(CC_FARBEN.primary) && farben.includes(CC_FARBEN.secondary));
  assert.ok(L.w > 0 && L.h > 0);
});

test("Plott: gleiche Geräte gleich groß, Text passt in die Box", () => {
  const P = demoProject(), X = buildIndex(P);
  const L = cleanCatLayout(P, X);
  const proModell = new Map();
  for (const b of L.boxen) {
    const d = X.devById.get(b.id);
    if (!d.isSwitch) assert.equal(b.w, CC_BOX_W, b.name);
    const k = `${d.hersteller}|${d.modell}|${d.typ}`;
    if (d.modell && proModell.has(k)) assert.deepEqual([b.w, b.h], proModell.get(k), k);
    proModell.set(k, [b.w, b.h]);
    for (const t of [b.tName, b.tSub, b.tIp].filter(Boolean)) assert.ok(t.t.length * t.fs * 0.62 <= b.w - 20 + 0.01 || t.fs >= 7.5, `${b.name}: ${t.t}`);
  }
  const f = passeText("Ein sehr sehr langer Gerätename, der nie in eine Box passt", 12.5, 130, 9.5);
  assert.ok(f.t.endsWith("…") && f.voll && f.t.length * f.fs * 0.56 <= 130);
});

test("Plott: Räume in Reihen, Zeichnung liegt auf dem A3-Blatt", () => {
  const P = demoProject(), X = buildIndex(P);
  const L = cleanCatLayout(P, X);
  assert.ok(new Set(L.raeume.map((r) => r.y)).size > 1, "mehrere Reihen");
  for (const r of L.raeume) for (const b of L.boxen.filter((bb) => X.devById.get(bb.id).bereich === r.name))
    assert.ok(b.x >= r.x && b.x + b.w <= r.x + r.w && b.y >= r.y && b.y + b.h <= r.y + r.h, b.name);
  const B = ccBlatt(L);
  assert.equal(B.w, 1680); assert.equal(B.h, 1188);
  assert.ok(B.x >= B.flaeche.x - 0.01 && B.x + L.w * B.k <= B.flaeche.x + B.flaeche.w + 0.01);
  assert.ok(B.y >= B.flaeche.y - 0.01 && B.y + L.h * B.k <= B.flaeche.y + B.flaeche.h + 0.01);
  assert.ok(L.legende.linien.some((l) => l.t === "Dante Primary") && L.legende.boxen.some((b) => b.t === "Switch"));
  for (const l of L.linien) for (const p of l.pts) assert.ok(p.every(Number.isFinite), l.id);
});

test("Plott: leeres Projekt", () => {
  const P = emptyProject(), X = buildIndex(P);
  const L = cleanCatLayout(P, X);
  assert.equal(L.boxen.length, 0);
  assert.ok(Number.isFinite(ccBlatt(L).k));
});

test("Plott: Stacks als Unterräume im Standort", () => {
  const P = demoProject();
  const by = (n) => P.geraete.find((d) => d.name === n).id;
  P.layout.stapel = [{ id: "s1", name: "Rack FOH 1", ids: [by("SW FOH"), by("FOH CL5")] }];
  const X = buildIndex(P);
  const L = cleanCatLayout(P, X);
  assert.equal(L.stapel.length, 1);
  const st = L.stapel[0], foh = L.raeume.find((r) => r.name === "FOH");
  assert.equal(st.name, "Rack FOH 1");
  assert.ok(st.x >= foh.x && st.x + st.w <= foh.x + foh.w && st.y >= foh.y && st.y + st.h <= foh.y + foh.h, "Stack liegt im Standort");
  for (const n of ["SW FOH", "FOH CL5"]) {
    const b = L.boxen.find((bb) => bb.id === by(n));
    assert.ok(b.x >= st.x && b.x + b.w <= st.x + st.w && b.y >= st.y && b.y + b.h <= st.y + st.h, n);
  }
  const b = L.boxen.find((bb) => bb.id === by("PTZ 1"));
  assert.ok(b.x + b.w <= st.x || b.x >= st.x + st.w, "Gerät ohne Stack liegt außerhalb");
  assert.equal(L.linien.length, P.verbindungen.length);
  assert.ok(L.legende.stapel);
});

test("Plott: automatische Anordnung verkürzt die Kabelwege, spart Kreuzungen und ist stabil", () => {
  const P = demoProject(), X = buildIndex(P);
  const a = cleanCatOptimieren(P, X), b = cleanCatOptimieren(P, X);
  assert.ok(a.laenge < a.start, `${a.laenge} < ${a.start}`);
  assert.deepEqual(a.ordnung, b.ordnung);
  const L0 = cleanCatLayout(P, X), L = cleanCatLayout(P, X, { ordnung: a.ordnung });
  assert.ok(Math.abs(ccLaenge(L) + CC_KREUZUNG * ccKreuzungen(L) + CC_ECKE * ccEcken(L) - a.laenge) < 1);
  assert.ok(ccKreuzungen(L) <= ccKreuzungen(L0), `${ccKreuzungen(L)} <= ${ccKreuzungen(L0)}`);
  assert.equal(L.boxen.length, P.geraete.length);
});

test("Plott: Leitungen im Standort bleiben im Standort-Rahmen", () => {
  const P = demoProject();
  const by = (n) => P.geraete.find((d) => d.name === n).id;
  P.layout.stapel = [{ id: "s1", name: "Rack", ids: [by("SW FOH"), by("FOH CL5")] }];
  const X = buildIndex(P);
  const L = cleanCatLayout(P, X, {});
  const inFoh = new Set(P.geraete.filter((d) => (d.bereich || "") === "FOH").map((d) => d.id));
  const foh = L.raeume.find((r) => r.name === "FOH");
  assert.ok(foh, "FOH-Rahmen vorhanden");
  const drin = L.linien.filter((l) => inFoh.has(l.von) && inFoh.has(l.bis));
  assert.ok(drin.length, "es gibt Leitungen innerhalb von FOH");
  for (const l of drin) for (const [x, y] of l.pts) {
    assert.ok(x >= foh.x - 1 && x <= foh.x + foh.w + 1, `x ${x} im Rahmen`);
    assert.ok(y >= foh.y - 1 && y <= foh.y + foh.h + 1, `y ${y} im Rahmen`);
  }
});

test("Plott: Notiz am Gerät und Anmerkung am Standort", () => {
  const P = demoProject();
  const g = P.geraete.find((d) => d.name === "FOH CL5");
  g.notizen = "Pult steht auf der Galerie und braucht Strom";
  P.standortInfo = { FOH: { anmerkung: "Front of House, Galerie Mitte" } };
  const L = cleanCatLayout(P, buildIndex(P), {});
  const b = L.boxen.find((x) => x.id === g.id);
  assert.ok(Array.isArray(b.notiz) && b.notiz.length, "Notiz steht in der Box");
  assert.ok(b.notiz.join(" ").includes("Galerie"));
  for (const x of L.boxen) assert.strictEqual(x.h, b.h, "alle Boxen gleich hoch");
  const foh = L.raeume.find((r) => r.name === "FOH");
  assert.ok((foh.anmerkung || []).join(" ").includes("Galerie Mitte"), "Anmerkung am Standort");
  const ohne = cleanCatLayout(P, buildIndex(P), {});
  assert.deepStrictEqual(ohne.raeume.find((r) => r.name === "FOH").anmerkung, foh.anmerkung);
});
test("Plott: Kreuzungen werden gezählt", () => {
  const L = { linien: [{ pts: [[0, 10], [100, 10]] }, { pts: [[50, 0], [50, 50]] }, { pts: [[200, 0], [200, 50]] }] };
  assert.equal(ccKreuzungen(L), 1);
});

test("Plott: von Hand gesetzte Standort-Reihenfolge bleibt", () => {
  const P = demoProject(), X = buildIndex(P);
  const namen = [...new Set(cleanCatLayout(P, X).raeume.map((r) => r.name))].reverse();
  P.layout.cleancatStandorte = namen;
  const o = cleanCatOptimieren(P, X);
  assert.deepEqual(o.ordnung.standorte, namen);
  assert.deepEqual(cleanCatLayout(P, X, { ordnung: o.ordnung }).raeume.map((r) => r.name), namen);
});

test("Plott: Leitungen ohne unnötige Ecken, höchstens vier Abbiegungen, Enden senkrecht", () => {
  const P = demoProject(), X = buildIndex(P);
  const o = cleanCatOptimieren(P, X, {});
  const L = cleanCatLayout(P, X, { ordnung: o.ordnung });
  for (const l of L.linien) {
    const p = l.pts;
    assert.ok(p.length - 2 <= 4, `${l.id}: ${p.length - 2} Ecken`);
    // keine Punkte mitten auf einer Geraden, keine schrägen Stücke
    for (let i = 1; i < p.length; i++) assert.ok(p[i][0] === p[i - 1][0] || p[i][1] === p[i - 1][1]);
    for (let i = 2; i < p.length; i++) assert.ok(!(p[i][0] === p[i - 1][0] && p[i - 1][0] === p[i - 2][0]) && !(p[i][1] === p[i - 1][1] && p[i - 1][1] === p[i - 2][1]));
    assert.equal(p[0][0], p[1][0]);
    assert.equal(p[p.length - 1][0], p[p.length - 2][0]);
  }
  assert.ok(ccEcken(L) <= 54);
  assert.ok(ccKreuzungen(L) <= 8);
  // keine Leitung schneidet eine fremde Box
  for (const l of L.linien) for (let i = 1; i < l.pts.length; i++) {
    const [a, b] = [l.pts[i - 1], l.pts[i]];
    for (const bx of L.boxen) {
      const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      assert.ok(!(x1 > bx.x + 1 && x0 < bx.x + bx.w - 1 && y1 > bx.y + 1 && y0 < bx.y + bx.h - 1), `${l.id} schneidet ${bx.name}`);
    }
  }
});

test("Plott: Blattformate A3/A4 quer und hoch", async () => {
  const { ccBlatt, BLATT_FORMATE, formatName, plottFormat } = await import("../src/shared/cleancat.js");
  const L = { w: 1000, h: 600 };
  for (const [k, f] of Object.entries(BLATT_FORMATE)) {
    const B = ccBlatt(L, k);
    assert.equal(B.w, f.w); assert.equal(B.h, f.h);
    assert.ok(B.kopf.x + B.kopf.w <= B.w - B.rand + 0.5, k);
    assert.ok(B.legende.w > 0 && B.flaeche.w > 0 && B.flaeche.h > 0, k);
  }
  assert.equal(ccBlatt(L).w, 1680);
  assert.equal(formatName("A4", true), "A4-hoch");
  assert.equal(plottFormat({ layout: {} }), "A3-quer");
  assert.equal(plottFormat({ layout: { plottFormat: "A4-quer" } }), "A4-quer");
});

test("Anschlussnamen höchstens 10 Zeichen", async () => {
  const { kurzerPortName } = await import("../src/shared/catalog.js");
  assert.equal(kurzerPortName("Steuerung 1"), "Strg 1");
  assert.equal(kurzerPortName("Management 12"), "Mgmt 12");
  assert.equal(kurzerPortName("LAN 1"), "LAN 1");
  assert.ok(kurzerPortName("Irgendein langer Name").length <= 10);
});

test("Plott: Kastengröße skaliert die Geräte-Kästen, Abstände bleiben", () => {
  const P = demoProject(), X = buildIndex(P);
  const L1 = cleanCatLayout(P, X), Lk = cleanCatLayout(P, X, { groesse: 0.6 }), Lg = cleanCatLayout(P, X, { groesse: 1.3 });
  const b1 = L1.boxen[0], bk = Lk.boxen.find((b) => b.id === b1.id), bg = Lg.boxen.find((b) => b.id === b1.id);
  assert.ok(Math.abs(bk.w - b1.w * 0.6) < 0.01 && Math.abs(bk.h - b1.h * 0.6) < 0.01);
  assert.ok(Math.abs(bg.w - b1.w * 1.3) < 0.01 && bg.s === 1.3);
  assert.ok(Lk.w < L1.w && Lg.w > L1.w, "Zeichnung wird mit den Kästen kleiner bzw. größer");
  // Kästen überlappen sich nicht
  for (const L of [Lk, Lg]) for (const a of L.boxen) for (const b of L.boxen) if (a !== b)
    assert.ok(a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5 || a.y + a.h <= b.y + 0.5 || b.y + b.h <= a.y + 0.5, `${a.name} / ${b.name}`);
  assert.equal(plottGroesse({ layout: { plottGroesse: 0.8 } }), 0.8);
  assert.equal(plottGroesse({ layout: { plottGroesse: 7 } }), 1);
  assert.equal(plottGroesse({ layout: {} }), 1);
});
