#!/usr/bin/env node
/* Erzeugt die Modell-Icons der Fokus-Hersteller (MA, Luminex, Cisco, Yamaha,
   Schnick-Schnack-Systems, Audinate/Dante) und der Aussteller der LEaT con 26
   nach assets/icons/devices/.

   Aufruf:  node scripts/geraete-icons.js

   Die Icons sind 24×24 und einfarbig (currentColor), damit die App sie wie die
   Typ-Icons in der Farbe der Kategorie zeichnen kann. Pulte sind von oben
   gezeichnet, Rack- und Tischgeräte von vorne. Wiedererkennbar werden sie über
   die Merkmale des echten Geräts: Zahl und Lage der Bildschirme, Fader-Blöcke,
   Trackball, Buchsen, Bauhöhe. Bei MA steht zusätzlich die Generation (1/2/3)
   dort, wo am Pult das Typenschild sitzt.

   Wer ein Icon von Hand nachbessert, ändert es hier, sonst überschreibt der
   nächste Lauf die Datei. Zuordnung Katalog → Icon: src/shared/geraeteicons.js */

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets", "icons", "devices");
const f = (n) => +n.toFixed(2);

// ── Grundformen ────────────────────────────────────────────────────────────
const rect = (x, y, w, h, { rx = 0.6, sw = 1.2, fill, op = 1 } = {}) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}" stroke-width="${sw}"` +
  (fill ? ` fill="currentColor" fill-opacity="${fill}"` : "") + (op < 1 ? ` stroke-opacity="${op}"` : "") + "/>";
const solid = (x, y, w, h, op = 1, rx = 0.15) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}" fill="currentColor" stroke="none"${op < 1 ? ` fill-opacity="${op}"` : ""}/>`;
const line = (x1, y1, x2, y2, sw = 0.8, op = 1) =>
  `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke-width="${sw}"${op < 1 ? ` stroke-opacity="${op}"` : ""}/>`;
const path_ = (d, sw = 0.8, fill) => `<path d="${d}" stroke-width="${sw}"${fill ? ` fill="currentColor" fill-opacity="${fill}"` : ""}/>`;
const dot = (cx, cy, r, op = 1) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="currentColor" stroke="none"${op < 1 ? ` fill-opacity="${op}"` : ""}/>`;
const ring = (cx, cy, r, sw = 0.7, fill) =>
  `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" stroke-width="${sw}"${fill ? ` fill="currentColor" fill-opacity="${fill}"` : ""}/>`;

// ── Bauteile ───────────────────────────────────────────────────────────────
const screen = (x, y, w, h) => rect(x, y, w, h, { rx: 0.3, sw: 0.8, fill: 0.35 });
// Nach hinten geklappter Bildschirm (grandMA2): oben schmaler als unten
const tiltScreen = (x, y, w, h) => {
  const i = w * 0.12;
  return path_(`M${f(x + i)} ${f(y)}H${f(x + w - i)}L${f(x + w)} ${f(y + h)}H${f(x)}Z`, 0.8, 0.35);
};
const KNOB = [0.55, 0.3, 0.75, 0.45, 0.2, 0.6, 0.4, 0.7, 0.25, 0.5, 0.65, 0.35, 0.8, 0.45, 0.3];
const faders = (x, y, n, pitch, len, sw = 0.45) => {
  let s = "";
  for (let i = 0; i < n; i++) {
    const cx = x + i * pitch;
    s += line(cx, y, cx, y + len, sw, 0.55);
    s += solid(cx - 0.42, y + KNOB[i % KNOB.length] * (len - 0.8), 0.84, 0.8);
  }
  return s;
};
const encoders = (x, y, n, pitch, r = 0.55) => Array.from({ length: n }, (_, i) => ring(x + i * pitch, y, r, 0.6)).join("");
const keys = (x, y, cols, rows, dx = 1, dy = 1, s = 0.6, op = 0.7) => {
  let o = "";
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) o += solid(x + c * dx, y + r * dy, s, s, op, 0.1);
  return o;
};
const trackball = (cx, cy, r = 1.1) => ring(cx, cy, r, 0.7, 0.5) + ring(cx, cy, r + 0.45, 0.4);
// Ziffer 1/2/3 in einem 1,8 × 2,8 großen Feld (Generationskennung bei MA)
const digit = (n, x, y) => {
  const w = 1.8, h = 2.8, m = y + h / 2;
  const d = {
    1: `M${f(x + 0.5)} ${f(y + 0.6)}L${f(x + 1.2)} ${f(y)}V${f(y + h)}`,
    2: `M${f(x)} ${f(y + 0.5)}Q${f(x + 0.3)} ${f(y)} ${f(x + 0.9)} ${f(y)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + 0.8)}Q${f(x + w)} ${f(m)} ${f(x)} ${f(y + h)}H${f(x + w)}`,
    3: `M${f(x)} ${f(y)}H${f(x + w)}L${f(x + 0.7)} ${f(m - 0.1)}Q${f(x + w)} ${f(m)} ${f(x + w)} ${f(y + 2)}Q${f(x + w)} ${f(y + h)} ${f(x + 0.9)} ${f(y + h)}Q${f(x + 0.2)} ${f(y + h)} ${f(x)} ${f(y + 2.3)}`,
  }[n];
  return path_(d, 0.75);
};
const rj45 = (x, y, w = 1.2, h = 1) => rect(x, y, w, h, { rx: 0.1, sw: 0.5 });
const sfp = (x, y, w = 1.5, h = 0.8) => solid(x, y, w, h, 0.55, 0.1);
const xlr = (cx, cy, r = 1) => ring(cx, cy, r, 0.6) + dot(cx, cy, 0.3);
const ethercon = (cx, cy, r = 1.05) => ring(cx, cy, r, 0.6) + solid(cx - 0.45, cy - 0.35, 0.9, 0.7, 0.8, 0.05);
const led = (cx, cy, op = 1) => dot(cx, cy, 0.3, op);
const display = (x, y, w = 3, h = 1.4) => rect(x, y, w, h, { rx: 0.15, sw: 0.5, fill: 0.4 });
const vents = (x, y, w, n, dy = 0.7) => Array.from({ length: n }, (_, i) => line(x, y + i * dy, x + w, y + i * dy, 0.35, 0.6)).join("");

// Rack-Frontplatte: Ohren links/rechts, Bauhöhe als Zahl der HE
const rack = (he, { half = false, inner = "" } = {}) => {
  const h = { 1: 6.8, 2: 8.8, 3: 10.8, 4: 12.8 }[he];
  const y = 12 - h / 2;
  if (half) return { y, h, x: 5, w: 14, s: rect(5, y, 14, h, { rx: 0.5 }) + inner };
  return {
    y, h, x: 2.4, w: 19.2,
    s: rect(0.9, y, 1.5, h, { rx: 0.3, sw: 0.8 }) + rect(21.6, y, 1.5, h, { rx: 0.3, sw: 0.8 }) +
      dot(1.65, y + 1, 0.3, 0.8) + dot(22.35, y + 1, 0.3, 0.8) + (he > 1 ? dot(1.65, y + h - 1, 0.3, 0.8) + dot(22.35, y + h - 1, 0.3, 0.8) : "") +
      rect(2.4, y, 19.2, h, { rx: 0.4 }),
  };
};
// Kleines Tischgerät (Node, Adapter …)
const box = (x, y, w, h) => rect(x, y, w, h, { rx: 1 });

// ── Die Icons ──────────────────────────────────────────────────────────────
const I = {};

/* MA Lighting — grandMA3: flach, schwarzer Bildschirmrahmen, Doppel-Encoder
   unter den Bildschirmen, kein Trackball. */
I.ma3_full = rect(0.8, 3.5, 22.4, 17, { rx: 1.2 }) +
  screen(1.8, 4.6, 8, 4.8) + screen(14.2, 4.6, 8, 4.8) + screen(10.6, 5.2, 2.8, 3.2) +
  encoders(2.8, 11, 5, 1.5) + encoders(15.2, 11, 5, 1.5) +
  faders(2.3, 13, 6, 1.25, 5.6) + faders(15.5, 13, 6, 1.25, 5.6) +
  keys(10.4, 11.2, 3, 5, 1.2, 1.25) + digit(3, 11.1, 17.3);
I.ma3_light = rect(1.2, 3.5, 21.6, 17, { rx: 1.2 }) +
  screen(2.2, 4.6, 10.2, 5.4) + screen(15, 4.9, 6.6, 3.6) +
  encoders(3.2, 11.6, 6, 1.6) + faders(2.8, 13.4, 8, 1.25, 5.4) +
  keys(15.2, 10.2, 5, 5, 1.3, 1.25) + digit(3, 19.6, 17.3);
I.ma3_compact_xt = rect(2.5, 4.5, 19, 15, { rx: 1.1 }) +
  screen(3.5, 5.5, 9.4, 5) + encoders(4.5, 12.2, 5, 1.8) + faders(4, 14, 7, 1.3, 4.4) +
  keys(14.4, 5.8, 5, 6, 1.25, 1.25) + digit(3, 18.6, 15.8);
I.ma3_compact = rect(3.5, 5.5, 17, 13, { rx: 1 }) +
  screen(4.5, 6.5, 7.6, 4.2) + encoders(5.4, 12.2, 4, 1.8) + faders(5, 14, 5, 1.4, 3.4) +
  keys(13.6, 6.8, 4, 5, 1.3, 1.25) + digit(3, 17.1, 14.8);
I.ma3_extension = rect(1.2, 3.5, 21.6, 17, { rx: 1.2 }) +
  screen(2.2, 4.6, 9.2, 5) + screen(12.6, 4.6, 9.2, 5) +
  encoders(3.2, 11.2, 5, 1.7) + encoders(13.6, 11.2, 5, 1.7) +
  faders(2.8, 13.2, 7, 1.2, 5.4) + faders(13.2, 13.2, 7, 1.2, 5.4);
I.ma3_replay = (() => { const r = rack(3); return r.s + screen(3.6, r.y + 1.3, 6.4, r.h - 2.6) + keys(11.2, r.y + 1.6, 5, 4, 1.35, 1.6, 0.8) + digit(3, 18.9, r.y + r.h - 3.8); })();
const pu = (he, n) => { const r = rack(he); return r.s + display(3.6, r.y + 1.1, 3.4, 1.5) + vents(8.6, r.y + 1.3, 8.6, n) + digit(3, 18.9, 12 - 1.4); };
I.ma3_pu_m = pu(1, 3);
I.ma3_pu_l = pu(2, 7);
I.ma3_pu_xl = pu(3, 10);
I.ma3_cmdwing_xt = rect(2, 5, 20, 14, { rx: 1.1 }) + screen(3, 6, 6.6, 3.8) +
  encoders(3.8, 11.4, 4, 1.6) + faders(3.4, 13.4, 5, 1.4, 4.4) + keys(11.4, 6.2, 7, 5, 1.3, 1.25) + digit(3, 18.9, 15.3);
I.ma3_cmdwing = rect(2.5, 6, 19, 12, { rx: 1 }) + encoders(4, 8, 5, 1.7) + faders(3.8, 10.4, 6, 1.35, 5.8) + keys(12.6, 7.4, 6, 5, 1.3, 1.25) + digit(3, 18.5, 14.3);
I.ma3_faderwing = rect(1.5, 5.5, 21, 13, { rx: 1 }) + faders(3, 7, 15, 1.28, 5) + keys(2.7, 13.4, 15, 1, 1.28, 1, 0.55) + faders(3, 14.7, 15, 1.28, 2.6, 0.35);

/* MA-Nodes: Frontansicht mit der echten Zahl der DMX-Buchsen */
const maNode = (n, gen) => {
  if (n <= 2) {
    return box(3.5, 6.5, 17, 11) + display(5, 8, 4.4, 1.8) + keys(5, 10.8, 4, 1, 1.2, 1, 0.7) +
      xlr(12.6, 13.4, 1.5) + xlr(16.8, 13.4, 1.5) + ethercon(6.2, 14.6) + digit(gen, 17.4, 7.7);
  }
  const r = rack(n === 4 ? 1 : 2);
  const cx = n === 4 ? [12, 14.6, 17.2, 19.8] : [8.4, 10.4, 12.4, 14.4, 16.4, 18.4, 20.4];
  let s = r.s + display(3.4, r.y + 1, 3.6, 1.6) + keys(3.5, r.y + r.h - 1.8, 3, 1, 1.2, 1, 0.7);
  if (n === 4) cx.forEach((x) => (s += xlr(x, 12, 1)));
  else { [8.2, 10.4, 12.6, 14.8].forEach((x) => (s += xlr(x, r.y + 2.1, 0.9) + xlr(x, r.y + r.h - 2.1, 0.9))); }
  return s + (n === 4 ? digit(gen, 7.6, 10.6) : digit(gen, 18.6, 10.6));
};
I.ma3_node2 = maNode(2, 3);
I.ma3_node4 = maNode(4, 3);
I.ma3_node8 = maNode(8, 3);
I.ma2_node2 = maNode(2, 2);
I.ma2_node8 = maNode(8, 2);
I.ma3_ionode = (() => { const r = rack(1); return r.s + display(3.4, r.y + 1, 3.6, 1.6) + ring(9.4, 12, 1.2, 0.6) + dot(9, 11.7, 0.2) + dot(9.8, 11.7, 0.2) + dot(9.4, 12.5, 0.2) + ring(12.6, 12, 1.2, 0.6) + dot(12.2, 11.7, 0.2) + dot(13, 11.7, 0.2) + dot(12.6, 12.5, 0.2) + ring(15.6, 12, 0.8, 0.6) + dot(15.6, 12, 0.25) + rect(17.4, 11.1, 3.2, 1.8, { rx: 0.2, sw: 0.5 }) + keys(17.8, 11.6, 4, 2, 0.7, 0.6, 0.35, 0.9); })();
I.ma_switch = (() => { const r = rack(1); let s = r.s + display(3.4, r.y + 1, 3.2, 1.5) + led(4, r.y + r.h - 1.2); [8.6, 10.9, 13.2, 15.5].forEach((x) => (s += ethercon(x, 11, 0.85) + ethercon(x, 13.3, 0.85))); return s + sfp(17.6, 10.4, 1.6, 0.8) + sfp(17.6, 12.8, 1.6, 0.8) + sfp(19.5, 10.4, 1.6, 0.8) + sfp(19.5, 12.8, 1.6, 0.8); })();

/* grandMA2: klappbare Bildschirme (perspektivisch schmaler), Trackball,
   Fader-Reihe unten */
I.ma2_full = rect(0.8, 3.5, 22.4, 17, { rx: 1.4 }) +
  tiltScreen(1.8, 4.4, 8, 5) + tiltScreen(14.2, 4.4, 8, 5) + screen(10.5, 5.4, 3, 3.4) +
  encoders(3, 11, 4, 1.6) + trackball(12, 11.6, 0.9) + encoders(15.8, 11, 4, 1.6) +
  faders(2.3, 13.6, 6, 1.25, 5) + faders(15.5, 13.6, 6, 1.25, 5) + keys(10.3, 13.6, 3, 3, 1.3, 1.1) + digit(2, 11.1, 17.3);
I.ma2_light = rect(1.2, 3.5, 21.6, 17, { rx: 1.4 }) +
  tiltScreen(2.2, 4.4, 10.4, 5.6) + screen(14.8, 5.2, 5.6, 3.4) + trackball(19.9, 11.8, 1.1) +
  encoders(3.2, 11.4, 5, 1.8) + faders(2.6, 13.6, 10, 1.1, 5) + keys(14.4, 10.2, 3, 5, 1.2, 1.2) + digit(2, 19.6, 17.1);
I.ma2_ultralight = rect(2.8, 5, 18.4, 14, { rx: 1.2 }) +
  screen(12.8, 6, 7.2, 4) + trackball(16.3, 13.6, 1) + encoders(4.6, 7, 5, 1.6) +
  faders(4.2, 9.2, 6, 1.35, 5.4) + keys(12.8, 11.4, 2, 5, 1.2, 1.15) + digit(2, 18.6, 15.2);
I.ma2_replay = (() => { const r = rack(3); return r.s + tiltScreen(3.6, r.y + 1.3, 6.4, r.h - 2.6) + keys(11.2, r.y + 1.6, 5, 4, 1.35, 1.6, 0.8) + digit(2, 18.9, r.y + r.h - 3.8); })();
I.ma2_cmdwing = rect(2.5, 6, 19, 12, { rx: 1.2 }) + encoders(4, 8, 4, 1.8) + trackball(18.6, 8.6, 0.9) +
  faders(3.8, 10.4, 6, 1.35, 5.8) + keys(12.6, 7.4, 3, 5, 1.3, 1.25) + digit(2, 18, 14.3);
I.ma2_faderwing = rect(1.5, 5, 21, 14, { rx: 1.2 }) + faders(3, 6.4, 15, 1.28, 4.6) + faders(3, 12.4, 15, 1.28, 4.6);
I.ma_npu = (() => { const r = rack(1); return r.s + display(3.4, r.y + 1, 3.6, 1.6) + keys(3.5, r.y + r.h - 1.6, 3, 1, 1.1, 1, 0.7) + vents(9, r.y + 1.2, 8.2, 5, 0.75) + led(19, 12) + led(20.2, 12, 0.5); })();
I.ma_vpu = (() => { const r = rack(2); let s = r.s + display(3.4, r.y + 1, 3.6, 1.6) + vents(3.4, r.y + 3.6, 3.6, 4, 0.8); [9.6, 13.2, 16.8].forEach((x) => (s += rect(x, 10.3, 2.6, 1.4, { rx: 0.2, sw: 0.5 }) + rect(x, 12.6, 2.6, 1.4, { rx: 0.2, sw: 0.5 }))); return s + led(20.4, r.y + 1.2); })();
I.ma_nsp = (() => { const r = rack(1); let s = r.s + display(3.4, r.y + 1, 3.6, 1.6) + keys(3.5, r.y + r.h - 1.6, 3, 1, 1.1, 1, 0.7); [11.4, 14.2, 17, 19.8].forEach((x) => (s += xlr(x, 12, 1))); return s + ethercon(8.6, 12); })();

/* grandMA (1): Bildschirme in einem erhöhten Aufbau hinten, darunter die
   durchgehende Executor-Reihe, Trackball rechts */
I.ma1 = path_("M1 20.5V8.4Q1 6.2 3.2 6.2H20.8Q23 6.2 23 8.4V20.5Z", 1.2) +
  rect(3, 2.8, 18, 6.2, { rx: 0.8, sw: 1 }) + screen(4, 3.8, 6.8, 4.2) + screen(13.2, 3.8, 6.8, 4.2) +
  keys(3, 10.4, 12, 1, 1.25, 1, 0.6, 0.6) + trackball(19.6, 11.4, 1) +
  faders(3.4, 12.4, 10, 1.15, 5.8) + keys(15.6, 13.4, 3, 3, 1.3, 1.3) + digit(1, 19.8, 16.4);

/* dot2 */
I.dot2_core = rect(2.5, 5, 19, 14, { rx: 1.2 }) + screen(11.6, 6, 8.4, 5) + encoders(12.6, 13, 4, 1.9) +
  faders(4, 6.6, 6, 1.3, 10.6) + keys(11.8, 15, 7, 2, 1.2, 1.3) + dot(4.2, 17.8, 0.55);
I.dot2_wing = rect(1.5, 6, 21, 12, { rx: 1.1 }) + faders(3, 7.6, 10, 1.3, 7.2) + keys(16.2, 7.6, 4, 5, 1.3, 1.3) + keys(3, 16.2, 10, 1, 1.3, 1, 0.55, 0.5) + dot(20.8, 16.6, 0.55);
I.dot2_node4 = box(3.5, 6.5, 17, 11) + display(5, 8, 4.4, 1.8) + xlr(12.6, 10.4, 1.3) + xlr(16.8, 10.4, 1.3) + xlr(12.6, 14.6, 1.3) + xlr(16.8, 14.6, 1.3) + ethercon(6.2, 14.4) + dot(8.6, 14.4, 0.55);

/* Luminex GigaCore: Ports mit Gruppen-LED darüber, SFP-Schächte rechts */
const gcPorts = (x, y, n, pitch, withLed = true) => {
  let s = "";
  for (let i = 0; i < n; i++) s += rj45(x + i * pitch, y) + (withLed ? led(x + i * pitch + 0.6, y - 0.8, i % 3 === 0 ? 1 : 0.55) : "");
  return s;
};
I.gc10 = (() => { const r = rack(1, { half: true }); return r.s + gcPorts(6.2, 12, 8, 1.35) + sfp(17.2, 10.6, 1.4, 0.8) + sfp(17.2, 12.6, 1.4, 0.8) + display(6.2, 9.8, 2.4, 0.9); })();
I.gc16 = (() => { const r = rack(1); return r.s + display(3.4, r.y + 1, 2.8, 1.4) + led(4, r.y + r.h - 1.1) + gcPorts(7.2, 12, 12, 0.98) + sfp(19.2, 10.4, 1.6, 0.8) + sfp(19.2, 12.8, 1.6, 0.8); })();
I.gc18 = (() => { // Touring-Gehäuse mit etherCON und Griffen
  let s = rect(3, 6.5, 18, 11, { rx: 0.9 }) + path_("M2.8 8.5H1.4V15.5H2.8", 0.9) + path_("M21.2 8.5H22.6V15.5H21.2", 0.9) + display(4.4, 7.7, 2.8, 1.2);
  [5.6, 8.1, 10.6, 13.1, 15.6].forEach((x) => (s += ethercon(x, 12, 0.85) + ethercon(x, 14.9, 0.85)));
  return s + sfp(17.8, 11.4, 1.8, 0.8) + sfp(17.8, 14.3, 1.8, 0.8) + led(9, 8.3) + led(10.4, 8.3, 0.5) + led(11.8, 8.3, 0.5);
})();
I.gc30 = (() => { const r = rack(1); let s = r.s + display(3.4, r.y + 1, 2.4, 1.3); for (let i = 0; i < 12; i++) s += rj45(6.6 + i * 1.02, 10.3, 0.8, 0.8) + rj45(6.6 + i * 1.02, 12.9, 0.8, 0.8); return s + sfp(19.2, 10.2, 1.5, 0.7) + sfp(19.2, 11.7, 1.5, 0.7) + sfp(19.2, 13.2, 1.5, 0.7) + led(4, r.y + r.h - 1.1); })();

/* LumiNode: Display mit Drehgeber, Zahl der DMX-Buchsen wie am Gerät */
const lumiNode = (n) => {
  const w = n === 1 ? 11 : n === 2 ? 14 : 18;
  const x = 12 - w / 2;
  let s = box(x, 7, w, 10) + display(x + 1.2, 8.3, 3.4, 1.5) + ring(x + 6.2, 9, 0.8, 0.6) + dot(x + 6.2, 9, 0.25) + ethercon(x + 2.4, 14.2);
  const xs = n === 1 ? [x + 7.6] : n === 2 ? [x + 7, x + 10.8] : [x + 6.8, x + 9.6, x + 12.4, x + 15.2];
  xs.forEach((cx) => (s += xlr(cx, 14.2, n === 4 ? 1.1 : 1.3)));
  return s;
};
I.luminode1 = lumiNode(1);
I.luminode2 = lumiNode(2);
I.luminode4 = lumiNode(4);
I.luminode12 = (() => { const r = rack(2); let s = r.s + display(3.4, r.y + 1, 3.4, 1.5) + ring(4.3, 13.6, 0.8, 0.6) + dot(4.3, 13.6, 0.25); for (let i = 0; i < 6; i++) s += xlr(8.8 + i * 2.2, 10.2, 0.85) + xlr(8.8 + i * 2.2, 13.8, 0.85); return s; })();
I.lumicore = (() => { const r = rack(1); return r.s + display(3.4, r.y + 1, 5, 1.8) + ring(10.6, 12, 0.9, 0.6) + dot(10.6, 12, 0.25) + ethercon(15.4, 12) + ethercon(18.2, 12) + led(4, r.y + r.h - 1.1) + led(5.2, r.y + r.h - 1.1, 0.5); })();
I.lumisplit = (() => { const r = rack(1); let s = r.s + xlr(4.4, 12, 1) + xlr(6.8, 12, 1) + line(8.4, 10, 8.4, 14, 0.5, 0.6); for (let i = 0; i < 5; i++) s += xlr(10 + i * 2.35, 12, 0.95); return s; })();

/* Cisco: Frontansicht, Portdichte wie am Gerät, Uplinks rechts */
const ciscoRows = (x, y, cols, pitch, rows = 2, w = 0.8, gap = 0) => {
  let s = "";
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) s += rj45(x + c * pitch + (gap && c >= cols / 2 ? gap : 0), y + r * 1.9, w, 0.9);
  return s;
};
I.cisco_8 = rect(3.5, 8.5, 17, 7, { rx: 0.8 }) + led(5, 10.2) + led(5, 11.6, 0.5) + ciscoRows(6.8, 11.6, 8, 1.3, 1, 1) + sfp(17.6, 10.4, 1.6, 0.8) + sfp(17.6, 12.4, 1.6, 0.8) + line(5, 13.8, 7.4, 13.8, 0.5, 0.6);
I.cisco_16 = (() => { const r = rack(1); return r.s + led(3.6, 10.6) + led(3.6, 12, 0.5) + ciscoRows(5.6, 10.4, 8, 1.35, 2, 1) + sfp(18.2, 10.4, 1.8, 0.8) + sfp(18.2, 12.3, 1.8, 0.8); })();
I.cisco_24 = (() => { const r = rack(1); return r.s + led(3.6, 10.6) + led(3.6, 12, 0.5) + ciscoRows(5.3, 10.4, 12, 0.98, 2, 0.8, 0.6) + sfp(18.6, 10.4, 1.4, 0.7) + sfp(18.6, 12.3, 1.4, 0.7) + sfp(20.1, 10.4, 1.2, 0.7) + sfp(20.1, 12.3, 1.2, 0.7); })();
I.cisco_48 = (() => { const r = rack(1); return r.s + led(3.6, 10.6) + led(3.6, 12, 0.5) + ciscoRows(5, 10.4, 20, 0.66, 2, 0.5, 0.5) + sfp(19.1, 10.4, 1.1, 0.7) + sfp(19.1, 12.3, 1.1, 0.7) + sfp(20.4, 10.4, 1, 0.7) + sfp(20.4, 12.3, 1, 0.7); })();
// Catalyst 1300 24P-4X: 24 PoE+-Ports in zwei Reihen, PoE-Blitz, vier SFP+-Käfige (10G) als 2×2-Block
I.cisco_c1300_24p4x = (() => {
  const r = rack(1);
  return r.s + led(3.6, 10.1) + led(3.6, 11.3, 0.5) + path_("M4.1 12.3L3.3 13.8H4.2L3.6 15.3", 0.5) +
    ciscoRows(5.4, 10.4, 12, 0.92, 2, 0.72, 0.5) +
    rect(17.2, 9.9, 4, 4.3, { rx: 0.2, sw: 0.5 }) + sfp(17.6, 10.5, 1.4, 1.2) + sfp(19.4, 10.5, 1.4, 1.2) + sfp(17.6, 12.4, 1.4, 1.2) + sfp(19.4, 12.4, 1.4, 1.2);
})();
// Catalyst 9000: Ports links, Netzwerkmodul-Schacht rechts, Blau-Beacon oben links
I.cisco_9k = (() => { const r = rack(1); return r.s + ring(3.8, 10.6, 0.5, 0.5, 0.8) + led(3.8, 12.6, 0.5) + ciscoRows(5.3, 10.4, 16, 0.7, 2, 0.5, 0.4) + rect(17.4, 9.8, 3.6, 4.4, { rx: 0.2, sw: 0.6 }) + sfp(17.9, 10.6, 1.2, 0.7) + sfp(19.4, 10.6, 1.2, 0.7) + sfp(17.9, 12.4, 1.2, 0.7) + sfp(19.4, 12.4, 1.2, 0.7); })();
// Meraki MS: glatte Front, große Status-LED
I.cisco_meraki = (() => { const r = rack(1); return r.s + ring(4.2, 12, 1, 0.6, 0.35) + ciscoRows(6.6, 10.4, 12, 0.95, 2, 0.75, 0.5) + sfp(19, 10.4, 1.8, 0.7) + sfp(19, 12.3, 1.8, 0.7); })();
// IE3300: Industrie-Switch für Hutschiene, hochkant
I.cisco_ie = rect(7, 2.5, 10, 19, { rx: 0.8 }) + line(5.5, 8, 7, 8, 1) + line(17, 8, 18.5, 8, 1) + line(5.5, 16, 7, 16, 1) + line(17, 16, 18.5, 16, 1) +
  vents(8.4, 4, 7.2, 3, 0.8) + ciscoRows(8.6, 8.4, 4, 1.8, 2, 1.3) + sfp(8.6, 13.8, 2.2, 1) + sfp(12.6, 13.8, 2.2, 1) + led(9, 17.2) + led(10.4, 17.2, 0.5) + led(11.8, 17.2, 0.5) + rect(8.6, 18.6, 6.8, 1.4, { rx: 0.2, sw: 0.5 });
// Access Point (Catalyst 9120 / Meraki MR): flache runde Scheibe mit LED
I.cisco_ap = rect(3, 4, 18, 16, { rx: 5 }) + rect(5, 6, 14, 12, { rx: 3.6, sw: 0.5 }) + dot(12, 12, 0.7) +
  path_("M8.6 9.2Q12 6.6 15.4 9.2", 0.6) + path_("M10 10.6Q12 9.2 14 10.6", 0.6);

/* Yamaha: Pulte von oben. Merkmal CL/QL: Centralogic-Bildschirm mittig,
   Selected-Channel-Regler links daneben */
const yamKnobs = (x, y, cols, rows, pitch = 1.3) => { let s = ""; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) s += ring(x + c * pitch, y + r * pitch, 0.42, 0.5); return s; };
I.yam_cl = rect(0.8, 4, 22.4, 16, { rx: 0.8 }) + yamKnobs(2.2, 5.4, 6, 3) + screen(10.2, 5, 7.2, 4.6) + yamKnobs(18.6, 5.4, 3, 3) +
  faders(2.2, 12.2, 8, 1.05, 6.6) + faders(11.4, 12.2, 8, 1.05, 6.6) + line(10.3, 11.6, 10.3, 19.2, 0.4, 0.5) + faders(20.6, 12.2, 2, 1.1, 6.6);
I.yam_ql = rect(2.5, 4, 19, 16, { rx: 0.8 }) + yamKnobs(3.8, 5.4, 4, 3) + screen(9.6, 5, 7, 4.6) + yamKnobs(17.8, 5.4, 2, 3) +
  faders(3.8, 12.2, 8, 1.1, 6.6) + faders(13.6, 12.2, 5, 1.1, 6.6) + line(12.7, 11.6, 12.7, 19.2, 0.4, 0.5);
I.yam_rivage = rect(0.6, 3.5, 22.8, 17, { rx: 0.8 }) + screen(1.6, 4.4, 6.6, 4.6) + screen(8.7, 4.4, 6.6, 4.6) + screen(15.8, 4.4, 6.6, 4.6) +
  yamKnobs(2.4, 10.6, 16, 1, 1.28) + faders(2.2, 12.6, 7, 0.95, 6.4) + faders(9.3, 12.6, 6, 0.95, 6.4) + faders(15.6, 12.6, 7, 0.95, 6.4);
I.yam_dm7 = rect(1.2, 4, 21.6, 16, { rx: 0.8 }) + screen(2.2, 4.9, 9, 5.6) + screen(12.8, 4.9, 9, 5.6) + yamKnobs(3, 11.6, 14, 1, 1.3) +
  faders(2.8, 13.2, 12, 1.05, 6) + faders(16.4, 13.2, 5, 1.05, 6);
I.yam_dm3 = rect(3.5, 4.5, 17, 15, { rx: 0.8 }) + screen(11.2, 5.5, 8.2, 5.6) + yamKnobs(4.8, 5.8, 4, 2, 1.5) +
  faders(4.8, 10, 9, 0.95, 8.4) + keys(11.4, 12.6, 6, 2, 1.3, 1.3) + ring(17.6, 16.8, 1.1, 0.7);
I.yam_tf = rect(2, 4, 20, 16, { rx: 0.8 }) + screen(6.4, 5, 10, 5) + ring(19, 7.4, 1.3, 0.8) + dot(19, 7.4, 0.35) + keys(3, 5.4, 2, 4, 1.3, 1.2) +
  faders(3.4, 12, 12, 1.1, 7) + faders(18, 12, 2, 1.2, 7);
I.yam_rio = (() => { const r = rack(4); let s = r.s; for (let row = 0; row < 3; row++) for (let c = 0; c < 8; c++) s += xlr(3.8 + c * 1.9, r.y + 1.9 + row * 2.6, 0.75); return s + display(19, r.y + 1.2, 2, 1.2) + led(19.5, r.y + 3.4) + led(20.5, r.y + 3.4, 0.5) + ethercon(19.9, r.y + r.h - 3.6, 0.85) + ethercon(19.9, r.y + r.h - 1.6, 0.85); })();
I.yam_ri8 = (() => { const r = rack(1, { half: true }); let s = r.s; for (let c = 0; c < 8; c++) s += xlr(6.4 + c * 1.45, 12, 0.6); return s + led(18, 11); })();
I.yam_tio = (() => { const r = rack(1); let s = r.s; for (let c = 0; c < 8; c++) s += xlr(3.8 + c * 1.55, 10.8, 0.62) + xlr(3.8 + c * 1.55, 13.2, 0.62); for (let c = 0; c < 4; c++) s += xlr(16.4 + c * 1.35, 12, 0.55); return s; })();
I.yam_ruio = rect(4, 6, 16, 12, { rx: 2 }) + ring(12, 11.4, 3, 1) + ring(12, 11.4, 1.6, 0.5) + dot(12, 9.2, 0.35) + keys(5.6, 15, 6, 1, 1.4, 1, 0.7) + led(18, 15.3);
I.yam_amp = (() => { const r = rack(2); let s = r.s + vents(3.4, r.y + 1.2, 6.6, 8, 0.72); for (let c = 0; c < 4; c++) s += led(12 + c * 2.1, 10.4) + led(12 + c * 2.1, 12, 0.6) + led(12 + c * 2.1, 13.6, 0.35); return s + ring(20.4, 12, 0.7, 0.6); })();
I.yam_dsp = (() => { const r = rack(1); let s = r.s + display(3.4, r.y + 1, 4.4, 1.8) + ring(9.6, 12, 0.8, 0.6); for (let c = 0; c < 8; c++) s += led(12 + c * 1.15, 11.2) + led(12 + c * 1.15, 12.8, 0.45); return s; })();
// SWP1/SWP2: Dante-Switch mit Voreinstellungs-Drehschalter (DIP) links
I.yam_swp = (() => { const r = rack(1); let s = r.s + ring(4.2, 12, 1, 0.6) + line(4.2, 12, 4.2, 11.1, 0.6) + keys(6.2, 10.6, 2, 2, 0.9, 1.6, 0.6, 0.8); for (let c = 0; c < 8; c++) s += rj45(8.8 + c * 1.18, 11.5, 0.95, 0.9) + led(9.25 + c * 1.18, 10.5, c % 2 ? 0.5 : 1); return s; })();
I.yam_switch = rect(3.5, 8.5, 17, 7, { rx: 0.8 }) + vents(5, 10, 2.6, 5, 0.9) + ciscoRows(9, 11.6, 8, 1.2, 1, 0.95) + led(9.45, 10.5) + led(10.65, 10.5, 0.5) + led(11.85, 10.5);

/* Schnick-Schnack-Systems */
I.sss_dpb = box(3, 7, 18, 10) + ethercon(5.8, 12) + ethercon(8.8, 12) + line(10.8, 9, 10.8, 15, 0.5, 0.6) +
  [12.6, 15.1, 17.6].map((x) => ring(x, 10.3, 0.8, 0.6) + ring(x, 13.7, 0.8, 0.6)).join("") + led(19.6, 8.6) + led(19.6, 10, 0.5);
I.sss_pixelgate = box(3, 7, 18, 10) + rect(4.6, 9, 4, 1.8, { rx: 0.3, sw: 0.6 }) + path_("M4.9 13.4H8.3L7.8 14.8H5.4Z", 0.6) + ethercon(11.4, 12) + ethercon(14.2, 12) +
  display(16.2, 8.6, 3.4, 1.4) + led(17, 14.4) + led(18.4, 14.4, 0.5);
I.sss_netzteil = (() => { const r = rack(1); let s = r.s + ring(4, 12, 1.1, 0.6) + line(3.5, 12, 4.5, 12, 0.5) + ethercon(7.2, 12); for (let c = 0; c < 4; c++) s += rect(9.6 + c * 3, 10.8, 2.3, 2.4, { rx: 0.3, sw: 0.6 }) + keys(10.05 + c * 3, 11.6, 3, 1, 0.55, 1, 0.3, 0.9); return s; })();
I.sss_sysone = box(5, 6, 14, 12) + display(6.6, 7.6, 5, 2) + ring(15.4, 8.6, 1.1, 0.6) + ethercon(8, 14.4) + rect(11.2, 13.4, 2.6, 2, { rx: 0.3, sw: 0.6 }) + rect(14.6, 13.4, 2.6, 2, { rx: 0.3, sw: 0.6 });
I.sss_tile = (() => { let s = rect(4, 4, 16, 16, { rx: 0.5 }); for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) s += dot(6 + c * 3, 6 + r * 3, 0.75, (r + c) % 3 ? 0.55 : 1); return s; })();
I.sss_strip = rect(1.5, 10, 21, 4, { rx: 1 }) + Array.from({ length: 8 }, (_, i) => dot(3.6 + i * 2.4, 12, 0.7, i % 2 ? 0.55 : 1)).join("") + path_("M1.5 12H0.6", 0.8);

/* Audinate / Dante */
const avioStecker = () => rect(1.5, 9.6, 4.2, 4.8, { rx: 0.4, sw: 1 }) + keys(2.2, 10.4, 4, 1, 0.8, 1, 0.4, 0.9) + line(3.6, 14.4, 3.6, 15.2, 0.8) +
  rect(5.7, 10.2, 5.6, 3.6, { rx: 1, sw: 1 }) + path_("M11.3 12H14", 1.2);
I.dante_avio_xlr = avioStecker() + path_("M14 9.4H18.4Q21.6 9.4 21.6 12Q21.6 14.6 18.4 14.6H14Z", 1.1) + dot(17.2, 11.2, 0.35) + dot(19.2, 11.2, 0.35) + dot(18.2, 13, 0.35) + led(7.2, 11.2);
I.dante_avio_usb = avioStecker() + rect(14, 10.2, 5, 3.6, { rx: 0.8, sw: 1 }) + rect(19, 10.8, 3, 2.4, { rx: 0.3, sw: 0.8 }) + led(7.2, 11.2);
I.dante_avio_bt = avioStecker() + rect(14, 9.4, 7, 5.2, { rx: 1.4, sw: 1 }) + path_("M16.4 10.6L19 13.2L17.5 14.2V9.8L19 10.8L16.4 13.4", 0.6) + led(7.2, 11.2);
// Einsteckkarte (Dante-MY16, HY144-D, NY64-D, AIC128-D …)
I.dante_karte = rect(2, 5, 17, 12, { rx: 0.6 }) + rect(19, 5, 2.4, 14.5, { rx: 0.3, sw: 0.8 }) + keys(3.4, 17.6, 11, 1, 1.35, 1, 0.8, 0.9).replace(/height="0.8"/g, 'height="1.6"') +
  rect(4, 7, 5.6, 5.6, { rx: 0.4, sw: 0.8, fill: 0.3 }) + ethercon(20.2, 8.4, 0.6) + ethercon(20.2, 11.4, 0.6) + keys(11.4, 7.4, 3, 2, 1.8, 1.8, 1, 0.5);
// OEM-Modul (Brooklyn, Broadway, Ultimo)
I.dante_modul = rect(5.5, 5.5, 13, 13, { rx: 0.8 }) + rect(8.5, 8.5, 7, 7, { rx: 0.4, sw: 0.8, fill: 0.35 }) +
  [0, 1, 2, 3, 4].map((i) => line(7.4 + i * 2.3, 3, 7.4 + i * 2.3, 5.5, 0.8) + line(7.4 + i * 2.3, 18.5, 7.4 + i * 2.3, 21, 0.8) + line(3, 7.4 + i * 2.3, 5.5, 7.4 + i * 2.3, 0.8) + line(18.5, 7.4 + i * 2.3, 21, 7.4 + i * 2.3, 0.8)).join("");

/* ── Aussteller der LEaT con 26 ─────────────────────────────────────────────
   Gleiche Bauweise wie oben: Pulte von oben, Rack- und Tischgeräte von vorne.
   Merkmale aus Form und Bedienelementen, keine Logos. */

// Generische Bauteile für die neuen Hersteller
const pultOben = (w, h, inner) => rect(12 - w / 2, 12 - h / 2, w, h, { rx: 1 }) + inner;
const xlrReihe = (x, y, n, pitch, r = 0.7) => Array.from({ length: n }, (_, i) => xlr(x + i * pitch, y, r)).join("");
const ethReihe = (x, y, n, pitch, r = 0.85) => Array.from({ length: n }, (_, i) => ethercon(x + i * pitch, y, r)).join("");
const rjReihe = (x, y, n, pitch, w = 1, h = 0.9) => Array.from({ length: n }, (_, i) => rj45(x + i * pitch, y, w, h)).join("");
// PTZ-Kamera: Sockel, Kopf mit Objektiv
const ptz = (breit = false) => rect(6, 17, 12, 4, { rx: 1 }) + path_("M9 17V14.5H15V17", 0.9) +
  rect(breit ? 4.5 : 5.5, 4.5, breit ? 15 : 13, 9.5, { rx: 4.2 }) + ring(12, 9.2, breit ? 3.2 : 2.8, 1, 0.25) + ring(12, 9.2, 1.2, 0.6) + led(breit ? 17.4 : 16.6, 6.6);
// Kleiner AV-over-IP-Encoder/Decoder: flache Box, HDMI + RJ45
const avBox = (label) => box(3, 8, 18, 8) + rect(4.6, 11.1, 3.2, 1.6, { rx: 0.3, sw: 0.6 }) + rj45(9.2, 11.2, 1.4, 1.2) + rj45(11.2, 11.2, 1.4, 1.2) +
  led(15, 10) + led(16.2, 10, 0.5) + (label === "sfp" ? sfp(14.6, 12.2, 2.6, 1) : display(14.4, 12, 3.6, 1.4));
// Endstufe mit Display und Kanal-LEDs (2 HE)
const amp2 = (kanaele, eth = 2) => { const r = rack(2); let s = r.s + display(3.4, r.y + 1.2, 4.4, 2) + vents(3.4, r.y + 4.2, 4.4, 4, 0.8);
  for (let c = 0; c < kanaele; c++) s += led(10 + c * (9 / kanaele), 10.6) + line(10 + c * (9 / kanaele), 11.8, 10 + c * (9 / kanaele), 13.8, 0.6, 0.6);
  return s + ethReihe(20.2, 10.6, 1, 0) + (eth > 1 ? ethercon(20.2, 13.4, 0.85) : ""); };

/* Allen & Heath */
I.ah_sq = pultOben(20, 15, screen(4, 5.4, 6.8, 4.4) + yamKnobs(12.6, 5.6, 6, 2, 1.2) + faders(3.4, 11.4, 12, 1.15, 6.4) + keys(18, 11.6, 2, 4, 1.2, 1.5));
I.ah_avantis = pultOben(21, 15.6, screen(2.6, 5, 9, 5.4) + yamKnobs(13.6, 5.4, 6, 3, 1.2) + faders(3, 12.2, 12, 1.15, 6) + faders(17.6, 12.2, 3, 1.25, 6));
I.ah_mixrack = (() => { const r = rack(3); let s = r.s + display(3.4, r.y + 1.2, 3.6, 1.6); s += xlrReihe(9, r.y + 2.2, 8, 1.5, 0.6) + xlrReihe(9, r.y + 4.6, 8, 1.5, 0.6);
  return s + rect(3.4, r.y + 4.2, 3.6, 4.2, { rx: 0.3, sw: 0.5 }) + ethercon(5.2, r.y + 6.3, 0.75) + vents(9, r.y + 7.2, 11, 2, 0.8); })();
I.ah_ahm = (() => { const r = rack(1); return r.s + display(3.4, r.y + 1, 3.6, 1.6) + led(8.6, 11.2) + led(8.6, 12.8, 0.5) + vents(10.4, r.y + 1.2, 6, 5, 0.75) + ethercon(18.4, 12, 0.85) + ethercon(20.4, 12, 0.85); })();
I.ah_expander = (() => { const r = rack(1); return r.s + xlrReihe(4, 11, 8, 1.55, 0.6) + xlrReihe(4, 13.2, 8, 1.55, 0.6) + rj45(17.4, 11.4, 1.2, 1) + rj45(19.2, 11.4, 1.2, 1) + led(18, 13.6); })();
I.ah_ip = box(4.5, 3, 15, 18) + Array.from({ length: 8 }, (_, i) => ring(7.5 + (i % 4) * 3, 7 + Math.floor(i / 4) * 3.6, 1.1, 0.7)).join("") + keys(6.6, 14.2, 4, 2, 3, 2.2, 1.6, 0.55) + led(12, 4.6);

/* Avid VENUE */
I.avid_s6l = pultOben(22, 16, screen(1.8, 4.6, 6, 4) + screen(9, 4.6, 6, 4) + screen(16.2, 4.6, 6, 4) +
  yamKnobs(2.4, 10, 15, 1, 1.32) + faders(2.2, 11.8, 8, 1.05, 6) + faders(13.6, 11.8, 8, 1.05, 6) + rect(11.1, 11.8, 1.8, 6, { rx: 0.3, sw: 0.5 }));
I.avid_engine = (() => { const r = rack(4); return r.s + display(3.4, r.y + 1.2, 4, 1.8) + vents(9, r.y + 1.4, 11.6, 4, 0.9) +
  [0, 1, 2].map((i) => rect(9 + i * 4, r.y + 6.4, 3.4, 4.4, { rx: 0.3, sw: 0.5 })).join("") + led(4, r.y + r.h - 1.6) + led(5.4, r.y + r.h - 1.6, 0.5); })();
I.avid_stage = (() => { const r = rack(4); let s = r.s; for (let row = 0; row < 4; row++) s += xlrReihe(3.8, r.y + 1.7 + row * 2.4, 7, 1.85, 0.7); return s + ethercon(19.6, r.y + 2.4) + ethercon(19.6, r.y + 5.2) + display(18.4, r.y + r.h - 3, 2.6, 1.2); })();

/* AlphaTheta (Pioneer DJ) */
I.at_cdj = rect(4, 2, 16, 20, { rx: 1.2 }) + screen(5.6, 3.4, 12.8, 5.6) + ring(12, 15, 4.4, 1, 0.12) + ring(12, 15, 2.6, 0.6) + dot(12, 15, 0.5) +
  solid(5.4, 19.6, 2.2, 1.2, 0.7) + solid(8.2, 19.6, 2.2, 1.2, 0.7) + line(18.6, 11.4, 18.6, 19.6, 0.5, 0.6) + solid(18.1, 15.4, 1, 0.8);
I.at_djm = rect(5, 2, 14, 20, { rx: 1.2 }) + display(9.6, 3.4, 4.8, 2) + yamKnobs(7.4, 6.8, 4, 4, 3) + faders(7.4, 16.4, 4, 3, 3.4, 0.6) + line(9.5, 20.6, 14.5, 20.6, 0.7);
I.at_xdj = rect(0.8, 4, 22.4, 16, { rx: 1.2 }) + screen(8.2, 5, 7.6, 4.6) + ring(4.6, 14.4, 3, 0.9, 0.12) + ring(19.4, 14.4, 3, 0.9, 0.12) +
  faders(9.8, 11.4, 4, 1.45, 5, 0.6) + line(9.6, 18.6, 14.4, 18.6, 0.7) + dot(4.6, 14.4, 0.45) + dot(19.4, 14.4, 0.45);

/* Biamp Tesira */
I.biamp_tesira = (() => { const r = rack(1); let s = r.s + display(3.4, r.y + 1, 4.6, 1.8); for (let c = 0; c < 12; c++) s += led(10 + c * 0.9, 11.2, c % 3 ? 0.5 : 1) + led(10 + c * 0.9, 12.8, 0.35); return s + ring(21, 12, 0.6, 0.6); })();

/* Brompton Tessera */
I.brompton_proc = (() => { const r = rack(1); return r.s + display(3.4, r.y + 1, 5, 2) + ring(10.2, 12, 0.9, 0.6) + keys(12, 11.2, 4, 2, 1.1, 1, 0.7) + ethReihe(17.2, 12, 3, 1.75, 0.7); })();
I.brompton_xd = (() => { const r = rack(1); return r.s + display(3.4, r.y + 1, 3, 1.5) + ethReihe(8.6, 12, 7, 1.7, 0.7) + sfp(20, 11.2, 1.4, 0.7) + sfp(20, 12.4, 1.4, 0.7); })();

/* Barco Event Master */
I.barco_s3 = (() => { const r = rack(2); let s = r.s + display(3.4, r.y + 1.2, 5.4, 3) + keys(3.6, r.y + 5.2, 4, 1, 1.3, 1, 0.8); for (let c = 0; c < 6; c++) s += rect(10.2 + c * 1.75, r.y + 2, 1.3, 4.6, { rx: 0.2, sw: 0.45 }); return s; })();
I.barco_ec = pultOben(20, 14, screen(3.6, 6, 8, 4.4) + keys(13, 6.2, 5, 3, 1.3, 1.4) + keys(3.6, 12.2, 8, 2, 1.2, 1.4) + faders(16, 11.6, 1, 1, 5.6, 0.8) + ring(18.6, 15.4, 1.4, 0.7));

/* AV Stumpfl PIXERA */
I.pixera = (() => { const r = rack(2); return r.s + rect(3.4, r.y + 1.1, 7, r.h - 2.2, { rx: 0.4, sw: 0.6, fill: 0.15 }) + led(4.4, r.y + 2) + vents(12, r.y + 1.6, 8.6, 6, 0.95) + display(17, r.y + r.h - 2.6, 3.4, 1.3); })();

/* PTZ-Kameras */
I.canon_ptz = ptz(true);
I.aver_ptz = ptz(false);

/* Vizrt TriCaster */
I.tricaster = pultOben(22, 14, keys(2.6, 6.4, 12, 3, 1.25, 1.5, 0.8) + faders(18.2, 6, 1, 1, 8, 0.9) + ring(20.6, 8.4, 1.2, 0.7) + keys(2.6, 12, 8, 2, 1.25, 1.5, 0.6, 0.5) + display(13.4, 11.8, 3.4, 1.6));

/* AV over IP / KVM */
I.crestron_nvx = avBox("display");
I.blustream_ip = avBox("rj");
I.adder_alif = box(3, 7.5, 18, 9) + rect(4.4, 10.6, 3.2, 1.6, { rx: 0.3, sw: 0.6 }) + rect(8.4, 10.6, 2, 1.4, { rx: 0.3, sw: 0.5 }) + rect(8.4, 12.6, 2, 1.4, { rx: 0.3, sw: 0.5 }) + rj45(12, 11.2, 1.4, 1.2) + sfp(14.6, 11.4, 2.6, 1) + led(19, 10) + led(19, 11.6, 0.5);

/* DIGITUS Switches */
I.digitus_24 = (() => { const r = rack(1); return r.s + led(3.6, 10.8) + led(3.6, 12.6, 0.5) + ciscoRows(5.6, 10.4, 12, 1, 2, 0.8) + sfp(18.4, 10.4, 1.4, 0.7) + sfp(18.4, 12.3, 1.4, 0.7) + sfp(20, 10.4, 1.2, 0.7) + sfp(20, 12.3, 1.2, 0.7); })();

/* Avolites */
I.avo_diamond = pultOben(22.4, 17, screen(1.8, 4.4, 6.4, 4.4) + screen(8.8, 4.4, 6.4, 4.4) + screen(15.8, 4.4, 6.4, 4.4) + trackball(12, 11.6, 0.9) +
  encoders(3, 10.8, 4, 1.6) + encoders(16, 10.8, 4, 1.6) + faders(2.4, 13.4, 7, 1.1, 5.6) + faders(14.4, 13.4, 7, 1.1, 5.6));
I.avo_sapphire = pultOben(22, 16, screen(2, 4.6, 8.8, 5.2) + screen(13.2, 4.6, 8.8, 5.2) + trackball(12, 7.2, 0.8) + faders(2.4, 11.6, 15, 1.27, 6.4));
I.avo_tnp = (() => { const r = rack(1); return r.s + display(3.4, r.y + 1, 4, 1.7) + keys(8.6, 11.2, 3, 2, 1.1, 1.1, 0.7) + vents(12.6, r.y + 1.2, 3.6, 5, 0.75) + ethercon(17.6, 12, 0.85) + ethercon(19.8, 12, 0.85); })();

/* ADJ NET-Nodes */
I.adj_net = (() => { const r = rack(1); return r.s + display(3.4, r.y + 1, 3.4, 1.5) + rj45(8, 11.4, 1.3, 1.1) + rj45(9.8, 11.4, 1.3, 1.1) + xlrReihe(12.8, 12, 4, 2.1, 0.85); })();

/* Astera NetBox */
I.astera_netbox = box(4.5, 6, 15, 12) + rect(4.5, 6, 15, 3, { rx: 1, sw: 0.6, fill: 0.2 }) + rj45(6.4, 11, 1.4, 1.2) + rj45(8.4, 11, 1.4, 1.2) + rj45(10.4, 11, 1.4, 1.2) + rj45(12.4, 11, 1.4, 1.2) + xlr(16.4, 12.2, 1.2) + led(6.8, 15.6) + led(8.2, 15.6, 0.5);

/* Bose PowerShare / ControlSpace */
I.bose_amp = (() => { const r = rack(1); let s = r.s + vents(3.4, r.y + 1.2, 6, 5, 0.75); for (let c = 0; c < 4; c++) s += led(11 + c * 1.6, 11.2) + led(11 + c * 1.6, 12.8, 0.5); return s + ring(19.6, 12, 0.9, 0.7); })();

/* d&b audiotechnik */
I.db_amp = amp2(4, 2);
I.db_ds100 = (() => { const r = rack(1); return r.s + display(3.4, r.y + 1, 4, 1.7) + ring(9.4, 12, 0.9, 0.6) + vents(11.2, r.y + 1.2, 5, 5, 0.75) + ethercon(18, 12, 0.85) + ethercon(20.2, 12, 0.85); })();

/* DAD AX-Serie */
I.dad_ax = (() => { const r = rack(2); let s = r.s + display(3.4, r.y + 1.2, 6, 3.2) + ring(4.6, r.y + 6.4, 0.9, 0.6); for (let c = 0; c < 10; c++) s += line(11 + c * 0.9, r.y + 1.6, 11 + c * 0.9, r.y + 5.6, 0.45, 0.6); return s + rj45(11, r.y + 6.4, 1.2, 1) + rj45(12.8, r.y + 6.4, 1.2, 1); })();

/* Chauvet Net-X II */
I.chauvet_netx = (() => { const r = rack(1); return r.s + display(3.4, r.y + 1, 3.6, 1.6) + ethercon(8.8, 12, 0.85) + ethercon(10.9, 12, 0.85) + xlrReihe(13.4, 12, 4, 2, 0.85); })();

/* CODA Audio LINUS */
I.coda_linus = (() => { const r = rack(2); let s = r.s + display(3.4, r.y + 1.2, 6.4, 3.4); for (let c = 0; c < 4; c++) s += ring(12 + c * 2, r.y + 2.6, 0.7, 0.6) + led(12 + c * 2, r.y + 5.2, 0.7); return s + rj45(19.6, r.y + 1.6, 1.2, 1) + rj45(19.6, r.y + 3.4, 1.2, 1) + rj45(19.6, r.y + 5.2, 1.2, 1); })();

/* Colorlight */
I.colorlight_proc = (() => { const r = rack(2); let s = r.s + display(3.4, r.y + 1.2, 5, 2.4) + ring(4.6, r.y + 5.6, 0.9, 0.6); for (let row = 0; row < 2; row++) s += ethReihe(10.4, r.y + 2.6 + row * 3.4, 6, 1.75, 0.7); return s; })();

/* Lautsprecher mit Netzwerkanschluss (Front, ohne Gitter) */
// Line-Array-Element: breites, flaches Gehäuse, zwei Tieftöner und mittiger Hochtonschlitz
const lineArray = () => path_("M1.5 8H22.5L21 16H3Z", 1.2) + ring(6.4, 12, 2.4, 0.8, 0.15) + ring(17.6, 12, 2.4, 0.8, 0.15) + rect(10.6, 9.4, 2.8, 5.2, { rx: 0.3, sw: 0.6, fill: 0.35 });
// Subwoofer: Kiste mit großem Tieftöner und Bassreflex-Schlitz
const subBox = () => rect(3, 3.5, 18, 17, { rx: 1 }) + ring(12, 11, 6, 1, 0.12) + ring(12, 11, 2, 0.6) + line(5, 18.6, 19, 18.6, 1, 0.6);
// Kompakter Installationslautsprecher mit einem Chassis und RJ45 (Smart IP)
const ipSpeaker = () => rect(5.5, 2.5, 13, 19, { rx: 3 }) + ring(12, 13.4, 4, 0.9, 0.15) + ring(12, 6.6, 1.5, 0.7) + rj45(11.2, 18.7, 1.6, 1.1);
I.genelec_ip = ipSpeaker();
I.lautsprecher_array = lineArray();
I.lautsprecher_sub = subBox();

/* DiGiCo */
I.digico_s = pultOben(21, 15, screen(3, 4.8, 8, 5.2) + screen(13, 4.8, 8, 5.2) + yamKnobs(3.4, 11, 12, 1, 1.4) + faders(3.4, 12.8, 12, 1.4, 5.4));
I.digico_q = pultOben(22.4, 16, screen(1.8, 4.4, 13, 6) + screen(16, 4.4, 6.2, 6) + yamKnobs(2.4, 11.6, 15, 1, 1.32) + faders(2.2, 13.2, 16, 1.25, 5.4));
I.digico_rack = (() => { const r = rack(4); let s = r.s + display(3.4, r.y + 1.2, 3.6, 1.6); for (let row = 0; row < 3; row++) s += xlrReihe(9, r.y + 2 + row * 2.8, 7, 1.7, 0.65); return s + rect(3.4, r.y + 4.4, 3.6, 6, { rx: 0.3, sw: 0.5 }) + rj45(4.6, r.y + 5.4, 1.2, 1) + rj45(4.6, r.y + 7.4, 1.2, 1); })();

/* Waves SoundGrid / DiGiGrid */
I.waves_server = (() => { const r = rack(1); return r.s + led(3.6, 11.2) + led(3.6, 12.8, 0.5) + vents(5.4, r.y + 1.2, 10.4, 5, 0.75) + rj45(17.4, 11.4, 1.2, 1) + rj45(19.4, 11.4, 1.2, 1); })();
I.digigrid_io = (() => { const r = rack(1, { half: true }); return r.s + display(6.4, 10.6, 3, 1.4) + xlrReihe(11.2, 11.2, 4, 1.6, 0.6) + xlrReihe(11.2, 13.2, 4, 1.6, 0.6) + rj45(6.6, 12.8, 1.2, 1); })();

/* Green Hippo Hippotizer: Rack-Medienserver mit Bedienfeld */
I.hippotizer = (() => { const r = rack(2); return r.s + display(3.4, r.y + 1.2, 4.6, 2.4) + keys(3.6, r.y + 4.8, 3, 1, 1.4, 1, 0.8) + vents(9.6, r.y + 1.4, 11, 7, 0.95); })();

/* Matrox ConvertIP / Monarch EDGE */
I.matrox_ip = avBox("sfp");

/* DirectOut PRODIGY: Rack mit Modulschächten */
I.directout_prodigy = (() => { const r = rack(2); let s = r.s + display(3.4, r.y + 1.2, 4.8, 2.6) + ring(5.8, r.y + 6, 1, 0.6); for (let c = 0; c < 4; c++) s += rect(10 + c * 2.8, r.y + 1.4, 2.3, r.h - 2.8, { rx: 0.2, sw: 0.45 }); return s; })();

/* Endstufen mit Netzwerk (2 HE, vier Kanäle) */
I.amp_4k = amp2(4, 2);

/* Kleiner Installationsverstärker / DSP (1 HE) */
I.inst_1he = (() => { const r = rack(1); let s = r.s + display(3.4, r.y + 1, 4, 1.7); for (let c = 0; c < 4; c++) s += ring(10 + c * 2, 12, 0.7, 0.6); return s + rj45(18.4, 11.4, 1.2, 1) + led(20.4, 12); })();

/* Wandpanel mit Netzwerkanschluss (Dante-Wandplatte) */
I.wandpanel = rect(6, 3, 12, 18, { rx: 1.4 }) + xlr(12, 8.6, 1.8) + ring(12, 14.2, 1.3, 0.6) + rj45(11.2, 17.6, 1.6, 1.1);

// ── Schreiben ──────────────────────────────────────────────────────────────
const HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">';
if (require.main === module) {
  for (const [name, body] of Object.entries(I)) fs.writeFileSync(path.join(OUT, name + ".svg"), HEAD + body + "</svg>\n");
  console.log(`${Object.keys(I).length} Icons nach ${path.relative(process.cwd(), OUT)} geschrieben`);
}
module.exports = { ICONS: I };
