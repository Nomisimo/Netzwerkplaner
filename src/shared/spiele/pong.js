/* ── Pong (Port von matrix-pong) ───────────────────────────────────────────
   Bildbasiert (60 fps). 1P gegen den Computer oder 2P an einer Tastatur.
   Zustände: title (Modus wählen) → playing → point_scored → playing … → game_over → title */
import { schrift, int } from "./pixel.js";

const F = schrift({
  0: ["XXX", "X.X", "X.X", "X.X", "XXX"], 1: [".X.", "XX.", ".X.", ".X.", "XXX"],
  2: ["XXX", "..X", "XXX", "X..", "XXX"], 3: ["XXX", "..X", "XXX", "..X", "XXX"],
  4: ["X.X", "X.X", "XXX", "..X", "..X"], 5: ["XXX", "X..", "XXX", "..X", "XXX"],
  6: ["XXX", "X..", "XXX", "X.X", "XXX"], 7: ["XXX", "..X", "..X", "..X", "..X"],
  8: ["XXX", "X.X", "XXX", "X.X", "XXX"], 9: ["XXX", "X.X", "XXX", "..X", "XXX"],
  A: [".X.", "X.X", "XXX", "X.X", "X.X"], B: ["XX.", "X.X", "XX.", "X.X", "XX."],
  C: [".XX", "X..", "X..", "X..", ".XX"], D: ["XX.", "X.X", "X.X", "X.X", "XX."],
  E: ["XXX", "X..", "XX.", "X..", "XXX"], F: ["XXX", "X..", "XX.", "X..", "X.."],
  G: [".XX", "X..", "X.X", "X.X", ".XX"], H: ["X.X", "X.X", "XXX", "X.X", "X.X"],
  I: ["XXX", ".X.", ".X.", ".X.", "XXX"], J: [".XX", "..X", "..X", "X.X", ".X."],
  K: ["X.X", "X.X", "XX.", "X.X", "X.X"], L: ["X..", "X..", "X..", "X..", "XXX"],
  M: ["X.X", "XXX", "X.X", "X.X", "X.X"], N: ["X..X", "XX.X", "X.XX", "X..X", "X..X"],
  O: ["XXX", "X.X", "X.X", "X.X", "XXX"], P: ["XXX", "X.X", "XXX", "X..", "X.."],
  Q: [".X.", "X.X", "X.X", "X.X", ".XX"], R: ["XX.", "X.X", "XX.", "X.X", "X.X"],
  S: ["XXX", "X..", "XXX", "..X", "XXX"], T: ["XXX", ".X.", ".X.", ".X.", ".X."],
  U: ["X.X", "X.X", "X.X", "X.X", "XXX"], V: ["X.X", "X.X", "X.X", "X.X", ".X."],
  W: ["X.X", "X.X", "X.X", "XXX", "X.X"], X: ["X.X", "X.X", ".X.", "X.X", "X.X"],
  Y: ["X.X", "X.X", ".X.", ".X.", ".X."], Z: ["XXX", "..X", ".X.", "X..", "XXX"],
  " ": ["...", "...", "...", "...", "..."],
}, { endLuecke: true });
const { drawText, textWidth, center } = F;

export const PINK = [255, 50, 180], SCORE_COLOR = [180, 80, 240];
const BLACK = [0, 0, 0];
export const BALL_SPEED_INIT = 0.5, BALL_SPEED_MAX = 1.8, BALL_ACCEL = 0.05, PADDLE_SPEED = 0.55;
export const WINNING_SCORE = 7;
const TOP_WALL = 0, BOTTOM_WALL = 23, PLAY_TOP = 1, PADDLE_MIN = 1, PADDLE_MAX = 17;
const AI_DEAD_ZONE_START = 3.0, AI_DEAD_ZONE_MIN = 0.5, AI_SPEED_START = 0.40, AI_RAMP_FRAMES = 180;
const POINT_PAUSE_FRAMES = 60;

const clamp = (v) => Math.max(PADDLE_MIN, Math.min(PADDLE_MAX, v));
const speed = (b) => Math.hypot(b.vx, b.vy);
const setSpeed = (b, s) => { const c = speed(b); if (c > 0) { b.vx = b.vx / c * s; b.vy = b.vy / c * s; } };
const hitsPaddle = (b, p) => b.x < p.x + p.w && b.x + 2 > p.x && b.y < p.y + p.h && b.y + 2 > p.y;

export function resetBall(ball, direction = null, rnd = Math.random) {
  ball.x = 23; ball.y = 11;
  const angle = -0.4 + rnd() * 0.8;
  if (direction == null) direction = rnd() < 0.5 ? -1 : 1;
  ball.vx = direction * BALL_SPEED_INIT * Math.cos(angle);
  ball.vy = BALL_SPEED_INIT * Math.sin(angle);
}

export class PongRunde {
  constructor(twoPlayer = false, ton = () => {}) {
    this.twoPlayer = twoPlayer; this.ton = ton;
    this.ball = { x: 23, y: 11, vx: 0, vy: 0, w: 2, h: 2 };
    this.left = { x: 1, y: 9, vy: 0, w: 1, h: 6 };
    this.right = { x: 46, y: 9, vy: 0, w: 1, h: 6 };
    this.scoreLeft = 0; this.scoreRight = 0; this.framesSincePoint = 0;
    resetBall(this.ball);
  }
  aiUpdate(ball, p) {
    const t = Math.min(1, this.framesSincePoint / AI_RAMP_FRAMES);
    const dead = AI_DEAD_ZONE_START + (AI_DEAD_ZONE_MIN - AI_DEAD_ZONE_START) * t;
    const sp = PADDLE_SPEED * (AI_SPEED_START + (1 - AI_SPEED_START) * t);
    const c = p.y + p.h / 2;
    p.vy = Math.abs(ball.y - c) > dead ? sp * (ball.y > c ? 1 : -1) : 0;
  }
  // held: Set mit KeyboardEvent.code der gedrückten Tasten
  update(held) {
    const { ball, left, right } = this;
    this.framesSincePoint++;
    left.vy = held.has("KeyW") ? -PADDLE_SPEED : held.has("KeyS") ? PADDLE_SPEED : 0;
    left.y = clamp(left.y + left.vy);
    if (this.twoPlayer) right.vy = held.has("ArrowUp") ? -PADDLE_SPEED : held.has("ArrowDown") ? PADDLE_SPEED : 0;
    else this.aiUpdate(ball, right);
    right.y = clamp(right.y + right.vy);

    ball.x += ball.vx; ball.y += ball.vy;
    if (ball.y <= PLAY_TOP) { ball.y = PLAY_TOP; ball.vy = Math.abs(ball.vy); this.ton("wall"); }
    if (ball.y + 2 >= BOTTOM_WALL) { ball.y = BOTTOM_WALL - 2; ball.vy = -Math.abs(ball.vy); this.ton("wall"); }
    for (const p of [left, right]) {
      if (!hitsPaddle(ball, p)) continue;
      ball.vx = -ball.vx;
      ball.vy += ((ball.y + 1) - (p.y + p.h / 2)) * 0.2;
      setSpeed(ball, Math.min(speed(ball) * (1 + BALL_ACCEL), BALL_SPEED_MAX));
      ball.x = p.x === 1 ? p.x + p.w : p.x - ball.w;
      this.ton("paddle");
    }
    if (ball.x + 2 < 0) { this.scoreRight++; this.framesSincePoint = 0; this.ton("score"); return 1; }
    if (ball.x > 47) { this.scoreLeft++; this.framesSincePoint = 0; this.ton("score"); return -1; }
    return null;
  }
  render(b) {
    feld(b);
    for (const p of [this.left, this.right]) for (let dy = 0; dy < p.h; dy++) b.set(p.x, int(p.y) + dy, PINK);
    ball(b, int(this.ball.x), int(this.ball.y));
    scores(b, this);
  }
}

function feld(b) {
  b.fill(BLACK);
  b.rect(0, TOP_WALL, 48, 1, PINK); b.rect(0, BOTTOM_WALL, 48, 1, PINK);
  for (let y = PLAY_TOP; y < BOTTOM_WALL; y += 2) b.set(23, y, PINK);
}
const ball = (b, x, y) => { for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) b.set(x + dx, y + dy, PINK); };
function scores(b, g) {
  const ls = String(g.scoreLeft);
  drawText(b, ls, 22 - textWidth(ls), 1, SCORE_COLOR);
  drawText(b, String(g.scoreRight), 25, 1, SCORE_COLOR);
}

export function createPong({ ton = () => {} } = {}) {
  let state = "title", game = null, pause = 0, lastScorer = null;
  const lobby = { bx: 23, by: 11, bvx: 0.55, bvy: 0.38, mode: 1 };
  return {
    id: "pong",
    get state() { return state; },
    get mode() { return lobby.mode; },
    key(code) {
      if (state === "title") {
        if (code === "ArrowLeft" || code === "Digit1") lobby.mode = 1;
        else if (code === "ArrowRight" || code === "Digit2") lobby.mode = 2;
        else if (code === "Space" || code === "Enter") { game = new PongRunde(lobby.mode === 2, ton); state = "playing"; }
      } else if (state === "game_over" && code === "Space") state = "title";
    },
    step(held) {
      if (state === "title") {
        const l = lobby;
        l.bx += l.bvx; l.by += l.bvy;
        if (l.bx <= 2) { l.bx = 2; l.bvx = Math.abs(l.bvx); }
        if (l.bx >= 44) { l.bx = 44; l.bvx = -Math.abs(l.bvx); }
        if (l.by <= PLAY_TOP) { l.by = PLAY_TOP; l.bvy = Math.abs(l.bvy); }
        if (l.by + 2 >= BOTTOM_WALL) { l.by = BOTTOM_WALL - 2; l.bvy = -Math.abs(l.bvy); }
      } else if (state === "playing") {
        const s = game.update(held);
        if (s != null) {
          lastScorer = s;
          if (game.scoreLeft >= WINNING_SCORE || game.scoreRight >= WINNING_SCORE) state = "game_over";
          else { pause = POINT_PAUSE_FRAMES; state = "point_scored"; }
        }
      } else if (state === "point_scored") {
        if (--pause <= 0) { resetBall(game.ball, lastScorer); state = "playing"; }
      }
    },
    render(b) {
      if (state === "title") {
        feld(b);
        for (let dy = 0; dy < 6; dy++) { b.set(1, 9 + dy, PINK); b.set(46, 9 + dy, PINK); }
        ball(b, int(lobby.bx), int(lobby.by));
        const tx = center("PONG");
        b.rect(tx, 3, textWidth("PONG"), 5, BLACK);
        drawText(b, "PONG", tx, 3, PINK);
        drawText(b, "1P", 8, 12, lobby.mode === 1 ? PINK : SCORE_COLOR);
        drawText(b, "2P", 32, 12, lobby.mode === 2 ? PINK : SCORE_COLOR);
        b.rect(lobby.mode === 1 ? 8 : 32, 18, 7, 1, PINK);
      } else if (state === "game_over") {
        feld(b);
        scores(b, game);
        const winner = game.scoreLeft >= WINNING_SCORE ? "P1" : game.twoPlayer ? "P2" : "COM";
        drawText(b, winner + " WINS", center(winner + " WINS"), 9, PINK);
        drawText(b, "PRESS SPACE", center("PRESS SPACE"), 17, PINK);
      } else game.render(b);
    },
  };
}
