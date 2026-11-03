import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SCHRITTE, TOUREN } from "../src/renderer/tour/touren.js";

// Alle data-tour-Namen aus dem Quelltext: feste Namen und Präfixe wie "tab-" + k
const quellen = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? quellen(path.join(d, e.name)) : /\.jsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
const text = quellen(path.join(process.cwd(), "src", "renderer")).filter((f) => !f.includes(`${path.sep}tour${path.sep}`)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
const fest = new Set([...text.matchAll(/(?:data-tour|\btour)=["{]+"?([\w-]+)"/g)].map((m) => m[1]));
const praefixe = [...text.matchAll(/data-tour=\{"([\w-]+-)" \+/g)].map((m) => m[1]);
const gibtEs = (a) => fest.has(a) || praefixe.some((p) => a.startsWith(p));

test("Tour: jeder Anker und jeder vorbereitende Klick steht im Code", () => {
  for (const [id, s] of Object.entries(SCHRITTE)) {
    for (const a of [].concat(s.anker || [], (s.vor || []).filter((v) => typeof v === "string"))) assert.ok(gibtEs(a), `${id}: data-tour="${a}" fehlt`);
  }
});

test("Tour: Schritte vollständig, Touren verweisen nur auf vorhandene Schritte", () => {
  for (const [id, s] of Object.entries(SCHRITTE)) {
    assert.ok(s.titel && s.text, id);
    assert.ok(["klick", "eingabe", "ziehen", "weiter"].includes(s.art), `${id}: art ${s.art}`);
    if (s.art === "klick") assert.ok(s.anker, `${id}: Klick-Schritt braucht einen Anker`);
  }
  for (const t of TOUREN) {
    assert.ok(t.schritte.length, t.id);
    for (const s of t.schritte) assert.ok(SCHRITTE[s], `${t.id}: Schritt ${s} fehlt`);
  }
  assert.equal(new Set(TOUREN.map((t) => t.id)).size, TOUREN.length);
});
