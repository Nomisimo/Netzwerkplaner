import test from "node:test";
import assert from "node:assert/strict";
import { bestandZuCsv, csvZuBestand, parseCsv } from "../src/shared/bestandcsv.js";
import { emptyProject } from "../src/shared/model.js";
import { createDevice, KATALOG_GERAETE, ipPorts } from "../src/shared/catalog.js";

test("CSV liest Semikolon, Komma und Anführungszeichen", () => {
  assert.deepEqual(parseCsv('A;B\n1;"x;y"\n'), [{ A: "1", B: "x;y" }]);
  assert.deepEqual(parseCsv('A,B\r\n"he said ""hi""",2\r\n'), [{ A: 'he said "hi"', B: "2" }]);
});

test("Bestand übersteht CSV-Export und -Import (Katalogmodell, IPs, VLAN, Inventar)", () => {
  const P = emptyProject();
  const csv = [
    "Name;Netzwerkname;Hersteller;Modell;IP1;VLAN1;IP2;VLAN2;IP3;Inventar-Nr.",
    "PU-M1;PU-M1_AUE;MA Lighting;grandMA3 processing unit M;172.16.2.131/24;50;10.0.2.131/8;;DHCP;INV-1",
    "Laptop BL;BL_Lap;;;172.16.2.52/24;;;;;",
  ].join("\n");
  const { bestand, fehler } = csvZuBestand(csv, P.vlans);
  assert.equal(fehler.length, 0);
  assert.equal(bestand.length, 2);
  const pu = bestand[0].geraet;
  assert.match(pu.modell, /processing unit M/);
  assert.ok(KATALOG_GERAETE.some((k) => k.id === pu.katalogId), "Katalogmodell erkannt");
  assert.equal(pu.netzname, "PU-M1_AUE");
  assert.equal(ipPorts(pu)[0].ip, "172.16.2.131");
  assert.equal(ipPorts(pu)[0].vid, 50);
  assert.equal(ipPorts(pu)[1].prefix, 8);
  assert.equal(ipPorts(pu)[2].dhcp, true);
  assert.deepEqual(pu.felder.map((f) => [f.id, f.name, f.wert]), [["inventar-nr", "Inventar-Nr.", "INV-1"]]);
  const lap = bestand[1].geraet;
  assert.equal(ipPorts(lap)[0].ip, "172.16.2.52");
  // Rundreise
  const wieder = csvZuBestand(bestandZuCsv(bestand), P.vlans).bestand;
  assert.equal(ipPorts(wieder[0].geraet)[1].ip, "10.0.2.131");
  assert.equal(wieder[0].geraet.katalogId, pu.katalogId);
  assert.equal(wieder[1].geraet.netzname, "BL_Lap");
  assert.equal(wieder[0].geraet.felder[0].wert, "INV-1", "eigenes Feld übersteht die Rundreise");
  // eingefügt ins Projekt: VLAN 50 wird zugeordnet
  const d = createDevice({ eigeneVorlage: wieder[0], vlans: P.vlans, mitAdressen: true });
  assert.equal(P.vlans.find((v) => v.id === ipPorts(d)[0].vlan)?.vid, 50);
});

test("CSV: unbekannte Spalten werden eigene Felder, Katalogfelder über den Namen", () => {
  const defs = [{ id: "f1", name: "Eigentümer" }];
  const { bestand } = csvZuBestand("Name;eigentümer;Prüfdatum;Seriennummer\nA;Verleih X;2026-01-01;SN9\nB;;2026-02-02;\n", [], defs);
  const a = bestand[0].geraet.felder, b = bestand[1].geraet.felder;
  assert.deepEqual(a.map((f) => f.wert), ["Verleih X", "2026-01-01", "SN9"]);
  assert.equal(a[0].id, "f1");
  assert.equal(a[2].id, "seriennummer");
  assert.equal(a[1].id, b[0].id, "gleiche Spalte → gleiche Feld-ID");
  const csv = bestandZuCsv(bestand, defs);
  assert.match(csv.split("\r\n")[0], /;Eigentümer;Prüfdatum;Seriennummer$/);
});
