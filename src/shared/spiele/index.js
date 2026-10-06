/* ── Spiele für die LED-Matrix (48×24) ─────────────────────────────────────
   Jedes Spiel: key(code) bei Tastendruck, step(held) einmal je Bild (60 fps),
   render(bild). Töne meldet das Spiel über ton(name); die Oberfläche spielt sie ab. */
import { createSnake } from "./snake.js";
import { createPong } from "./pong.js";
import { createMario } from "./mario/index.js";
export { Bild, W, H } from "./pixel.js";

export const SPIELE = [
  { id: "snake", name: "Snake", create: createSnake,
    tasten: [["Leertaste", "Start"], ["Pfeile / WASD", "Richtung"], ["Esc", "Pause"], ["Q", "in der Pause: zum Titel"]] },
  { id: "pong", name: "Pong", create: createPong,
    tasten: [["← / → oder 1 / 2", "1 Spieler (gegen Computer) oder 2 Spieler"], ["Leertaste / Enter", "Start"], ["W / S", "linker Schläger"], ["↑ / ↓", "rechter Schläger (2 Spieler)"]] },
  { id: "mario", name: "Mario Jump", create: createMario,
    tasten: [["Enter / Leertaste", "Start"], ["← / → oder A / D", "Laufen"], ["Leertaste / ↑ / W", "Springen (halten = höher)"], ["Shift / Z", "Rennen"], ["↓ / S", "Ducken (groß)"], ["Esc", "zum Titel"]] },
];
