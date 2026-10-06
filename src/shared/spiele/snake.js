/* ── Snake (Port von matrix-snake) ─────────────────────────────────────────
   Tick-basiert: Akkumulator, Start mit 200 ms je Schritt, alle 5 Früchte schneller.
   Zustände: title → playing ↔ paused → game_over → title */
import { schrift, fdiv } from "./pixel.js";

const F = schrift({
  A: ["010", "101", "111", "101", "101"], B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"], D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "111", "100", "111"], F: ["111", "100", "111", "100", "100"],
  G: ["011", "100", "101", "101", "011"], H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"], J: ["001", "001", "001", "101", "010"],
  K: ["101", "110", "100", "110", "101"], L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "101", "101", "101"], N: ["1001", "1101", "1011", "1001", "1001"],
  O: ["010", "101", "101", "101", "010"], P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "110", "011"], R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"], T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"], V: ["101", "101", "101", "010", "010"],
  W: ["101", "101", "101", "111", "010"], X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"], Z: ["111", "001", "010", "100", "111"],
  0: ["010", "101", "101", "101", "010"], 1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "011", "100", "111"], 3: ["111", "001", "011", "001", "111"],
  4: ["101", "101", "111", "001", "001"], 5: ["111", "100", "111", "001", "110"],
  6: ["011", "100", "111", "101", "011"], 7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"], 9: ["110", "101", "111", "001", "110"],
  " ": ["000", "000", "000", "000", "000"], "-": ["000", "000", "111", "000", "000"],
  "!": ["010", "010", "010", "000", "010"], ":": ["000", "010", "000", "010", "000"],
  ".": ["000", "000", "000", "000", "010"],
});
const { drawText, textWidth, center: cx } = F;

const WALL = [55, 55, 55], HEAD = [0, 255, 80], BODY = [0, 185, 55], FOOD = [255, 65, 35], SCORE_C = [175, 75, 240];
const BLACK = [0, 0, 0];
export const X1 = 1, X2 = 46, Y1 = 1, Y2 = 22;
export const TICK_RATES = [0.200, 0.170, 0.140, 0.110, 0.085, 0.065, 0.050];
const FOODS_PER_LEVEL = 5;
const DT = 1 / 60;

const DIRS = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};
const k = (x, y) => `${x},${y}`;

export class SnakeRunde {
  constructor(ton = () => {}, rnd = Math.random) {
    this.ton = ton; this.rnd = rnd;
    const sx = fdiv(X1 + X2, 2), sy = fdiv(Y1 + Y2, 2);
    this.body = [[sx, sy], [sx - 1, sy], [sx - 2, sy]];
    this.dir = [1, 0]; this.pending = [1, 0]; this.growth = 0;
    this.score = 0; this.foodCount = 0; this.level = 0;
    this.tickRate = TICK_RATES[0]; this.accum = 0; this.blink = 0; this.food = null;
    this.spawnFood();
  }
  get head() { return this.body[0]; }
  occupancy() { return new Set(this.body.map(([x, y]) => k(x, y))); }
  setDir(dx, dy) { if (dx !== -this.dir[0] || dy !== -this.dir[1]) this.pending = [dx, dy]; }
  uiCells() {
    const cells = new Set();
    const sw = textWidth(String(this.score));
    for (let y = 1; y < 6; y++) for (let x = 2; x < 2 + sw; x++) cells.add(k(x, y));
    const lw = textWidth("L" + (this.level + 1));
    for (let y = 1; y < 6; y++) for (let x = 45 - lw; x < 45; x++) cells.add(k(x, y));
    return cells;
  }
  spawnFood() {
    const occ = this.occupancy();
    for (const c of this.uiCells()) occ.add(c);
    if (occ.size >= (X2 - X1 + 1) * (Y2 - Y1 + 1)) { this.food = null; return; }
    for (let i = 0; i < 10000; i++) {
      const x = X1 + Math.floor(this.rnd() * (X2 - X1 + 1)), y = Y1 + Math.floor(this.rnd() * (Y2 - Y1 + 1));
      if (!occ.has(k(x, y))) { this.food = [x, y]; return; }
    }
  }
  handleKey(code) { if (DIRS[code]) this.setDir(...DIRS[code]); }
  update(dt) {
    this.blink += dt; this.accum += dt;
    while (this.accum >= this.tickRate) {
      this.accum -= this.tickRate;
      if (this.tick()) return "dead";
    }
    return null;
  }
  tick() {
    this.dir = this.pending;
    const [hx, hy] = this.head, nx = hx + this.dir[0], ny = hy + this.dir[1];
    if (!(X1 <= nx && nx <= X2 && Y1 <= ny && ny <= Y2)) { this.ton("die"); return true; }
    const occ = this.occupancy();
    // Schwanzausnahme: ohne Wachstum wird das Schwanzfeld in diesem Schritt frei
    if (this.growth <= 0) { const [tx, ty] = this.body[this.body.length - 1]; occ.delete(k(tx, ty)); }
    if (occ.has(k(nx, ny))) { this.ton("die"); return true; }
    this.body.unshift([nx, ny]);
    if (this.food && nx === this.food[0] && ny === this.food[1]) {
      this.ton("eat");
      this.foodCount++;
      this.score += 10 * (this.level + 1);
      this.growth += 3;
      const lvl = Math.min(fdiv(this.foodCount, FOODS_PER_LEVEL), TICK_RATES.length - 1);
      if (lvl > this.level) { this.level = lvl; this.tickRate = TICK_RATES[lvl]; }
      this.spawnFood();
    }
    if (this.growth > 0) this.growth--; else this.body.pop();
    return false;
  }
  render(b) {
    b.fill(BLACK);
    b.rect(0, 0, 48, 1, WALL); b.rect(0, 23, 48, 1, WALL); b.rect(0, 0, 1, 24, WALL); b.rect(47, 0, 1, 24, WALL);
    if (this.food && Math.floor(this.blink * 6) % 3 !== 0) b.set(this.food[0], this.food[1], FOOD);
    for (let i = this.body.length - 1; i >= 0; i--) b.set(this.body[i][0], this.body[i][1], i === 0 ? HEAD : BODY);
    drawText(b, String(this.score), 2, 1, SCORE_C);
    const lvl = "L" + (this.level + 1);
    drawText(b, lvl, 45 - textWidth(lvl), 1, SCORE_C);
  }
}

const DECO = [[32, 10], [31, 10], [30, 10], [29, 10], [28, 10], [28, 11], [28, 12], [29, 12], [30, 12], [31, 12]];

export function createSnake({ ton = () => {} } = {}) {
  let state = "title", game = null, high = 0, blink = 0;
  const neu = () => { game = new SnakeRunde(ton); state = "playing"; };
  return {
    id: "snake",
    get state() { return state; },
    get score() { return game?.score || 0; },
    key(code) {
      if (state === "title") { if (code === "Space") neu(); }
      else if (state === "playing") { if (code === "Escape") state = "paused"; else game.handleKey(code); }
      else if (state === "paused") {
        if (["Escape", "Space", "KeyP"].includes(code)) state = "playing";
        else if (code === "KeyQ") state = "title";
      } else if (state === "game_over") {
        if (code === "Space") neu();
        else if (code === "Escape") state = "title";
      }
    },
    step() {
      if (state === "playing" && game.update(DT) === "dead") {
        if (game.score > high) high = game.score;
        state = "game_over";
      }
      blink += DT;
    },
    render(b) {
      if (state === "title") {
        b.fill(BLACK);
        drawText(b, "SNAKE", cx("SNAKE"), 4, HEAD);
        DECO.forEach(([x, y], i) => b.set(x, y, i === 0 ? HEAD : BODY));
        b.set(34, 10, FOOD);
        if (Math.floor(blink * 2) % 2 === 0) drawText(b, "PRESS SPACE", cx("PRESS SPACE"), 14, SCORE_C);
        if (high > 0) { const hs = "BEST " + high; drawText(b, hs, cx(hs), 18, [90, 90, 200]); }
      } else if (state === "playing") game.render(b);
      else if (state === "paused") {
        game.render(b);
        const x = cx("PAUSE"), y = 9;
        b.rect(x - 2, y - 1, textWidth("PAUSE") + 4, 7, BLACK);
        drawText(b, "PAUSE", x, y, [255, 230, 50]);
      } else {
        b.fill(BLACK);
        const [msg, col] = Math.floor(blink * 1.5) % 3 < 2 ? ["GAME OVER", FOOD] : ["SPACE", [200, 200, 200]];
        drawText(b, msg, cx(msg), 2, col);
        const sc = "SCORE " + game.score;
        drawText(b, sc, cx(sc), 9, SCORE_C);
        if (high > 0) {
          if (game.score >= high) drawText(b, "NEW BEST", cx("NEW BEST"), 16, [255, 220, 0]);
          else { const hs = "BEST " + high; drawText(b, hs, cx(hs), 16, [90, 90, 200]); }
        }
      }
    },
  };
}
