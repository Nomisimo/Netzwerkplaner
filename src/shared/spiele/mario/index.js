/* ── Mario Jump (Port von matrix-mario-jump) ───────────────────────────────
   Endloser Jump'n'Run in Welt 1-1. Zustände: title → playing → game_over → title */
import { schrift } from "../pixel.js";
import { MarioWelt, SKY, COL_WHITE, COL_SCORE, COL_RED } from "./welt.js";

export const FONT = schrift({
  0: ["111", "101", "101", "101", "111"], 1: ["110", "010", "010", "010", "111"],
  2: ["111", "001", "011", "100", "111"], 3: ["111", "001", "011", "001", "111"],
  4: ["101", "101", "111", "001", "001"], 5: ["111", "100", "110", "001", "110"],
  6: ["011", "100", "111", "101", "111"], 7: ["111", "001", "001", "010", "010"],
  8: ["111", "101", "111", "101", "111"], 9: ["111", "101", "111", "001", "011"],
  A: ["011", "101", "111", "101", "101"], B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"], D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"], F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"], H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"], J: ["011", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"], L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "101", "101", "101"], N: ["101", "111", "111", "101", "101"],
  O: ["111", "101", "101", "101", "111"], P: ["111", "101", "111", "100", "100"],
  Q: ["111", "101", "101", "011", "001"], R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"], T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"], V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "101", "111", "010"], X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"], Z: ["111", "001", "010", "100", "111"],
  " ": ["000", "000", "000", "000", "000"], "-": ["000", "000", "111", "000", "000"],
  ":": ["010", "000", "010", "000", "000"], ".": ["000", "000", "000", "000", "010"],
  "!": ["010", "010", "010", "000", "010"], _: ["000", "000", "000", "000", "111"],
  ">": ["100", "010", "001", "010", "100"],
}, { fest: 3 });
const centered = (b, text, y, c) => FONT.drawText(b, text, FONT.center(text), y, c);

// Tasten wie im Original: Pfeile/WASD, Sprung Leertaste/↑/W, Rennen Shift/Z, Ducken ↓/S
export const marioKeys = (held) => ({
  left: held.has("ArrowLeft") || held.has("KeyA"),
  right: held.has("ArrowRight") || held.has("KeyD"),
  jump: held.has("Space") || held.has("ArrowUp") || held.has("KeyW"),
  run: held.has("ShiftLeft") || held.has("ShiftRight") || held.has("KeyZ") || held.has("KeyY"),
  duck: held.has("ArrowDown") || held.has("KeyS"),
});

export function createMario({ ton = () => {} } = {}) {
  let state = "title", game = null, tick = 0;
  const start = () => { game = new MarioWelt(ton); state = "playing"; ton("_music"); };
  return {
    id: "mario",
    get state() { return state; },
    get welt() { return game; },
    key(code) {
      if (code === "Escape") { if (state !== "title") { state = "title"; ton("_stop"); } return; }
      if ((state === "title" || state === "game_over") && (code === "Enter" || code === "Space")) start();
    },
    step(held) {
      if (state === "title") tick++;
      else if (state === "playing") {
        const lives = game.lives;
        game.update(marioKeys(held));
        if (game.gameOver) state = "game_over";
        // Nach einem verlorenen Leben läuft die Musik wieder an
        else if (game.lives < lives) ton("_music");
      }
    },
    render(b) {
      if (state === "title") {
        b.fill(SKY);
        centered(b, "SUPER MARIO", 3, COL_SCORE);
        centered(b, "BROS", 10, COL_SCORE);
        if (Math.floor(tick / 30) % 2 === 0) centered(b, "PRESS ENTER", 18, COL_WHITE);
      } else if (state === "playing") game.render(b, FONT);
      else {
        b.fill(SKY);
        centered(b, "GAME OVER", 7, COL_RED);
        centered(b, String(game.score).padStart(6, "0"), 14, COL_SCORE);
        centered(b, "PRESS ENTER", 19, COL_WHITE);
      }
    },
  };
}
