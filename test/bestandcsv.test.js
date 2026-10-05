import test from "node:test";
import assert from "node:assert/strict";
import { bestandZuCsv, csvZuBestand, parseCsv } from "../src/shared/bestandcsv.js";
import { emptyProject } from "../src/shared/model.js";
import { createDevice, KATALOG_GERAETE, ipPorts } from "../src/shared/catalog.js";

test("CSV liest Semikolon, Komma und Anführungszeichen", () => {
  assert.deepEqual(parseCsv('A;B\n1;"x;y"\n'), [{ A: "1", B: "x;y" }]);
  assert.deepEqual(parseCsv('A,B\r\n"he said ""hi""",2\r\n'), [{ A: 'he said "hi"', B: "2" }]);
});

test("Bestand übersteht CSV-Export und -Import (Katalogmodell, IPs, Inventar; VLAN-Spalten nur für Switches)", () => {
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
  assert.equal(ipPorts(pu)[0].vid, null, "Endgerät: VLAN-Spalte wird ignoriert");
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
  const zeilen = bestandZuCsv(bestand).split("\r\n").map((z) => z.split(";"));
  const sp = zeilen[0].indexOf("VLAN1");
  assert.ok(sp > 0, "VLAN-Spalten für Switches");
  assert.equal(zeilen[1][sp], "", "Endgerät: VLAN-Spalte leer");
  // eingefügt ins Projekt: kein VLAN am Gerät, das kommt vom Switch-Port
  const n = P.vlans.length;
  const d = createDevice({ eigeneVorlage: wieder[0], vlans: P.vlans, mitAdressen: true });
  assert.ok(ipPorts(d).every((p) => !p.vlan));
  assert.equal(P.vlans.length, n);
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

test("Bestand: derselbe Import auf zwei Rechnern ergibt dieselben IDs, Doppelte im Plan werden gemeldet", async () => {
  const { bestandSchluessel, doppelteBestandsgeraete } = await import("../src/shared/bestandschluessel.js");
  const g = (felder, mac = "") => ({ hersteller: "Yamaha", felder, ports: [{ mac }] });
  assert.equal(bestandSchluessel(g([{ id: "inventar-nr", name: "Inventar-Nr.", wert: " VT-0042 " }])), "inv:vt-0042");
  assert.equal(bestandSchluessel(g([{ id: "x", name: "Seriennummer", wert: "AB12" }])), "sn:yamaha|ab12");
  assert.equal(bestandSchluessel(g([], "00:1D:C1:0A:0B:0C")), "mac:001dc10a0b0c");
  assert.equal(bestandSchluessel(g([])), null);
  const P = { geraete: [{ id: "a", name: "A", ...g([{ id: "inventar-nr", wert: "7" }]) }, { id: "b", name: "B", ...g([{ id: "inventar-nr", wert: "7" }]) }, { id: "c", name: "C", ...g([]) }] };
  assert.deepEqual(doppelteBestandsgeraete(P).map((x) => x.map((d) => d.id)), [["a", "b"]]);
});

test("CSV-Import: gleiche Datei zweimal importiert ergibt gleiche Bestand-IDs", () => {
  const csv = "Name;Hersteller;Modell;Typ;Inventar-Nr.;IP1;MAC1\nPult;Yamaha;CL5;mischpult;VT-1;10.0.0.5/24;00:11:22:33:44:55\nNode;Luminex;GigaCore 10;switch;;10.0.0.6/24;00:11:22:33:44:66\nLeer;;;pc;;;";
  const a = csvZuBestand(csv, emptyProject().vlans).bestand, b = csvZuBestand(csv, emptyProject().vlans).bestand;
  assert.equal(a[0].id, b[0].id);
  assert.equal(a[1].id, b[1].id);
  assert.notEqual(a[2].id, b[2].id); // ohne Merkmal bleibt es eine Zufalls-ID
});

test("CSV: Switch behält sein Management-VLAN über Export und Import", () => {
  const P = emptyProject();
  const csv = "Name;Typ;IP1;VLAN1\nSW 1;switch_managed;10.10.99.11/24;99\n";
  const { bestand } = csvZuBestand(csv, P.vlans);
  const sw = bestand[0].geraet;
  assert.ok(sw.isSwitch);
  assert.equal(ipPorts(sw)[0].vid, 99);
  const zeilen = bestandZuCsv(bestand).split("\r\n").map((z) => z.split(";"));
  assert.equal(zeilen[1][zeilen[0].indexOf("VLAN1")], "99");
  assert.equal(ipPorts(csvZuBestand(bestandZuCsv(bestand), P.vlans).bestand[0].geraet)[0].vid, 99);
});
