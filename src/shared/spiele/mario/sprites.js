/* ── Mario: Pixel-Grafiken (4 px breit, Kacheln 4×4) ──────────────────────
   Jede Grafik ist eine Liste von Zeilen; je Pixel eine Farbe oder null (durchsichtig). */
const P = {
  R: [220, 50, 0], S: [255, 196, 108], B: [20, 80, 200], W: [120, 65, 15],
  G: [0, 180, 0], D: [0, 110, 0], K: [90, 45, 5], k: [60, 28, 3],
  E: [255, 255, 255], Y: [255, 215, 0], y: [180, 145, 0], O: [185, 85, 30],
  o: [75, 30, 8], L: [185, 105, 30], N: [125, 65, 20], n: [65, 30, 5],
  H: [185, 178, 158], h: [132, 126, 107], T: [210, 40, 40], t: [140, 20, 20],
  F: [255, 80, 0], f: [80, 160, 30], C: [60, 155, 60], c: [30, 90, 30],
  g: [0, 120, 0], ".": null,
};
const s = (rows) => rows.map((r) => [...r].map((ch) => P[ch]));

export const MARIO_SMALL = {
  idle: s([".RR.", "RSSR", ".RR.", ".BB.", ".BB.", "W..W"]),
  run1: s([".RR.", "RSSR", ".RR.", ".BB.", "B..B", "W..W"]),
  run2: s([".RR.", "RSSR", ".RR.", ".BB.", ".BBB", ".WW."]),
  jump: s([".RR.", "RSSR", ".RR.", "BBB.", "B..B", "W.W."]),
  dead: s([".RR.", "RSSR", ".RR.", ".BB.", ".BB.", "W..W"]),
};
const BIG_TOP = [".RR.", "RSSR", ".SS.", "RRRR", "BBRB", "BBRB"];
export const MARIO_BIG = {
  idle: s([...BIG_TOP, ".BB.", ".BB.", ".BB.", "W..W"]),
  run1: s([...BIG_TOP, ".BB.", ".BB.", "B..B", "W..W"]),
  run2: s([...BIG_TOP, ".BB.", ".BB.", ".BBB", ".WW."]),
  jump: s([...BIG_TOP, "BBB.", ".BB.", "B..B", "W.W."]),
  duck: s([".RR.", "RSSR", ".SS.", "BBRB", ".BB.", "W..W"]),
};
// Feuer-Mario nutzt dieselben Formen wie im Original
export const MARIO_FIRE = MARIO_BIG;

export const GOOMBA = {
  walk1: s([".KK.", "KEKK", "KkKK", "K..K"]),
  walk2: s([".KK.", "KEKK", "KkKK", ".KKK"]),
  dead: s(["KEKK", ".KK."]),
};
export const KOOPA = {
  walk1: s([".CC.", "CCCC", "CGCG", ".SS.", "B..B", "W..W"]),
  walk2: s([".CC.", "CCCC", "CGCG", ".SS.", ".BBB", ".WW."]),
  shell: s(["cCCC", "CCCC", "CcCC", ".CC."]),
};
export const MUSHROOM = s([".TT.", "TTtT", "TETE", ".SS.", ".SS."]);
export const FIRE_FLOWER = s([".FF.", "F.F.", ".fF.", ".f..", ".f.."]);
export const COIN = s([".YY.", "YyyY", "YyyY", ".YY."]);
export const STAR = s([".Y.Y", "yYyy", "yYYy", "y.y."]);
export const ONEUP = s([".GG.", "GGgG", "GEGE", ".SS.", ".SS."]);
export const DEBRIS = s(["OO", "Oo"]);

export const T_QUEST2 = s(["YYYY", "Yyyy", "YYYY", "YyyY"]);
export const TILE_MAP = {
  G: s(["LLNL", "NNNN", "NNNn", "nNNn"]),
  H: s(["HhHH", "HHHH", "HHHH", "hHHH"]),
  B: s(["OoOO", "OOOO", "oOOO", "OOOO"]),
  "?": s(["yYYy", "yYyy", "yYYy", "yyyy"]),
  "[": s(["DDGG", "DGGG", "DGGG", "DGGG"]),
  "]": s(["GGDD", "GGGD", "GGGD", "GGGD"]),
  "(": s(["DGGG", "DGGG", "DGGG", "DGGG"]),
  ")": s(["GGGD", "GGGD", "GGGD", "GGGD"]),
  "|": s(["W...", "W...", "W...", "W..."]),
  F: s(["HhHH", "HHHH", "hHHH", "HHHH"]),
};

export function drawSprite(bild, sprite, x, y) {
  sprite.forEach((row, ri) => row.forEach((c, ci) => { if (c) bild.set(x + ci, y + ri, c); }));
}
export const flipH = (sprite) => sprite.map((row) => [...row].reverse());
