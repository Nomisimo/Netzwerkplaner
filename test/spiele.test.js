import test from "node:test";
import assert from "node:assert/strict";
import { SPIELE, Bild } from "../src/shared/spiele/index.js";
import { SnakeRunde, TICK_RATES } from "../src/shared/spiele/snake.js";
import { PongRunde, WINNING_SCORE } from "../src/shared/spiele/pong.js";
import { MarioWelt, GROUND_Y, MARIO_SMALL_H } from "../src/shared/spiele/mario/welt.js";
import { genColumn } from "../src/shared/spiele/mario/level.js";
import { schrift } from "../src/shared/spiele/pixel.js";
import ausgabe from "../src/main/spiele/ausgabe.js";

/* ── Leinwand & Schrift ─────────────────────────────────────────────────── */
test("Bild ignoriert Pixel außerhalb wie pygame", () => {
  const b = new Bild();
  b.set(-1, 0, [255, 0, 0]); b.set(48, 0, [255, 0, 0]); b.set(0, 24, [255, 0, 0]);
  assert.ok(b.px.every((v) => v === 0));
  b.set(47, 23, [1, 2, 3]);
  assert.deepEqual(b.get(47, 23), [1, 2, 3]);
});

test("Schriftbreiten wie in den drei Python-Fonts", () => {
  const g = { A: ["X.X"], N: ["X..X"], " ": ["..."] };
  assert.equal(schrift(g).textWidth("AN"), 3 + 1 + 4);                  // Snake: ohne Endabstand
  assert.equal(schrift(g, { endLuecke: true }).textWidth("AN"), 3 + 1 + 4 + 1); // Pong: mit Endabstand
  assert.equal(schrift(g, { fest: 3 }).textWidth("AN"), 7);              // Mario: len*4-1
});

/* ── Alle Spiele laufen ohne Fehler ─────────────────────────────────────── */
test("jedes Spiel übersteht 5000 Bilder mit zufälligen Tasten", () => {
  const codes = ["Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyS", "KeyA", "KeyD", "ShiftLeft", "Digit2", "Escape"];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const s of SPIELE) {
    const g = s.create({});
    const b = new Bild();
    const held = new Set();
    for (let i = 0; i < 5000; i++) {
      if (rnd() < 0.05) { const c = codes[Math.floor(rnd() * codes.length)]; if (c !== "Escape" || rnd() < 0.1) g.key(c); held.add(c); }
      if (rnd() < 0.05) held.clear();
      g.step(held);
      g.render(b);
    }
    assert.ok(b.px.some((v) => v > 0), `${s.id} zeichnet etwas`);
  }
});

/* ── Snake ──────────────────────────────────────────────────────────────── */
test("Snake: Futter lässt wachsen, Wand beendet das Spiel", () => {
  const t = [];
  const r = new SnakeRunde((n) => t.push(n), () => 0.5);
  const [hx, hy] = r.head;
  r.food = [hx + 1, hy];
  r.tick();
  assert.equal(r.score, 10);
  assert.equal(r.growth, 2);
  assert.equal(r.body.length, 4);
  assert.deepEqual(t, ["eat"]);
  let dead = false;
  for (let i = 0; i < 60 && !dead; i++) { r.food = null; dead = r.tick(); }
  assert.ok(dead);
  assert.equal(t.at(-1), "die");
});

test("Snake: kein direktes Umkehren, Schwanz darf nachrücken", () => {
  const r = new SnakeRunde(() => {}, () => 0.5);
  r.setDir(-1, 0);
  assert.deepEqual(r.pending, [1, 0]);
  // 2×2-Kreis: Kopf läuft auf das Feld, das der Schwanz gerade verlässt
  r.body = [[10, 10], [11, 10], [11, 11], [10, 11]];
  r.dir = [0, -1]; r.pending = [0, 1]; r.food = null;
  assert.equal(r.tick(), false);
  assert.equal(TICK_RATES[0], 0.2);
});

/* ── Pong ───────────────────────────────────────────────────────────────── */
test("Pong: Schläger wirft den Ball zurück und beschleunigt ihn", () => {
  const g = new PongRunde(true);
  Object.assign(g.ball, { x: 2.2, y: 10, vx: -0.5, vy: 0 });
  g.left.y = 8;
  g.update(new Set());
  assert.ok(g.ball.vx > 0.5);
  assert.equal(g.ball.x, 2);
});

test("Pong: Punkt rechts, wenn der Ball links hinaus geht", () => {
  const g = new PongRunde(true);
  Object.assign(g.ball, { x: -1.9, y: 2, vx: -0.5, vy: 0 });
  g.left.y = 17;
  assert.equal(g.update(new Set()), 1);
  assert.equal(g.scoreRight, 1);
  assert.equal(WINNING_SCORE, 7);
});

/* ── Mario ──────────────────────────────────────────────────────────────── */
test("Mario steht auf dem Boden und springt", () => {
  const w = new MarioWelt();
  const keys = { left: false, right: false, jump: false, run: false, duck: false };
  for (let i = 0; i < 10; i++) w.update(keys);
  assert.equal(w.mario.y, GROUND_Y - MARIO_SMALL_H);
  assert.ok(w.mario.onGround);
  w.update({ ...keys, jump: true });
  assert.ok(w.mario.vy < 0);
});

test("Mario: ?-Block von unten gibt einen Pilz", () => {
  const w = new MarioWelt();
  w.activateBlock(13, 2);
  assert.equal(w.getTile(13, 2), "H");
  assert.equal(w.items[0].kind, "mushroom");
});

test("Mario-Level wiederholt sich ab Spalte 28", () => {
  assert.deepEqual(genColumn(28), genColumn(28 + 168));
  assert.equal(genColumn(66)[0][5], " ");      // Grube
  assert.equal(genColumn(9)[1], "goomba");
});

/* ── Ausgabe: sACN wie sacn_output.py ───────────────────────────────────── */
test("Matrix-Zuordnung: Kacheln spaltenweise, Pixel zeilenweise", () => {
  const b = new Bild();
  b.set(0, 0, [1, 2, 3]);       // Matrix 1, Kachel 0, Pixel 0
  b.set(4, 0, [4, 5, 6]);       // Matrix 1, Kachel 6 (Spalte 1)
  b.set(1, 4, [7, 8, 9]);       // Matrix 1, Kachel 1, Pixel 1
  b.set(24, 0, [10, 11, 12]);   // Matrix 2, erstes Pixel
  const m1 = ausgabe.matrixDmx(b.px, 0), m2 = ausgabe.matrixDmx(b.px, 24);
  assert.equal(m1.length, 1728);
  assert.deepEqual([...m1.slice(0, 3)], [1, 2, 3]);
  assert.deepEqual([...m1.slice(6 * 16 * 3, 6 * 16 * 3 + 3)], [4, 5, 6]);
  assert.deepEqual([...m1.slice((16 + 1) * 3, (16 + 1) * 3 + 3)], [7, 8, 9]);
  assert.deepEqual([...m2.slice(0, 3)], [10, 11, 12]);
});

test("E1.31-Paket: Kopf, Universe, Länge", () => {
  const cid = Buffer.alloc(16, 0xab);
  const p = ausgabe.sacnPaket(29, Buffer.from([1, 2, 3]), 5, cid, "Matrix Games");
  assert.equal(p.length, 129);
  assert.equal(p.toString("latin1", 4, 13), "ASC-E1.17");
  assert.equal(p.readUInt16BE(16), 0x7000 | (110 + 3));
  assert.equal(p.readUInt16BE(113), 29);
  assert.equal(p[111], 5);
  assert.equal(p[108], 100);
  assert.equal(p.readUInt16BE(123), 4);
  assert.deepEqual([...p.slice(126)], [1, 2, 3]);
  assert.equal(ausgabe.multicast(29), "239.255.0.29");
  assert.equal(ausgabe.multicast(300), "239.255.1.44");
});

test("Universes je Matrix: 144 Fixtures → 4 Universes à 432 Kanäle", () => {
  const u = ausgabe.universes(new Uint8Array(1728), 144);
  assert.equal(u.length, 4);
  assert.ok(u.every((c) => c.length === 432));
  assert.equal(ausgabe.universes(new Uint8Array(1728), 170).length, 4);
  assert.equal(ausgabe.universes(new Uint8Array(1728), 170)[3].length, 1728 - 3 * 510);
});

test("NDI-Bild: 10× hochskaliert, BGRA", () => {
  const b = new Bild();
  b.set(0, 0, [10, 20, 30]);
  const f = ausgabe.ndiBild(b.px, 10);
  assert.equal(f.length, 480 * 240 * 4);
  assert.deepEqual([...f.slice(0, 4)], [30, 20, 10, 255]);
  assert.deepEqual([...f.slice(9 * 4, 9 * 4 + 4)], [30, 20, 10, 255]);
  assert.deepEqual([...f.slice(10 * 4, 10 * 4 + 4)], [0, 0, 0, 255]);
  assert.deepEqual([...f.slice((9 * 480) * 4, (9 * 480) * 4 + 4)], [30, 20, 10, 255]);
});
