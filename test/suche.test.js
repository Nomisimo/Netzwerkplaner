import test from "node:test";
import assert from "node:assert/strict";
import { passtSuche } from "../src/shared/suche.js";
import { emptyProject, standortListe } from "../src/shared/model.js";

test("Suche mit * als Platzhalter", () => {
  const t = "Cisco Catalyst 1300 C1300-24FP-4G";
  assert.ok(passtSuche(t, "Cisco*1300*24"));
  assert.ok(passtSuche(t, "cisco*24fp"));
  assert.ok(!passtSuche(t, "Cisco*48"));
  assert.ok(!passtSuche(t, "1300*Cisco")); // Reihenfolge gilt innerhalb eines Begriffs
  assert.ok(passtSuche(t, "*"));
  assert.ok(passtSuche(t, ""));
  assert.ok(passtSuche("a.b (c)", "a.b*(c)")); // Sonderzeichen sind keine Regex
});

test("Suche: mehrere Wörter müssen alle vorkommen", () => {
  const t = "Yamaha Rio3224-D3 Dante";
  assert.ok(passtSuche(t, "rio dante"));
  assert.ok(passtSuche(t, "dante rio"));
  assert.ok(!passtSuche(t, "rio sacn"));
});

test("Neues leeres Projekt ohne Standard-VLANs, Standorte auch von Geräten", () => {
  assert.equal(emptyProject({ mitVlans: false }).vlans.length, 0);
  assert.ok(emptyProject().vlans.length > 0);
  const P = emptyProject();
  P.geraete.push({ bereich: "Delay-Tower" }, { bereich: "FOH" }, { bereich: "" });
  const s = standortListe(P);
  assert.ok(s.includes("Delay-Tower"));
  assert.equal(s.filter((x) => x === "FOH").length, 1);
});
