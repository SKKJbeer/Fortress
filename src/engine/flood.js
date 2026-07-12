// Auto-extrahiert aus index.html (Phase 1 der Modularisierung, v3.34.0).
// Reine Logik/Daten — kein DOM, kein React, kein Firebase. Unit-testbar via node --test.
import { ROWS, COLS, WALL_OF, CASTLE_OF } from './const.js';

export function computeOutsideMap(g, player) {
  const ownWall = WALL_OF[player];
  const ownCastle = CASTLE_OF[player];
  const visited = new Uint8Array(ROWS * COLS);
  const stack = [];
  for (let c = 0; c < COLS; c++) {
    stack.push(c);
    stack.push((ROWS - 1) * COLS + c);
  }
  for (let r = 0; r < ROWS; r++) {
    stack.push(r * COLS);
    stack.push(r * COLS + COLS - 1);
  }
  while (stack.length) {
    const idx = stack.pop();
    if (visited[idx]) continue;
    const r = Math.floor(idx / COLS), c = idx % COLS;
    const v = g[r][c];
    if (v === ownWall || v === ownCastle) continue;
    visited[idx] = 1;
    if (r > 0) stack.push(idx - COLS);
    if (r < ROWS - 1) stack.push(idx + COLS);
    if (c > 0) stack.push(idx - 1);
    if (c < COLS - 1) stack.push(idx + 1);
    if (r > 0 && c > 0) stack.push(idx - COLS - 1);
    if (r > 0 && c < COLS - 1) stack.push(idx - COLS + 1);
    if (r < ROWS - 1 && c > 0) stack.push(idx + COLS - 1);
    if (r < ROWS - 1 && c < COLS - 1) stack.push(idx + COLS + 1);
  }
  return visited;
}
export function computeOutsideMapForCannons(g, player) {
  const ownWall = WALL_OF[player];
  const visited = new Uint8Array(ROWS * COLS);
  const stack = [];
  for (let c = 0; c < COLS; c++) {
    stack.push(c);
    stack.push((ROWS - 1) * COLS + c);
  }
  for (let r = 0; r < ROWS; r++) {
    stack.push(r * COLS);
    stack.push(r * COLS + COLS - 1);
  }
  while (stack.length) {
    const idx = stack.pop();
    if (visited[idx]) continue;
    const r = Math.floor(idx / COLS), c = idx % COLS;
    const v = g[r][c];
    if (v === ownWall) continue;
    visited[idx] = 1;
    if (r > 0) stack.push(idx - COLS);
    if (r < ROWS - 1) stack.push(idx + COLS);
    if (c > 0) stack.push(idx - 1);
    if (c < COLS - 1) stack.push(idx + 1);
    if (r > 0 && c > 0) stack.push(idx - COLS - 1);
    if (r > 0 && c < COLS - 1) stack.push(idx - COLS + 1);
    if (r < ROWS - 1 && c > 0) stack.push(idx + COLS - 1);
    if (r < ROWS - 1 && c < COLS - 1) stack.push(idx + COLS + 1);
  }
  return visited;
}
export function isObjectClosed(outsideMap, obj) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = obj.r + dr, c = obj.c + dc;
      if (r <= 0 || r >= ROWS - 1 || c <= 0 || c >= COLS - 1) return false;
      for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
        if (outsideMap[nr * COLS + nc]) return false;
      }
    }
  }
  return true;
}
export function isCastleClosed(g, player, castle) {
  if (!castle) return true;
  return isObjectClosed(computeOutsideMap(g, player), castle);
}
export function closedCannons(g, player, cannonList) {
  const outside = computeOutsideMapForCannons(g, player);
  return cannonList.filter((cn) => isObjectClosed(outside, cn));
}
export const isCannonClosed = isObjectClosed;
