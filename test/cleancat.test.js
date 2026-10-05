import test from "node:test";
import assert from "node:assert/strict";
import { cleanCatLayout, CC_FARBEN, CC_BOX_W, ccBlatt, passeText } from "../src/shared/cleancat.js";
import { emptyProject } from "../src/shared/model.js";
import { demoProject } from "../src/shared/demo.js";
import { buildIndex } from "../src/shared/model.js";

const ueberlapp = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("Clean Cat: Räume, Blöcke ohne Überlappung, eine Leitung je Verbindung", () => {
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

test("Clean Cat: gleiche Geräte gleich groß, Text passt in die Box", () => {
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

test("Clean Cat: Räume in Reihen, Zeichnung liegt auf dem A3-Blatt", () => {
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

test("Clean Cat: leeres Projekt", () => {
  const P = emptyProject(), X = buildIndex(P);
  const L = cleanCatLayout(P, X);
  assert.equal(L.boxen.length, 0);
  assert.ok(Number.isFinite(ccBlatt(L).k));
});

test("Clean Cat: Stacks als Unterräume im Standort", () => {
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
