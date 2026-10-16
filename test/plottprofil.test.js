import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { cleanCatLayout, cleanCatOptimieren } from "../src/shared/cleancat.js";
import { STANDARD_PROFIL, EINGEBAUTE_PROFILE, eingebautesProfil, profilPruefen, projektProfil, profilFelder, profilDatei, profilLesen, gewerkVon, PROFIL_FORMAT } from "../src/shared/plottprofil.js";
import { demoProject } from "../src/shared/demo.js";
import { buildIndex, migrateProject } from "../src/shared/model.js";

// Fingerabdruck der Zeichnung: Lage und Inhalt aller Räume, Kästen, Leitungen und der Legende
const r = (v) => Math.round(v * 100) / 100;
const fingerabdruck = (L) => createHash("sha256").update(JSON.stringify({
  w: r(L.w), h: r(L.h),
  raeume: L.raeume.map((x) => [x.name, r(x.x), r(x.y), r(x.w), r(x.h)]),
  boxen: L.boxen.map((b) => [b.name, r(b.x), r(b.y), r(b.w), r(b.h), b.fill, b.tName?.t, b.tSub?.t, b.tIp?.t]),
  linien: L.linien.map((l) => [l.pts.map((p) => p.map(r)), l.col, l.dash, l.labels.map((t) => [t.t, r(t.x), r(t.y)])]),
  legende: L.legende,
})).digest("hex").slice(0, 16);
const plan = (P, opts) => {
  const X = buildIndex(P);
  const { ordnung } = cleanCatOptimieren(P, X, opts);
  return cleanCatLayout(P, X, { ...opts, ordnung });
};
const mitProfil = (aend) => { const p = JSON.parse(JSON.stringify(STANDARD_PROFIL)); aend(p); return p; };

test("Profil Standard: Demo-Plan genau wie vor den Profilen", () => {
  // Werte aus dem Stand vor den Plan-Profilen (0.7.0-beta.19)
  const P = demoProject();
  assert.equal(fingerabdruck(plan(P, { profil: projektProfil(P, { farbe: "dante", zeigeIp: true }) })), "1786484d82a4bb76");
  assert.equal(fingerabdruck(plan(P, { profil: projektProfil(P, { farbe: "vlan", zeigeIp: false }), format: "A4-hoch", groesse: 0.8 })), "e41aa12d4500f742");
  // Ohne Profil (ältere Aufrufer) dasselbe
  assert.equal(fingerabdruck(plan(P, { zeigeIp: true })), "1786484d82a4bb76");
});

test("Profil: drei Vorlagen, gültig und unterschiedlich", () => {
  assert.deepEqual(EINGEBAUTE_PROFILE.map((p) => p.name), ["Standard", "Druck A3 hell", "Patchplan"]);
  for (const p of EINGEBAUTE_PROFILE) {
    const { profil, warnungen } = profilPruefen(p);
    assert.deepEqual(warnungen, [], p.name);
    assert.ok(profil.eingebaut, p.name);
  }
  const P = demoProject();
  const hell = plan(P, { profil: eingebautesProfil("druck-a3-hell") });
  const std = plan(P, { profil: STANDARD_PROFIL });
  assert.notEqual(hell.design.raum.fuellung, std.design.raum.fuellung);
  assert.notEqual(hell.boxen[0].fill, std.boxen[0].fill);
  assert.equal(profilFelder(eingebautesProfil("patchplan")).geraetPorts, true);
});

test("Profil prüfen: Unbekanntes ignoriert, falsche Werte aus der Basis, basiertAuf erbt", () => {
  const { profil, warnungen } = profilPruefen({
    name: "Test", basiertAuf: "druck-a3-hell", quatsch: 1,
    design: { linienBreite: "dick", raum: { fuellung: "rot" }, boxRand: "#123456", neu: true },
    inhalt: { stufe: 9, felder: { ip: false, foo: true }, gewerke: ["Licht", "Catering"] },
    kabel: { farbe: "regenbogen" },
  });
  assert.ok(warnungen.length >= 5);
  const hell = eingebautesProfil("druck-a3-hell");
  assert.equal(profil.design.linienBreite, hell.design.linienBreite); // falscher Typ → Basis
  assert.equal(profil.design.raum.fuellung, hell.design.raum.fuellung); // keine Farbe → Basis
  assert.equal(profil.design.raum.kopf, hell.design.raum.kopf); // geerbt
  assert.equal(profil.design.boxRand, "#123456");
  assert.equal(profil.inhalt.stufe, 3);
  assert.deepEqual(profil.inhalt.felder, { ip: false });
  assert.deepEqual(profil.inhalt.gewerke, ["Licht"]);
  assert.equal(profil.kabel.farbe, "dante");
  assert.ok(!("quatsch" in profil) && !("neu" in profil.design));
  assert.equal(profil.eingebaut, false);
  // Kreis in basiertAuf hängt nicht
  const a = { id: "a", basiertAuf: "b" }, b = { id: "b", basiertAuf: "a" };
  assert.ok(profilPruefen({ basiertAuf: "a" }, [a, b]).profil.design);
  // Unbekannte Basis → Standard
  assert.equal(profilPruefen({ basiertAuf: "gibtsnicht" }).profil.design.raum.fuellung, STANDARD_PROFIL.design.raum.fuellung);
});

test("Profil-Datei: speichern und wieder lesen", () => {
  const p = profilPruefen({ ...JSON.parse(JSON.stringify(eingebautesProfil("patchplan"))), id: "eigen-x", name: "Mein Patch", inhalt: { stufe: 4, gewerke: ["Ton"] } }).profil;
  const text = profilDatei(p);
  assert.equal(JSON.parse(text).format, PROFIL_FORMAT);
  assert.ok(!("eingebaut" in JSON.parse(text)));
  const zurueck = profilLesen(text);
  assert.deepEqual(zurueck.warnungen, []);
  assert.equal(zurueck.profil.name, "Mein Patch");
  assert.deepEqual(zurueck.profil.inhalt.gewerke, ["Ton"]);
  assert.ok(profilLesen("kein json").fehler);
  assert.ok(profilLesen("{\"a\":1}").fehler);
});

test("Detailstufen: Felder je Stufe, einzelne Schalter gehen vor", () => {
  const P = demoProject();
  const s2 = plan(P, { profil: mitProfil((p) => { p.inhalt.stufe = 2; }) });
  assert.ok(s2.boxen.every((b) => !b.tIp));
  assert.ok(s2.boxen.some((b) => b.tSub));
  const s3ohneModell = plan(P, { profil: mitProfil((p) => { p.inhalt.felder = { modell: false }; }) });
  assert.ok(s3ohneModell.boxen.every((b) => !b.tSub));
  assert.ok(s3ohneModell.boxen.some((b) => b.tIp));
  // Patch: Ports als farbige Kästchen an beiden Enden, auch am Endgerät
  const s4 = plan(P, { profil: eingebautesProfil("patchplan") });
  const X = buildIndex(P);
  assert.ok(s4.ports.some((p) => !X.devById.get(p.an)?.isSwitch));
  assert.ok(s4.ports.length >= 2 * s4.linien.length - 2);
  // Ohne Kästchen: Port-Namen am Endgerät als Text
  const s4text = plan(P, { profil: mitProfil((p) => { p.inhalt.stufe = 4; p.inhalt.felder = { portKaesten: false }; }) });
  assert.ok(s4text.linien.flatMap((l) => l.labels).some((t) => t.an && !X.devById.get(t.an)?.isSwitch));
  const s3 = plan(P, { profil: STANDARD_PROFIL });
  assert.equal(s3.linien.flatMap((l) => l.labels).filter((t) => t.an && !X.devById.get(t.an)?.isSwitch).length, 0);
});

test("Stufe 1: gleiche Endgeräte am selben Switch als Sammelkasten", () => {
  const P = demoProject();
  const L = plan(P, { profil: mitProfil((p) => { p.inhalt.stufe = 1; }) });
  const sammel = L.boxen.filter((b) => b.sammel);
  assert.ok(sammel.length > 0, "mindestens ein Sammelkasten");
  assert.ok(L.boxen.length < P.geraete.length);
  for (const b of sammel) {
    assert.match(b.name, new RegExp(`^${b.sammel.length}× `));
    assert.ok(b.sammel.length >= 2);
  }
  // Jedes Gerät steckt genau einmal im Plan (allein oder in einem Sammelkasten)
  const drin = L.boxen.flatMap((b) => b.sammel || [b.id]).sort();
  assert.deepEqual(drin, P.geraete.map((d) => d.id).sort());
  assert.ok(L.legende.sammel);
  // Ohne Namen-Zusätze: nur der Name im Kasten
  assert.ok(L.boxen.every((b) => !b.tSub && !b.tIp && !b.notiz));
});

test("Gewerke-Filter: andere Gewerke blass oder aus, Switches bleiben", () => {
  const P = demoProject();
  const licht = P.geraete.filter((d) => gewerkVon(d) === "Licht");
  const ton = P.geraete.filter((d) => gewerkVon(d) === "Ton");
  assert.ok(licht.length && ton.length);
  const blass = plan(P, { profil: mitProfil((p) => { p.inhalt.gewerke = ["Licht"]; }) });
  assert.equal(blass.boxen.length, P.geraete.length);
  for (const d of ton) assert.ok(blass.boxen.find((b) => b.id === d.id).blass, d.name);
  for (const d of licht) assert.ok(!blass.boxen.find((b) => b.id === d.id).blass, d.name);
  assert.ok(blass.linien.some((l) => l.blass));
  const aus = plan(P, { profil: mitProfil((p) => { p.inhalt.gewerke = ["Licht"]; p.inhalt.fremde = "aus"; }) });
  const ids = new Set(aus.boxen.map((b) => b.id));
  for (const d of ton) assert.ok(!ids.has(d.id), d.name);
  for (const d of P.geraete.filter((x) => x.isSwitch || !gewerkVon(x))) assert.ok(ids.has(d.id), d.name);
  for (const l of aus.linien) assert.ok(ids.has(l.von) && ids.has(l.bis));
  // Alle drei Gewerke an = kein Filter
  assert.equal(fingerabdruck(plan(P, { profil: mitProfil((p) => { p.inhalt.gewerke = ["Licht", "Ton", "Video"]; }) })), fingerabdruck(plan(P, { profil: STANDARD_PROFIL })));
});

test("Projekt: Profil wird beim Laden geprüft, alte Projekte bleiben ohne Profil", () => {
  const alt = migrateProject({ ...demoProject() });
  assert.ok(!("planProfil" in alt));
  assert.equal(projektProfil(alt).id, "standard");
  assert.equal(projektProfil(alt, { farbe: "vlan", zeigeIp: false }).kabel.farbe, "vlan");
  const neu = migrateProject({ ...demoProject(), planProfil: { id: "eigen-1", name: "X", basiertAuf: "patchplan", design: { papier: "kaputt" }, unsinn: 1 } });
  assert.equal(neu.planProfil.design.papier, STANDARD_PROFIL.design.papier);
  assert.equal(neu.planProfil.inhalt.stufe, 4);
  assert.ok(!("unsinn" in neu.planProfil));
  // Gespeichertes Profil schlägt die Einstellungen des Rechners
  assert.equal(projektProfil(neu, { farbe: "vlan" }).kabel.farbe, "dante");
});

const orthogonal = (pts) => pts.every((p, i) => i === 0 || p[0] === pts[i - 1][0] || p[1] === pts[i - 1][1] || Math.abs(p[0] - pts[i - 1][0]) < 0.01 || Math.abs(p[1] - pts[i - 1][1]) < 0.01);

test("Editor: verschobener Kasten, Kabel folgen rechtwinklig und bleiben angeschlossen", () => {
  const P = demoProject();
  const vorher = plan(P, { profil: STANDARD_PROFIL });
  const l0 = vorher.linien.find((l) => !P.geraete.find((d) => d.id === l.von)?.isSwitch || !P.geraete.find((d) => d.id === l.bis)?.isSwitch);
  const id = P.geraete.find((d) => d.id === l0.bis && !d.isSwitch) ? l0.bis : l0.von;
  const b0 = vorher.boxen.find((b) => b.id === id);
  P.layout = { ...P.layout, plottPos: { [id]: { dx: 85, dy: -40 } } };
  const nach = plan(P, { profil: STANDARD_PROFIL });
  const b1 = nach.boxen.find((b) => b.id === id);
  assert.equal(b1.x, b0.x + 85);
  assert.equal(b1.y, b0.y - 40);
  for (const l of nach.linien.filter((x) => x.von === id || x.bis === id)) {
    assert.ok(orthogonal(l.pts), `rechtwinklig ${l.id}`);
    const ende = l.von === id ? l.pts[0] : l.pts[l.pts.length - 1];
    assert.ok(ende[0] >= b1.x - 0.5 && ende[0] <= b1.x + b1.w + 0.5, "Ende waagrecht am Kasten");
    assert.ok(Math.abs(ende[1] - b1.y) < 0.5 || Math.abs(ende[1] - (b1.y + b1.h)) < 0.5, "Ende oben oder unten am Kasten");
  }
  // Das Blatt wächst mit, wenn ein Kasten weit hinaus geschoben wird
  P.layout.plottPos[id] = { dx: 4000, dy: 0 };
  const weit = plan(P, { profil: STANDARD_PROFIL });
  assert.ok(weit.w > vorher.w);
});

test("Editor: gezogener Kabelverlauf, eigene Farben je Kasten und Kabel", () => {
  const P = demoProject();
  const vorher = plan(P, { profil: STANDARD_PROFIL });
  const l0 = vorher.linien.find((l) => l.pts.length >= 4);
  const innen = l0.pts.slice(1, -1).map(([x, y]) => [x, y + 20]);
  const box = vorher.boxen[0];
  P.layout = { ...P.layout, plottKabel: { [l0.id]: innen }, plottFarben: { [l0.id]: "#123456", [box.id]: "#abcdef" } };
  const nach = plan(P, { profil: STANDARD_PROFIL });
  const l1 = nach.linien.find((l) => l.id === l0.id);
  assert.ok(l1.hand);
  assert.ok(orthogonal(l1.pts));
  for (const p of innen) assert.ok(l1.pts.some((q) => Math.abs(q[0] - p[0]) < 0.01 && Math.abs(q[1] - p[1]) < 0.01));
  assert.deepEqual(l1.pts[0], l0.pts[0]);
  assert.deepEqual(l1.pts[l1.pts.length - 1], l0.pts[l0.pts.length - 1]);
  assert.equal(l1.col, "#123456");
  assert.equal(nach.boxen.find((b) => b.id === box.id).fill, "#abcdef");
});

test("Design: Abstände ändern den Plan, Kategoriefarben werden geprüft", () => {
  const P = demoProject();
  const std = plan(P, { profil: STANDARD_PROFIL });
  const weit = plan(P, { profil: mitProfil((p) => { p.anordnung.raumAbstand = 200; p.anordnung.kastenAbstand = 80; }) });
  assert.notEqual(fingerabdruck(weit), fingerabdruck(std));
  const { profil } = profilPruefen({ anordnung: { raumAbstand: 9999, kastenAbstand: -5 }, design: { kategorieFarben: { Ton: "#3b82f6", Quatsch: "#ffffff", Licht: "rot" } } });
  assert.ok(profil.anordnung.raumAbstand <= 300);
  assert.ok(profil.anordnung.kastenAbstand >= 10);
  assert.deepEqual(profil.design.kategorieFarben, { Ton: "#3b82f6" });
  const ton = plan(P, { profil: mitProfil((p) => { p.design.kategorieFarben = { Ton: "#3b82f6" }; }) });
  const tonGeraet = P.geraete.find((d) => d.kategorie === "Ton" && !d.isSwitch);
  assert.notEqual(ton.boxen.find((b) => b.id === tonGeraet.id).fill, std.boxen.find((b) => b.id === tonGeraet.id).fill);
});

test("Port-Kästchen: alle Ports, auch unbelegte; eigene Port-Farbe vor VLAN-Farbe", () => {
  const P = demoProject();
  const L = plan(P, { profil: eingebautesProfil("patchplan") });
  for (const b of L.boxen.filter((x) => !x.sammel)) {
    const d = P.geraete.find((g) => g.id === b.id);
    const ids = new Set(L.ports.filter((p) => p.an === d.id).map((p) => p.port));
    for (const p of d.ports.filter((x) => !x.virtuell)) assert.ok(ids.has(p.id), `${d.name} ${p.name}`);
  }
  const frei = L.ports.filter((p) => p.frei);
  assert.ok(frei.length > 0);
  // Leiste im Kasten, ohne Abstand; jedes Kabel endet mitten an seiner Port-Zelle
  for (const b of L.boxen.filter((x) => !x.sammel)) {
    const z = L.ports.filter((p) => p.an === b.id);
    z.forEach((p, i) => { assert.ok(p.x >= b.x - 0.01 && p.x + p.w <= b.x + b.w + 0.01 && p.y >= b.y - 0.01 && p.y + p.h <= b.y + b.h + 0.01, `${b.name} im Kasten`); if (i) assert.ok(Math.abs(p.x - z[i - 1].x - z[i - 1].w) < 0.01, `${b.name} ohne Abstand`); });
  }
  const X = buildIndex(P);
  for (const l of L.linien) {
    const c = P.verbindungen.find((v) => v.id === l.id);
    for (const [e, pt] of [[c.a.dev === l.von ? c.a : c.b, l.pts[0]], [c.a.dev === l.von ? c.b : c.a, l.pts[l.pts.length - 1]]]) {
      const z = L.ports.find((p) => p.an === e.dev && p.port === e.port);
      if (z && X.portRef.get(`${e.dev}:${e.port}`)) assert.ok(Math.abs(pt[0] - (z.x + z.w / 2)) < 0.01, `${l.id} an Port ${e.port}`);
    }
    assert.ok(orthogonal(l.pts), `${l.id} rechtwinklig`);
  }
  // Unbelegte Zellen liegen nicht auf belegten desselben Geräts
  for (const f of frei) for (const k of L.ports.filter((p) => !p.frei && p.an === f.an)) {
    assert.ok(f.x >= k.x + k.w - 0.01 || f.x + f.w <= k.x + 0.01 || f.y >= k.y + k.h - 0.01 || f.y + f.h <= k.y + 0.01, `${f.an} ${f.port}`);
  }
  // Eigene Farbe am Port schlägt die VLAN-Farbe, belegt wie unbelegt
  const k = L.ports.find((p) => !p.frei), f = frei[0];
  for (const x of [k, f]) P.geraete.find((g) => g.id === x.an).ports.find((p) => p.id === x.port).farbe = "#ff00aa";
  const L2 = plan(P, { profil: eingebautesProfil("patchplan") });
  for (const x of [k, f]) assert.equal(L2.ports.find((p) => p.an === x.an && p.port === x.port).fill, "#ff00aa");
  // Ohne eigene Farbe: VLAN-Farbe des Ports
  const mitVlan = L.ports.find((p) => { const q = P.geraete.find((g) => g.id === p.an).ports.find((x) => x.id === p.port); return !q.farbe && q.vlan && P.vlans.find((v) => v.id === q.vlan)?.farbe && q.modus !== "trunk" && !q.trunk; });
  const q = P.geraete.find((g) => g.id === mitVlan.an).ports.find((x) => x.id === mitVlan.port);
  assert.equal(mitVlan.fill, P.vlans.find((v) => v.id === q.vlan).farbe);
});

test("Schriftgrößen: Titel, Beschreibung und Ports einzeln, Grenzen 50–200 %", () => {
  const P = demoProject();
  const std = plan(P, { profil: eingebautesProfil("patchplan") });
  const gross = plan(P, { profil: mitProfil((p) => { p.inhalt.stufe = 4; p.design.schriftGroesse = { titel: 1.5, beschreibung: 1.4, ports: 1.6 }; }) });
  const b0 = std.boxen.find((b) => b.tSub && b.tIp), b1 = gross.boxen.find((b) => b.id === b0.id);
  assert.ok(b1.tName.fs > b0.tName.fs || b1.tName.t.length < b0.tName.t.length);
  assert.ok(b1.tSub.fs > b0.tSub.fs);
  assert.ok(b1.h > b0.h, "Kasten wächst mit");
  const p0 = std.ports.find((p) => p.an === b0.id), p1 = gross.ports.find((p) => p.an === b0.id && p.port === p0.port);
  assert.ok(p1.h > p0.h && p1.t.fs > p0.t.fs);
  const { profil } = profilPruefen({ design: { schriftGroesse: { titel: 5, beschreibung: 0.1, ports: "x" } } });
  assert.deepEqual(profil.design.schriftGroesse, { titel: 2, beschreibung: 0.5, ports: 1 });
});
