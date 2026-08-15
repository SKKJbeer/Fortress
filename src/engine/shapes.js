// Bauteile (aus dem Grossblock herausgeloest, v3.78.0).
//
// Die Tetromino-Formen und ihre Drehung. Ohne jeden Aussenbezug.
// SHADOW_DX/DY stehen hier, weil der Schattenversatz zur Darstellung eines
// Bauteils gehoert und sonst als einzelnes Zahlenpaar heimatlos waere.
const SHADOW_DX = 2.6, SHADOW_DY = 3.2;
const SHAPES = [
  [[0, 0]],
  // 1×1 Einzelstein
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 1], [1, 1], [2, 1], [2, 0]],
  [[0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1]]
];
function rotateCW(cells) {
  const r = cells.map(([y, x]) => [x, -y]);
  const minR = Math.min(...r.map(([y]) => y));
  const minC = Math.min(...r.map(([, x]) => x));
  return r.map(([y, x]) => [y - minR, x - minC]);
}
const randomShape = () => SHAPES[Math.floor(Math.random() * SHAPES.length)].map((c) => [...c]);

export { SHADOW_DX, SHADOW_DY, SHAPES, rotateCW, randomShape };
