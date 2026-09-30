import test from "node:test";
import assert from "node:assert/strict";
import { bestandZuCsv, csvZuBestand, parseCsv } from "../src/shared/bestandcsv.js";
import { emptyProject } from "../src/shared/model.js";
import { createDevice, KATALOG_GERAETE } from "../src/shared/catalog.js";

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
  assert.equal(pu.interfaces[0].ip, "172.16.2.131");
  assert.equal(pu.interfaces[0].vid, 50);
  assert.equal(pu.interfaces[1].prefix, 8);
  assert.equal(pu.interfaces[2].dhcp, true);
  assert.equal(pu.inventar.nr, "INV-1");
  const lap = bestand[1].geraet;
  assert.equal(lap.interfaces[0].ip, "172.16.2.52");
  // Rundreise
  const wieder = csvZuBestand(bestandZuCsv(bestand), P.vlans).bestand;
  assert.equal(wieder[0].geraet.interfaces[1].ip, "10.0.2.131");
  assert.equal(wieder[0].geraet.katalogId, pu.katalogId);
  assert.equal(wieder[1].geraet.netzname, "BL_Lap");
  // eingefügt ins Projekt: VLAN 50 wird zugeordnet
  const d = createDevice({ eigeneVorlage: wieder[0], vlans: P.vlans, mitAdressen: true });
  assert.equal(P.vlans.find((v) => v.id === d.interfaces[0].vlan)?.vid, 50);
});
