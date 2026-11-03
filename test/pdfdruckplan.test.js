import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "../src/shared/model.js";
import { demoProject } from "../src/shared/demo.js";
import { buildPdfHtml } from "../src/renderer/exports.js";

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1190" height="842" viewBox="0 0 1190 842"><rect width="1190" height="842"/></svg>';

test("PDF: Druckplan füllt die ganze Seite, ohne Kopfzeile und Rand", () => {
  const P = demoProject();
  const html = buildPdfHtml(P, buildIndex(P), [], { svg, w: 1190, h: 842, druckplan: true }, { teile: ["topologie"], seite: "A3", hoch: false });
  assert.match(html, /<div class="page voll"><svg /);
  assert.doesNotMatch(html, /class="t">Topologie</);
  assert.match(html, /\.page\.voll svg \{ display: block; width: 420mm; height: 297mm; \}/);
});

test("PDF: Mindmap und Anschlüsse bleiben mit Kopfzeile im Seitenrand", () => {
  const P = demoProject();
  const html = buildPdfHtml(P, buildIndex(P), [], { svg, w: 1190, h: 842 }, { teile: ["topologie"], seite: "A4" });
  assert.match(html, /class="t">Topologie</);
  assert.match(html, /<div class="topo"><svg /);
});
