import test from "node:test";
import assert from "node:assert/strict";
import { einrasten, mitlaeufer, gruppeBewegen } from "../src/shared/einrasten.js";

test("Ohne Nachbarn rastet die linke obere Ecke im Raster ein", () => {
  const r = einrasten({ x: 107, y: 53, w: 100, h: 40 }, []);
  assert.deepEqual([107 + r.dx - 50, 53 + r.dy - 20], [60, 40]);
  assert.equal(r.linien.length, 0);
});

test("Nahe Mitte eines Nachbarn hat Vorrang vor dem Raster und zeigt eine Hilfslinie", () => {
  const r = einrasten({ x: 305, y: 206, w: 100, h: 40 }, [{ x: 300, y: 0, w: 100, h: 40 }]);
  assert.equal(305 + r.dx, 300);
  assert.equal(r.linien.length, 1);
  assert.deepEqual(r.linien[0], { achse: "x", wert: 300 - 50, von: -20, bis: 226 });
});

test("Unterschiedlich breite Boxen richten sich an der Kante aus", () => {
  const r = einrasten({ x: 0, y: 103, w: 60, h: 40 }, [{ x: 500, y: 100, w: 200, h: 80 }]);
  // Mitte 103 liegt 3 neben der Mitte des Nachbarn (100)
  assert.equal(103 + r.dy, 100);
});

test("Außerhalb des Fangbereichs gilt das Raster", () => {
  const r = einrasten({ x: 330, y: 0, w: 100, h: 40 }, [{ x: 300, y: 500, w: 100, h: 40 }], { fang: 8 });
  assert.equal((330 + r.dx - 50) % 20, 0);
});

test("Mitläufer: loser Ast und Stapel wandern mit, feste Geräte nicht", () => {
  const kinder = new Map([["sw", ["a", "b"]], ["a", ["a1"]], ["b", ["b1"]]]);
  const m = mitlaeufer("sw", { kinder, ziele: { b: { x: 0, y: 0 } }, stapel: [{ id: "s", ids: ["a1", "x"] }] });
  assert.deepEqual([...m].sort(), ["a", "a1", "sw", "x"]);
});

test("Mehrfachauswahl: Geräte im Ast eines anderen gewählten Geräts nicht doppelt verschieben", () => {
  const kinder = new Map([["sw", ["a", "b"]], ["b", ["c"]]]);
  let r = gruppeBewegen(["sw", "b", "x"], { kinder });
  assert.deepEqual(r.schreiben.sort(), ["sw", "x"]);
  assert.deepEqual([...r.alle].sort(), ["a", "b", "c", "sw", "x"]);
  r = gruppeBewegen(["sw", "b"], { kinder, ziele: { b: { x: 0, y: 0 } } }); // b angepinnt: läuft nicht mit
  assert.deepEqual(r.schreiben.sort(), ["b", "sw"]);
  r = gruppeBewegen(["p", "q"], { stapel: [{ id: "s", ids: ["p", "q"] }] });
  assert.equal(r.schreiben.length, 1);
});
