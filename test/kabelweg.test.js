import test from "node:test";
import assert from "node:assert/strict";
import { wegSuchen, wegFrei, standardWeg, handWeg, wegSpeichern, streckeVerschieben, knickEinfuegen, aufblasen, wegPfad } from "../src/shared/kabelweg.js";

const box = (dev, x0, y0, x1, y1) => ({ dev, x0, y0, x1, y1 });
const rechtwinklig = (pts) => pts.every((p, i) => i === 0 || p.x === pts[i - 1].x || p.y === pts[i - 1].y);

test("Kabel läuft um ein Gerät in der Mitte herum, mit Abstand", () => {
  const H = [box("a", -50, -60, 50, 0), box("b", -50, 300, 50, 360), box("mitte", -100, 140, 100, 200)];
  const a = { x: 0, y: 0, dir: 1 }, b = { x: 0, y: 300, dir: -1 };
  assert.equal(wegFrei(standardWeg(a, b, 150), aufblasen(H, 10), ["a", "b"]), false);
  const w = wegSuchen(a, b, H, { abstand: 10, devs: ["a", "b"] });
  assert.ok(w, "Weg gefunden");
  assert.ok(rechtwinklig(w));
  assert.ok(wegFrei(w, aufblasen(H, 9), ["a", "b"]), "hält Abstand");
  assert.deepEqual(w[0], { x: 0, y: 0 });
  assert.deepEqual(w[w.length - 1], { x: 0, y: 300 });
});

test("Zweites Kabel nimmt eine Bahn daneben statt derselben Linie", () => {
  const H = [box("mitte", -100, 140, 100, 200)];
  const a = { x: 0, y: 0, dir: 1 }, b = { x: 0, y: 300, dir: -1 };
  const w1 = wegSuchen(a, b, H);
  const belegt = w1.slice(0, -1).map((p, i) => ({ a: p, b: w1[i + 1] }));
  const w2 = wegSuchen({ x: 4, y: 0, dir: 1 }, { x: 4, y: 300, dir: -1 }, H, { belegt });
  const xs1 = new Set(w1.map((p) => p.x)), xs2 = w2.map((p) => p.x).filter((x) => Math.abs(x) > 50);
  assert.ok(xs2.every((x) => !xs1.has(x)), "andere senkrechte Bahn");
});

test("Von Hand gesetzter Weg folgt den Enden", () => {
  const w = handWeg({ x: 10, y: 0 }, { x: 200, y: 300 }, [[0, 100], [300, 100], [300, 200], [190, 200]]);
  assert.deepEqual(w, [{ x: 10, y: 0 }, { x: 10, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 200 }, { x: 200, y: 200 }, { x: 200, y: 300 }]);
  assert.deepEqual(wegSpeichern(w), [[10, 100], [300, 100], [300, 200], [200, 200]]);
});

test("Mittlere Strecken verschieben, Enden bleiben an der Buchse", () => {
  const w = standardWeg({ x: 0, y: 0 }, { x: 200, y: 300 }, 150);
  const v = streckeVerschieben(w, 1, 40);
  assert.deepEqual(v[1], { x: 0, y: 190 }); assert.deepEqual(v[2], { x: 200, y: 190 });
  assert.deepEqual(streckeVerschieben(w, 0, 40), w);
});

test("Knick einfügen: aus 3 Strecken werden 5, alles rechtwinklig", () => {
  const w = standardWeg({ x: 0, y: 0 }, { x: 200, y: 300 }, 150);
  const k = knickEinfuegen(w, 1);
  assert.equal(k.length, 6);
  assert.ok(rechtwinklig(k));
  const gerade = knickEinfuegen([{ x: 0, y: 0 }, { x: 0, y: 300 }], 0);
  assert.equal(gerade.length, 6);
  assert.ok(rechtwinklig(gerade));
  assert.match(wegPfad(k, 6), /^M0,0 L/);
});
