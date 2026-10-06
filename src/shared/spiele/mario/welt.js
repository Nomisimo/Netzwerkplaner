/* ── Mario: Physik, Figuren, Gegenstände und Spielwelt ─────────────────────
   Port von matrix-mario-jump (physics.py, mario.py, enemies.py, items.py, engine.py).
   Ganzzahl-Rundungen folgen Python (int() schneidet ab, // rundet ab), damit die
   Kollisionen genau wie im Original greifen. */
import { W, H, int, fdiv } from "../pixel.js";
import { LEVEL_H, genColumn } from "./level.js";
import {
  MARIO_SMALL, MARIO_BIG, MARIO_FIRE, GOOMBA, KOOPA, MUSHROOM, FIRE_FLOWER, COIN, STAR, ONEUP, DEBRIS,
  TILE_MAP, T_QUEST2, drawSprite, flipH,
} from "./sprites.js";

/* ── Konstanten ─────────────────────────────────────────────────────────── */
export const TILE = 4, GROUND_ROW = 5, GROUND_Y = GROUND_ROW * TILE;
export const MARIO_W = 4, MARIO_SMALL_H = 6, MARIO_BIG_H = 10;
export const GRAVITY = 0.38, MAX_FALL = 3.5, WALK_SPEED = 0.6, RUN_SPEED = 1.4;
export const JUMP_VEL = -2.5, JUMP_VEL_RUN = -3.2;
const GRAVITY_RISE = 0.28, GRAVITY_FALL = 0.50, GRAVITY_ABORT = 0.58;
const ACCEL_WALK = 0.06, ACCEL_RUN = 0.09, DECEL = 0.04, DECEL_SKID = 0.07;
export const SKY = [92, 148, 252], COL_WHITE = [255, 255, 255], COL_SCORE = [255, 220, 0], COL_RED = [255, 60, 60];
export const SMALL = "small", BIG = "big", FIRE = "fire", DEAD = "dead", GROW = "grow", SHRINK = "shrink";
const SOLID = new Set("GH?B[]()IN");
const ACTIVATABLE = new Set("?BIN");
const COYOTE_FRAMES = 6, STAR_DURATION = 480;
const QUEST_ANIM_SPEED = 30, GEN_AHEAD = W * 3;

/* ── Kachel-Kollision (erst x, dann y) ──────────────────────────────────── */
const getTile = (tiles, col, row) => (row >= 0 && row < LEVEL_H && col >= 0 && col < tiles[0].length ? tiles[row][col] : " ");
const isSolid = (t) => SOLID.has(t);

export function resolveX(e, tiles) {
  if (e.vx === 0) return;
  const top = Math.max(0, fdiv(int(e.y), TILE));
  const bot = Math.min(LEVEL_H - 1, fdiv(int(e.y + e.h - 1), TILE));
  if (e.vx > 0) {
    const col = fdiv(int(e.x + e.w - 1), TILE);
    for (let row = top; row <= bot; row++) if (isSolid(getTile(tiles, col, row))) { e.x = col * TILE - e.w; e.vx = 0; return; }
  } else {
    const col = fdiv(int(e.x), TILE);
    for (let row = top; row <= bot; row++) if (isSolid(getTile(tiles, col, row))) { e.x = (col + 1) * TILE; e.vx = 0; return; }
  }
  if (e.x < 0) { e.x = 0; e.vx = 0; }
}

// → [col, row] eines von unten getroffenen aktivierbaren Blocks oder null
export function resolveY(e, tiles, prevY) {
  const left = Math.max(0, fdiv(int(e.x), TILE));
  const right = Math.min(tiles[0].length - 1, fdiv(int(e.x + e.w - 1), TILE));
  if (e.vy >= 0) {
    const row = Math.min(LEVEL_H - 1, fdiv(int(e.y + e.h), TILE));
    for (let col = left; col <= right; col++) {
      if (!isSolid(getTile(tiles, col, row))) continue;
      const top = row * TILE;
      if (prevY + e.h <= top) { e.y = top - e.h; e.vy = 0; e.onGround = true; return null; }
    }
  } else {
    const row = Math.max(0, fdiv(int(e.y), TILE));
    for (let col = left; col <= right; col++) {
      const t = getTile(tiles, col, row);
      if (!isSolid(t)) continue;
      const bottom = (row + 1) * TILE;
      if (prevY >= bottom) { e.y = bottom; e.vy = 0; return ACTIVATABLE.has(t) ? [col, row] : null; }
    }
  }
  return null;
}

function stepEntity(e, tiles) {
  e.onGround = false;
  e.x += e.vx;
  resolveX(e, tiles);
  const prevY = e.y;
  e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
  e.y += e.vy;
  return resolveY(e, tiles, prevY);
}

// Gegner drehen an Abgründen um
function turnAtEdge(e, tiles) {
  if (!e.onGround) return;
  const ahead = e.vx > 0 ? fdiv(int(e.x + e.w), TILE) : fdiv(int(e.x - 1), TILE);
  if (getTile(tiles, ahead, fdiv(int(e.y + e.h), TILE)) === " ") e.vx = -e.vx;
}
// An Wänden umdrehen: resolveX hat vx auf 0 gesetzt
function walk(e, tiles) {
  const prev = e.vx;
  stepEntity(e, tiles);
  if (prev !== 0 && e.vx === 0) e.vx = -prev;
}

/* ── Mario ──────────────────────────────────────────────────────────────── */
export class Mario {
  constructor(x, y, ton) {
    Object.assign(this, { x, y, vx: 0, vy: 0, onGround: false, state: SMALL, w: MARIO_W, h: MARIO_SMALL_H, ton });
    this.facingRight = true; this.animTick = 0; this.animFrame = 0;
    this.coyote = 0; this.jumped = false; this.jumpHeld = false; this.skidding = false; this.ducking = false;
    this.wasOnGround = false; this.prevVy = 0;
    this.transitionTimer = 0; this.prevState = SMALL;
    this.starTimer = 0; this.starVisible = true;
    this.dead = false; this.deadTimer = 0; this.deadDone = false;
  }
  applySize() {
    const nh = [GROW, SHRINK].includes(this.state) ? MARIO_BIG_H : [SMALL, DEAD].includes(this.state) ? MARIO_SMALL_H : MARIO_BIG_H;
    if (nh !== this.h) { this.y -= nh - this.h; this.h = nh; }
  }
  jump() {
    if (this.dead || this.state === GROW || this.state === SHRINK) return;
    if (this.onGround || this.coyote > 0) {
      const r = Math.min(1, Math.abs(this.vx) / RUN_SPEED);
      this.vy = JUMP_VEL + (JUMP_VEL_RUN - JUMP_VEL) * r;
      this.onGround = false; this.coyote = 0;
      this.ton("jump");
    }
  }
  stompBounce() { this.vy = JUMP_VEL * 0.55; }
  grow() {
    if (this.state !== SMALL) return;
    this.prevState = BIG; this.state = GROW; this.transitionTimer = 60; this.applySize();
  }
  powerUp() { if (this.state === BIG || this.state === FIRE) this.state = FIRE; else if (this.state === SMALL) this.grow(); }
  applyStar() { this.starTimer = STAR_DURATION; }
  takeHit() {
    if (this.starTimer > 0 || this.state === DEAD) return;
    if ([BIG, FIRE, SHRINK].includes(this.state)) {
      this.ton("block");
      this.state = SHRINK; this.prevState = SMALL; this.transitionTimer = 60; this.applySize();
    } else if (this.state === SMALL) this.die();
  }
  die() {
    this.state = DEAD; this.dead = true; this.vy = -3.5; this.vx = 0; this.deadTimer = 180;
    this.ton("death");
  }
  pitDeath() { if (!this.dead) { this.dead = true; this.state = DEAD; this.deadDone = true; } }

  update(tiles, keys) {
    if (this.dead) {
      if (!this.deadDone) {
        this.deadTimer--;
        this.vy = Math.min(this.vy + 0.38, 6.0);
        this.y += this.vy;
        if (this.deadTimer <= 0) this.deadDone = true;
      }
      return null;
    }
    const trans = this.state === GROW || this.state === SHRINK;
    if (trans && --this.transitionTimer <= 0) { this.state = this.prevState; this.applySize(); }
    this.movement(keys, trans);
    this.wasOnGround = this.onGround;
    this.prevVy = this.vy;
    const hit = this.physStep(tiles);
    this.postStep();
    if (!trans && this.starTimer > 0) {
      this.starTimer--;
      this.starVisible = fdiv(this.starTimer, 4) % 2 === 0;
    }
    return hit;
  }
  physStep(tiles) {
    const grav = this.vy < 0 && this.jumpHeld ? GRAVITY_RISE : this.vy < 0 ? GRAVITY_ABORT : GRAVITY_FALL;
    this.onGround = false;
    this.x += this.vx;
    resolveX(this, tiles);
    const prevY = this.y;
    this.vy = Math.min(this.vy + grav, MAX_FALL);
    this.y += this.vy;
    return resolveY(this, tiles, prevY);
  }
  movement(keys, slow) {
    const { run, left, right, jump, duck } = keys;
    this.jumpHeld = !!jump;
    const s = slow ? 0.5 : 1;
    const maxSpd = (run ? RUN_SPEED : WALK_SPEED) * s, accel = (run ? ACCEL_RUN : ACCEL_WALK) * s;
    const decel = DECEL * s, skid = DECEL_SKID * s;

    this.ducking = false;
    if (duck && (this.state === BIG || this.state === FIRE)) {
      this.ducking = true;
      if (this.h !== 6) { this.y += this.h - 6; this.h = 6; }
      if (right) { this.vx = Math.min(this.vx + accel * 0.5, maxSpd * 0.5); this.facingRight = true; }
      else if (left) { this.vx = Math.max(this.vx - accel * 0.5, -maxSpd * 0.5); this.facingRight = false; }
      else this.vx *= 0.85;
      return;                                     // kein Springen im Ducken
    } else if ((this.state === BIG || this.state === FIRE) && this.h === 6) {
      this.h = MARIO_BIG_H; this.y -= MARIO_BIG_H - 6;
    }

    this.skidding = false;
    if (right) {
      if (this.vx < 0) { this.skidding = true; this.vx = Math.min(0, this.vx + skid); }
      else if (this.vx < maxSpd) this.vx = Math.min(this.vx + accel, maxSpd);
      else if (this.vx > maxSpd) this.vx = Math.max(this.vx - decel, maxSpd);
      this.facingRight = true;
    } else if (left) {
      if (this.vx > 0) { this.skidding = true; this.vx = Math.max(0, this.vx - skid); }
      else if (this.vx > -maxSpd) this.vx = Math.max(this.vx - accel, -maxSpd);
      else if (this.vx < -maxSpd) this.vx = Math.min(this.vx + decel, -maxSpd);
      this.facingRight = false;
    } else if (this.vx > 0) this.vx = Math.max(0, this.vx - decel);
    else if (this.vx < 0) this.vx = Math.min(0, this.vx + decel);

    if (jump && !this.jumped) { this.jump(); this.jumped = true; }
    if (!jump) this.jumped = false;
  }
  postStep() {
    if (this.onGround) this.coyote = COYOTE_FRAMES;
    else if (this.coyote > 0) this.coyote--;
    if (Math.abs(this.vx) > 0.1) {
      if (++this.animTick >= 8) { this.animTick = 0; this.animFrame ^= 1; }
    } else { this.animFrame = 0; this.animTick = 0; }
  }
  render(b, camX, camY = 0) {
    if (this.starTimer > 0 && !this.starVisible) return;
    let sp = this.sprite();
    if (!this.facingRight) sp = flipH(sp);
    drawSprite(b, sp, int(this.x) - camX, int(this.y) - camY);
  }
  sprite() {
    const st = this.state;
    if (st === DEAD) return MARIO_SMALL.dead;
    if (st === GROW || st === SHRINK) return (fdiv(this.transitionTimer, 5) % 2 === 0 ? MARIO_BIG : MARIO_SMALL).idle;
    const bank = { [SMALL]: MARIO_SMALL, [BIG]: MARIO_BIG, [FIRE]: MARIO_FIRE }[st] || MARIO_SMALL;
    if (!this.onGround) return bank.jump;
    if (this.ducking) return bank.duck || bank.idle;
    if (this.skidding && Math.abs(this.vx) > 0.05) return bank.idle;
    if (Math.abs(this.vx) > 0.1) return this.animFrame === 0 ? bank.run1 : bank.run2;
    return bank.idle;
  }
}

/* ── Gegner ─────────────────────────────────────────────────────────────── */
export class Goomba {
  constructor(x, y) {
    Object.assign(this, { x, y, w: 4, h: 4, vx: -0.5, vy: 0, onGround: false, alive: true, squished: false, remove: false });
    this.squishTimer = 0; this.animTick = 0; this.animFrame = 0;
  }
  update(tiles) {
    if (!this.alive) { if (this.squished && --this.squishTimer <= 0) this.remove = true; return; }
    turnAtEdge(this, tiles);
    walk(this, tiles);
    if (++this.animTick >= 15) { this.animTick = 0; this.animFrame ^= 1; }
  }
  stomp() { this.alive = false; this.squished = true; this.squishTimer = 60; this.vx = 0; this.vy = 0; }
  render(b, camX, camY = 0) {
    drawSprite(b, this.squished ? GOOMBA.dead : this.animFrame === 0 ? GOOMBA.walk1 : GOOMBA.walk2, int(this.x) - camX, int(this.y) - camY);
  }
}

export class Koopa {
  constructor(x, y) {
    Object.assign(this, { x, y, w: 4, vx: -0.4, vy: 0, onGround: false, inShell: false, shellMoving: false, alive: true, remove: false });
    this.animTick = 0; this.animFrame = 0; this.shellKickDelay = 0;
  }
  get h() { return this.inShell ? 4 : 6; }
  update(tiles) {
    if (!this.alive) { this.remove = true; return; }
    if (this.inShell && !this.shellMoving) {
      this.shellKickDelay = Math.max(0, this.shellKickDelay - 1);
      stepEntity(this, tiles);
      return;
    }
    turnAtEdge(this, tiles);
    walk(this, tiles);
    if (++this.animTick >= 18) { this.animTick = 0; this.animFrame ^= 1; }
  }
  stomp() {
    if (!this.inShell) { this.inShell = true; this.shellMoving = false; this.vx = 0; this.shellKickDelay = 30; }
    else if (!this.shellMoving && this.shellKickDelay <= 0) { this.shellMoving = true; this.vx = 2.5; }
  }
  kick(marioX) {
    if (this.inShell && !this.shellMoving && this.shellKickDelay <= 0) { this.shellMoving = true; this.vx = marioX < this.x ? 2.5 : -2.5; }
  }
  render(b, camX, camY = 0) {
    let sp = this.inShell ? KOOPA.shell : this.animFrame === 0 ? KOOPA.walk1 : KOOPA.walk2;
    if (!(this.vx >= 0)) sp = flipH(sp);
    drawSprite(b, sp, int(this.x) - camX, int(this.y) - camY);
  }
}

/* ── Gegenstände ────────────────────────────────────────────────────────── */
class Item {
  constructor(kind, x, y, extra) { Object.assign(this, { kind, x, y, vx: 0, vy: 0, onGround: false, remove: false, ...extra }); }
  collect() { this.remove = true; }
  render(b, camX, camY = 0) { drawSprite(b, this.sp, int(this.x) - camX, int(this.y) - camY); }
}
export const mushroom = (x, y, oneUp = false) => Object.assign(new Item(oneUp ? "oneup" : "mushroom", x, y, { w: 4, h: 5, vx: 0.6, vy: JUMP_VEL * 0.4, sp: oneUp ? ONEUP : MUSHROOM }), {
  update(tiles) { if (!this.remove) walk(this, tiles); },
});
const fireFlower = (x, y) => Object.assign(new Item("flower", x, y, { w: 4, h: 5, sp: FIRE_FLOWER, baseY: y, tick: 0 }), {
  update() { if (!this.remove) this.y = this.baseY + Math.sin(++this.tick * Math.PI / 30); },
});
export const coin = (x, y) => Object.assign(new Item("coin", x, y, { sp: COIN, startY: y, timer: 20 }), {
  update() {
    if (this.remove) return;
    this.timer--;
    this.y = this.startY - (1 - this.timer / 20) * 6;
    if (this.timer <= 0) this.remove = true;
  },
  render(b, camX, camY = 0) { if (!this.remove) drawSprite(b, COIN, int(this.x) - camX, int(this.y) - camY); },
});
export const star = (x, y) => Object.assign(new Item("star", x, y, { w: 4, h: 4, vx: 1.5, vy: JUMP_VEL * 0.6, sp: STAR }), {
  update(tiles) {
    if (this.remove) return;
    walk(this, tiles);
    if (this.onGround) this.vy = JUMP_VEL * 0.7;
  },
});
const debris = (x, y, vx, vy) => Object.assign(new Item("debris", x, y, { vx, vy, sp: DEBRIS }), {
  update() {
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    this.x += this.vx; this.y += this.vy;
    if (this.y > 24 || this.y < -8) this.remove = true;
  },
});
export function spawnDebris(col, row) {
  const cx = col * 4 + 2, cy = row * 4 + 2;
  return [debris(cx - 2, cy - 2, -1.5, -2.5), debris(cx, cy - 2, 1.5, -2.5), debris(cx - 2, cy, -1.5, 1.5), debris(cx, cy, 1.5, 1.5)];
}

/* ── Spielwelt ──────────────────────────────────────────────────────────── */
const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

export class MarioWelt {
  constructor(ton = () => {}) { this.ton = ton; this.reset(); }
  reset() {
    this.tiles = Array.from({ length: LEVEL_H }, () => []);
    this.levelW = 0;
    this.mario = new Mario(4 * TILE, GROUND_Y - MARIO_SMALL_H, this.ton);
    this.enemies = []; this.items = [];
    this.cameraX = 0; this.cameraY = 0;
    this.score = 0; this.coins = 0; this.lives = 3;
    this.questTick = 0; this.questFrame = 0; this.gameOver = false;
    this.ensureGenerated(fdiv(W + GEN_AHEAD, TILE));
  }
  ensureGenerated(upTo) {
    while (this.levelW <= upTo) {
      const col = this.levelW;
      const [colTiles, enemy] = genColumn(col);
      for (let r = 0; r < LEVEL_H; r++) this.tiles[r].push(colTiles[r]);
      this.levelW++;
      if (enemy === "goomba") this.enemies.push(new Goomba(col * TILE, GROUND_Y - 4));
      else if (enemy) this.enemies.push(new Koopa(col * TILE, GROUND_Y - 6));
    }
  }
  getTile(col, row) { return getTile(this.tiles, col, row); }
  setTile(col, row, ch) { if (row >= 0 && row < LEVEL_H && col >= 0 && col < this.levelW) this.tiles[row][col] = ch; }

  activateBlock(col, row) {
    const t = this.getTile(col, row), m = this.mario, sx = col * TILE, sy = row * TILE;
    if (t === "?") {
      this.setTile(col, row, "H");
      this.ton("coin");
      if (m.state === SMALL) this.items.push(mushroom(sx, sy - MARIO_SMALL_H));
      else this.items.push(fireFlower(sx, sy - 5));
    } else if (t === "B") {
      if (m.state === BIG || m.state === FIRE) {
        this.setTile(col, row, " ");
        this.items.push(...spawnDebris(col, row));
        this.score += 50;
        this.ton("brick");
      }
    } else if (t === "N") m.vy = JUMP_VEL * 1.3;
  }

  update(keys) {
    if (this.gameOver) return;
    this.ensureGenerated(fdiv(this.cameraX + GEN_AHEAD, TILE));
    const m = this.mario;
    const hit = m.update(this.tiles, keys);
    if (hit) this.activateBlock(...hit);
    if (m.y > H && !m.dead) m.pitDeath();

    for (const e of this.enemies) {
      e.update(this.tiles);
      if (e.remove || !e.alive) continue;
      if (m.dead || !overlap(m.x, m.y, m.w, m.h, e.x, e.y, e.w, e.h)) continue;
      // Draufspringen: Mario war in der Luft, fiel und landet auf der Oberseite
      if (!m.wasOnGround && m.prevVy >= 0 && m.y + m.h <= e.y + 4) {
        e.stomp(); this.score += 100; m.stompBounce(); this.ton("stomp");
      } else if (m.starTimer > 0) {
        e.alive = false; e.remove = true; this.score += 100; this.ton("stomp");
      } else if (e.inShell && !e.shellMoving) {
        e.kick(m.x); this.ton("kick");
      } else m.takeHit();
    }
    const purge = this.cameraX - W * 2;
    this.enemies = this.enemies.filter((e) => !e.remove && e.x > purge);

    for (const it of this.items) {
      it.update(this.tiles);
      if (it.remove || !["mushroom", "oneup", "flower", "star"].includes(it.kind)) continue;
      if (!overlap(m.x, m.y, m.w, m.h, it.x, it.y, it.w, it.h)) continue;
      it.collect();
      this.score += 1000;
      if (it.kind === "oneup") { m.grow(); this.ton("1up"); }
      else if (it.kind === "mushroom") { m.grow(); this.ton("powerup"); }
      else if (it.kind === "flower") { m.powerUp(); this.ton("powerup"); }
      else { m.applyStar(); this.ton("star"); }
    }
    const purgeItems = this.cameraX - W;
    this.items = this.items.filter((i) => !i.remove && i.x > purgeItems);

    // Kamera: nur nach rechts; nach oben sofort folgen, langsam zurück, Boden bleibt sichtbar
    this.cameraX = Math.max(0, Math.max(this.cameraX, int(m.x) - 10));
    const ty = int(m.y) - 3;
    if (ty < this.cameraY) this.cameraY = ty;
    else if (this.cameraY < 0) this.cameraY = Math.min(0, this.cameraY + 1);
    this.cameraY = Math.min(0, Math.max(this.cameraY, GROUND_Y - H + 1));

    if (++this.questTick >= QUEST_ANIM_SPEED) { this.questTick = 0; this.questFrame ^= 1; }

    if (m.deadDone) {
      this.lives--;
      if (this.lives <= 0) this.gameOver = true;
      else this.resetAfterDeath();
    }
  }
  resetAfterDeath() {
    const { lives, score, coins } = this;
    this.reset();
    Object.assign(this, { lives, score, coins });
  }

  render(b, font) {
    b.fill(SKY);
    const cam = this.cameraX, camY = this.cameraY;
    const c0 = fdiv(cam, TILE), c1 = Math.min(this.levelW - 1, fdiv(cam + W, TILE) + 1);
    for (let row = 0; row < LEVEL_H; row++) {
      for (let col = c0; col <= c1; col++) {
        const t = this.tiles[row][col];
        if (t === " ") continue;
        const sp = t === "?" && this.questFrame ? T_QUEST2 : TILE_MAP[t];
        if (sp) drawSprite(b, sp, col * TILE - cam, row * TILE - camY);
      }
    }
    for (const it of this.items) it.render(b, cam, camY);
    for (const e of this.enemies) e.render(b, cam, camY);
    this.mario.render(b, cam, camY);

    // HUD: Punkte links, Münzen, Herz und Leben rechts
    font.drawText(b, String(this.score).padStart(6, "0"), 0, 0, COL_SCORE);
    icon(b, 26, 0, [".X.", "XXX", "XXX", ".X."], [255, 215, 0]);
    font.drawText(b, String(this.coins).padStart(2, "0"), 30, 0, COL_WHITE);
    icon(b, 38, 1, ["X.X", "XXX", ".X."], COL_RED);
    font.drawText(b, String(this.lives), 42, 0, COL_WHITE);
  }
}

function icon(b, x, y, rows, c) {
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch !== ".") b.set(x + dx, y + dy, c); }));
}
