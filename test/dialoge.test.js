import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Native alert/confirm/prompt nehmen unter Electron (v. a. Windows) den Textfeldern den Fokus,
// bis die App neu startet. Im Renderer gibt es dafür uiAlert/uiConfirm aus dialoge.jsx.
// Die Tests laufen gebündelt aus node_modules/.cache, deshalb vom Projektordner aus suchen.
const RENDERER = path.join(process.cwd(), "src", "renderer");
const dateien = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? dateien(path.join(dir, e.name)) : /\.(jsx?|tsx?)$/.test(e.name) ? [path.join(dir, e.name)] : []);

test("Renderer ruft keine nativen Dialoge (alert/confirm/prompt) auf", () => {
  const treffer = [];
  for (const f of dateien(RENDERER)) {
    fs.readFileSync(f, "utf8").split("\n").forEach((zeile, i) => {
      const code = zeile.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
      if (/(^|[^.\w$])(window\s*\.\s*)?(alert|confirm|prompt)\(/.test(code)) treffer.push(`${path.relative(RENDERER, f)}:${i + 1}`);
    });
  }
  assert.deepEqual(treffer, []);
});
