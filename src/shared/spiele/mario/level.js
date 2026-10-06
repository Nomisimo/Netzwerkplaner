/* ── Mario: Welt 1-1 als Endlosschleife ────────────────────────────────────
   Spalten 0–27 sind der Einstieg (einmal), ab 28 wiederholen sich die Spalten 28–195. */
export const LEVEL_H = 6;
const LOOP_START = 28, LOOP_LEN = 168, TEMPLATE_W = 196;

function buildTemplate() {
  const grid = Array.from({ length: LEVEL_H }, () => Array(TEMPLATE_W).fill(" "));
  const hline = (row, c0, c1, ch) => { for (let c = c0; c <= c1; c++) grid[row][c] = ch; };
  const pipe = (col, height) => {
    const top = LEVEL_H - 1 - height;
    grid[top][col] = "["; grid[top][col + 1] = "]";
    for (let r = top + 1; r < LEVEL_H - 1; r++) { grid[r][col] = "("; grid[r][col + 1] = ")"; }
  };
  const reihe = (row, c0, chars) => [...chars].forEach((ch, i) => { grid[row][c0 + i] = ch; });

  hline(5, 0, 65, "G");
  hline(5, 68, 195, "G");          // Grube bei 66–67
  grid[2][13] = "?";
  reihe(2, 16, "B?B?BBB");
  pipe(28, 2); pipe(38, 2);
  reihe(2, 45, "?BB?BB?B");
  hline(1, 54, 58, "B");
  pipe(61, 3); pipe(65, 3);
  reihe(2, 77, "BB?BB?BB?B");
  hline(1, 89, 93, "B");
  grid[2][97] = "?"; grid[2][100] = "B"; grid[2][101] = "?"; grid[2][104] = "B"; grid[2][107] = "?";
  pipe(111, 2);
  hline(2, 115, 120, "B");
  grid[2][117] = "?"; grid[2][119] = "?";
  grid[2][131] = "?"; grid[2][133] = "B"; grid[2][135] = "?";
  pipe(141, 2);
  hline(1, 145, 149, "B");
  grid[1][147] = "?";
  const treppe = (c0, n, top) => { for (let i = 0; i < n; i++) for (let r = Math.max(0, top(i)); r < 5; r++) grid[r][c0 + i] = "H"; };
  treppe(155, 8, (i) => 4 - i);
  treppe(164, 4, (i) => 4 - (3 - i));
  treppe(172, 8, (i) => 4 - i);
  return grid;
}
const TEMPLATE = buildTemplate();

const ENEMY_COLS = {
  9: "goomba", 10: "goomba", 32: "goomba", 36: "goomba", 42: "goomba", 43: "goomba", 60: "goomba",
  72: "goomba", 73: "goomba", 80: "goomba", 90: "koopa", 105: "goomba", 115: "goomba", 116: "goomba",
  132: "goomba", 145: "koopa", 165: "goomba",
};

export const baseCol = (col) => (col < LOOP_START ? col : LOOP_START + ((col - LOOP_START) % LOOP_LEN));

// → [Kacheln je Zeile, Gegnertyp oder null]
export function genColumn(col) {
  const bc = baseCol(col);
  const tiles = bc < TEMPLATE_W ? TEMPLATE.map((row) => row[bc]) : [...Array(LEVEL_H - 1).fill(" "), "G"];
  return [tiles, ENEMY_COLS[bc] || null];
}
