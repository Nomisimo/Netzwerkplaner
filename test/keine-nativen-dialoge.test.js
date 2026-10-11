import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// alert()/confirm()/prompt() geben unter Windows den Tastaturfokus nicht zurück (electron#35872),
// danach lassen sich Textfelder nicht mehr beschreiben. Im Renderer nur uiAlert/uiConfirm/frageText aus ui.jsx.
const dateien = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dateien(path.join(d, e.name)) : /\.jsx?$/.test(e.name) ? [path.join(d, e.name)] : []));

test("Renderer ruft keine nativen Dialoge auf", () => {
  const funde = [];
  for (const f of dateien(path.join(process.cwd(), "src", "renderer"))) {
    fs.readFileSync(f, "utf8").split("\n").forEach((z, i) => {
      const code = z.replace(/\/\/.*$|\/\*.*?(\*\/|$)|^\s*\*.*$/g, "");
      if (/(^|[^\w.$]|window\.)(alert|confirm|prompt)\s*\(/.test(code)) funde.push(`${path.relative(process.cwd(), f)}:${i + 1}`);
    });
  }
  assert.deepEqual(funde, []);
});
