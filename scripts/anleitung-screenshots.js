// Screenshots der Anleitung neu aufnehmen, je hell und dunkel:
//   npm run build && node scripts/anleitung-screenshots.js [id …]
// Braucht Playwright mit Chromium (nicht in den Abhängigkeiten: `npx playwright install chromium`).
// Legt assets/anleitung/<id>.jpg (hell) und <id>-dunkel.jpg ab. Die Desktop-Brücke wird
// nachgebildet, damit Live, Discovery und Online-Status Beispieldaten zeigen.
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const SEITE = "file://" + path.join(ROOT, "dist-app", "index.html");
const ZIEL = path.join(ROOT, "assets", "anleitung");
const W = 1360, H = 840;

// Nachgebildete Desktop-Brücke (läuft im Browser vor der App)
function bruecke() {
  const monitore = {
    dante: { running: true, snapshot: { instances: [
      { ip: "10.10.10.11", label: "Rio3224-D3-A", host: "Rio-A.local", service: "_netaudio-arc._udp", zustand: "aktiv" },
      { ip: "192.168.1.50", label: "Rio3224-D2", host: "Rio3224-D2.local", service: "_netaudio-arc._udp", zustand: "aktiv" },
    ] } },
    artnet: { running: true, snapshot: { nodes: [
      { ip: "10.10.20.12", shortName: "LumiNode 12", longName: "Luminex LumiNode 12", mac: "00:11:22:33:44:12", zustand: "aktiv" },
      { ip: "192.168.1.70", shortName: "LumiNode 12", longName: "Luminex LumiNode 12", mac: "00:11:22:33:44:70", zustand: "aktiv" },
    ] } },
    scan: { running: false, snapshot: { subnet: "192.168.1.0/24", hosts: [
      { ip: "192.168.1.50", mac: "aa:bb:cc:dd:ee:50" }, { ip: "192.168.1.60", mac: "aa:bb:cc:dd:ee:60" }, { ip: "192.168.1.70", mac: "00:11:22:33:44:70" },
    ] } },
  };
  const antworten = {
    getRecents: [], loadLibrary: null, fetchReleases: null, appVersion: window.__NP_VERSION__ || "dev",
    checkForUpdates: { auto: false }, monState: monitore, monStart: { ok: true }, monStop: { ok: true }, monAction: { ok: true },
    monInterfaces: [{ name: "Ethernet (Show)", address: "10.10.99.50", prefix: 24 }, { name: "WLAN", address: "192.168.178.23", prefix: 24 }],
  };
  window.electronAPI = new Proxy({}, {
    get: (_, k) => {
      if (typeof k !== "string") return undefined;
      if (k.startsWith("on")) return () => () => {};
      if (k === "checkReachability") return async (ziele) => Object.fromEntries(ziele.map((z, i) => [z.id, i % 7 === 5 ? { ok: false, t: Date.now() } : { ok: true, ms: 1 + (i % 4), method: z.port ? "tcp" : "ping", t: Date.now() }]));
      return async () => antworten[k];
    },
  });
}

const klick = (p, a) => p.locator(`[data-tour="${a}"]`).first().click();
const warte = (p, ms = 500) => p.waitForTimeout(ms);
const knoten = async (p, name, rechts) => {
  const r = await p.evaluate((n) => { const t = [...document.querySelectorAll('[data-tour="topo-flaeche"] svg title')].find((x) => x.textContent === n); const b = t.parentElement.getBoundingClientRect(); return { x: b.left + 30, y: b.top + 15 }; }, name);
  await p.mouse.click(r.x, r.y, rechts ? { button: "right" } : undefined);
};
// Stage-Plot als Hintergrundbild, im Browser gezeichnet
const stagePlot = (p) => p.evaluate(() => {
  const c = document.createElement("canvas"); c.width = 1600; c.height = 1000;
  const g = c.getContext("2d");
  g.fillStyle = "#fbfaf5"; g.fillRect(0, 0, 1600, 1000);
  g.strokeStyle = "#8a8f98"; g.lineWidth = 4; g.strokeRect(60, 60, 1480, 880);
  g.fillStyle = "#e7e3d6"; g.fillRect(300, 90, 1000, 360); g.strokeRect(300, 90, 1000, 360);
  g.fillStyle = "#d9d3c2"; g.fillRect(700, 760, 200, 120); g.strokeRect(700, 760, 200, 120);
  g.fillStyle = "#4b515a"; g.font = "bold 48px sans-serif"; g.textAlign = "center";
  g.fillText("BÜHNE", 800, 280); g.font = "bold 36px sans-serif"; g.fillText("FOH", 800, 830);
  g.font = "28px sans-serif"; g.fillText("Monitor", 200, 300); g.fillText("Delay L", 200, 700); g.fillText("Delay R", 1400, 700);
  return c.toDataURL("image/png").split(",")[1];
});

const SZENEN = {
  projekt: async (p) => { await klick(p, "tab-projekt"); },
  "topologie-mindmap": async (p) => { await klick(p, "tab-topologie"); await klick(p, "ansicht-mindmap"); },
  "topologie-eckig": async (p) => {
    await klick(p, "tab-topologie"); await klick(p, "ansicht-mindmap");
    await p.locator('[data-tour="topo-darstellung"] button').first().click();
    await p.locator('select[title="Form der Verbindungslinien"]').selectOption("eckig");
    await p.mouse.click(700, 820); // Klappmenü schließen
  },
  "topologie-frontplatten": async (p) => { await klick(p, "tab-topologie"); await klick(p, "ansicht-front"); await warte(p, 900); },
  "topologie-hintergrund": async (p) => {
    await klick(p, "tab-topologie"); await klick(p, "ansicht-front");
    await p.locator('[data-tour="topo-anordnen"] button').first().click();
    await p.getByRole("button", { name: "Hintergrundbild …" }).click();
    await p.locator('input[type="file"][accept^="image/png"]').setInputFiles({ name: "stageplot.png", mimeType: "image/png", buffer: Buffer.from(await stagePlot(p), "base64") });
    await p.mouse.click(1000, 780); // Klappmenü schließen, das Hintergrund-Fenster bleibt
    await warte(p, 800);
  },
  geraete: async (p) => { await klick(p, "tab-geraete"); await klick(p, "geraete-liste"); },
  "geraet-editor": async (p) => { await klick(p, "tab-topologie"); await klick(p, "ansicht-mindmap"); await warte(p); await knoten(p, "SW FOH"); },
  "geraet-generisch": async (p) => {
    await klick(p, "tab-live"); await klick(p, "live-discovery"); await warte(p);
    await p.getByRole("button", { name: /Alle neuen einfügen/ }).click(); await warte(p);
    await klick(p, "tab-geraete"); await klick(p, "geraete-liste");
    await p.locator('[data-tour="geraete-tabelle"] tr', { hasText: "Rio3224-D2" }).first().click();
  },
  "katalog-bestand": async (p) => { await klick(p, "tab-bibliothek"); await klick(p, "bib-bestand"); await klick(p, "bib-uebernehmen"); },
  "katalog-neu": async (p) => { await klick(p, "tab-bibliothek"); await klick(p, "bib-bestand"); await p.getByRole("button", { name: "+ Neues Gerät" }).click(); },
  "katalog-hersteller": async (p) => { await klick(p, "tab-bibliothek"); await klick(p, "bib-katalog"); },
  live: async (p) => { await klick(p, "tab-live"); await klick(p, "live-status"); await p.getByRole("button", { name: "Jetzt prüfen" }).click(); },
  "live-discovery": async (p) => { await klick(p, "tab-live"); await klick(p, "live-discovery"); },
  vlans: async (p) => { await klick(p, "tab-vlans"); await p.locator('[data-tour="vlan-liste"] [style*="cursor: pointer"]').first().click().catch(() => {}); },
  // Meldungen in der Topologie; MA-Net-Goldstandards aus dem Netzwerk-Wissen
  pruefung: async (p) => { await klick(p, "tab-topologie"); await klick(p, "ansicht-mindmap"); await p.locator('[data-tour="topo-meldungen"] button[title*="Warnung"]').click(); },
  "pruefung-manet": async (p) => {
    await klick(p, "tab-hilfe"); await p.locator('[data-tour="hilfe-bereiche"] button', { hasText: "Netzwerk-Wissen" }).click();
    await p.getByRole("button", { name: "MA-Net (1–3)" }).click(); await warte(p, 300);
    await p.evaluate(() => [...document.querySelectorAll("h3")].find((h) => /Goldstandards/.test(h.textContent))?.scrollIntoView({ block: "start" }));
  },
  "wissen-poster": async (p) => { await klick(p, "tab-hilfe"); await p.locator('[data-tour="hilfe-bereiche"] button', { hasText: "Netzwerk-Wissen" }).click(); await p.getByRole("button", { name: "OSI-Modell & Ports" }).click(); },
};

(async () => {
  const nur = process.argv.slice(2);
  const version = require(path.join(ROOT, "package.json")).version;
  const b = await chromium.launch();
  for (const theme of ["hell", "dunkel"]) {
    for (const [id, szene] of Object.entries(SZENEN)) {
      if (nur.length && !nur.includes(id)) continue;
      const ctx = await b.newContext({ viewport: { width: W, height: H }, colorScheme: theme === "hell" ? "light" : "dark" });
      await ctx.addInitScript(([t, v, fn]) => { try { localStorage.setItem("netzwerkplaner_theme", t); } catch {} window.__NP_VERSION__ = v; (0, eval)(`(${fn})()`); }, [theme, version, bruecke.toString()]);
      const p = await ctx.newPage();
      p.on("dialog", (d) => d.accept());
      p.on("pageerror", (e) => console.log(id, theme, "Fehler:", e.message));
      await p.goto(SEITE);
      await warte(p, 700);
      await p.getByRole("button", { name: "Beispielprojekt laden" }).first().click();
      await warte(p, 700);
      try { await szene(p); } catch (e) { console.log(id, theme, "Szene:", e.message.split("\n")[0]); }
      await warte(p, 900);
      const datei = path.join(ZIEL, `${id}${theme === "dunkel" ? "-dunkel" : ""}.jpg`);
      await p.screenshot({ path: datei, type: "jpeg", quality: 82 });
      console.log("ok", path.relative(ROOT, datei));
      await ctx.close();
    }
  }
  await b.close();
})();
